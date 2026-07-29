import {Prisma} from "@prisma/client";
import {prisma} from "../../database/db";
import {loggedInUserType} from "../../types/user";
import type {
  TransactionCreateType,
  TransactionUpdateType,
} from "./transactions.dto";

const transactionSelect = {
  id: true,
  type: true,
  for: true,
  paidAmount: true,
  totalPaidAmount: true,
  branchNet: true,
  clientNet: true,
  deliveryAgentNet: true,
  forwardedBranchNet: true,
  receivingBranchNet: true,
  insideBranchNet: true,
  approved: true,
  deleted: true,
  createdAt: true,
  updatedAt: true,
  branch: {select: {id: true, name: true}},
  company: {select: {id: true, name: true}},
  employee: {select: {id: true, user: {select: {name: true}}}},
  createdBy: {select: {id: true, name: true}},
  report: {select: {id: true, type: true}},
};

export class TransactionsRepository {
  createTransaction = async ({
    companyID,
    createdByID,
    data,
  }: {
    companyID: number;
    createdByID: number;
    data: TransactionCreateType;
  }) => {
    const {employeeID, reportID, branchID, ...rest} = data;

    return prisma.transaction.create({
      data: {
        ...rest,
        company: {connect: {id: companyID}},
        createdBy: {connect: {id: createdByID}},
        ...(employeeID && {employee: {connect: {id: employeeID}}}),
        ...(reportID && {report: {connect: {id: reportID}}}),
        ...(branchID && {branch: {connect: {id: branchID}}}),
      },
      select: transactionSelect,
    });
  };

  getAllTransactionsPaginated = async (
    {
      page,
      size,
      companyID,
      branchID,
      employeeID,
      type,
      approved,
      deleted,
      startDate,
      endDate,
    }: {
      page: number;
      size: number;
      companyID?: number;
      branchID?: number;
      employeeID?: number;
      type?: string;
      approved?: boolean;
      deleted?: boolean;
      startDate?: Date;
      endDate?: Date;
    },
    loggedInUser: loggedInUserType,
  ) => {
    const applyBranchScope =
      loggedInUser?.role === "COMPANY_MANAGER" || loggedInUser?.mainRepository;

    let myBranchId = loggedInUser?.branchId;

    if (loggedInUser?.role === "COMPANY_MANAGER") {
      const mainBranch = await prisma.repository.findFirst({
        where: {
          companyId: loggedInUser.companyID,
          mainRepository: true,
        },
        select: {
          branchId: true,
        },
      });
      myBranchId = mainBranch?.branchId || loggedInUser?.branchId;
    }

    const where: Prisma.TransactionWhereInput = {
      companyId: companyID,
      employeeId: employeeID,
      type: type as never,
      deleted: deleted ?? false,
      ...((startDate || endDate) && {
        createdAt: {
          ...(startDate && {gte: startDate}),
          ...(endDate && {lte: endDate}),
        },
      }),
      ...(applyBranchScope
        ? {
            approvedforMain: approved,
            OR: [
              {branchId: myBranchId},
              {
                report: {
                  type: "BRANCH",
                  branchReport: {forChildBranches: false},
                },
              },
            ],
          }
        : {
            approved,
            branchId: branchID,
          }),
    };

    const [transactions, count] = await Promise.all([
      prisma.transaction.findMany({
        skip: (page - 1) * size,
        take: size,
        where,
        orderBy: {createdAt: "desc"},
        select: transactionSelect,
      }),
      prisma.transaction.count({where}),
    ]);

    // When branch-scoped, flip DEPOSIT<->WITHDRAW for BRANCH-report transactions
    const reformedTransactions = applyBranchScope
      ? transactions.map((t) => {
          if (t.report?.type === "BRANCH") {
            return {
              ...t,
              type:
                t.type === "DEPOSIT"
                  ? "WITHDRAW"
                  : t.type === "WITHDRAW"
                    ? "DEPOSIT"
                    : t.type,
            };
          }
          return t;
        })
      : transactions;

    return {
      transactions: reformedTransactions,
      pagesCount: Math.ceil(count / size),
    };
  };

  async getStatistics(filters: {
    companyId?: number;
    deliveryAgentId?: number;
    clientId?: number;
    branchId?: number;
    type?: string;
    start_date?: string;
    end_date?: string;
    loggedInUser?: loggedInUserType;
  }) {
    const applyBranchScope =
      filters.loggedInUser?.role === "COMPANY_MANAGER" ||
      filters.loggedInUser?.mainRepository;

    let myBranchId = filters.loggedInUser?.branchId;

    if (filters.loggedInUser?.role === "COMPANY_MANAGER") {
      const mainBranch = await prisma.repository.findFirst({
        where: {
          companyId: filters.loggedInUser.companyID,
          mainRepository: true,
        },
        select: {
          branchId: true,
        },
      });
      myBranchId = mainBranch?.branchId;
    }

    let startDate = new Date();
    let endDate = new Date();

    if (filters.start_date) {
      startDate = new Date(filters.start_date);
      startDate.setHours(0, 0, 0, 0);
    }
    if (filters.end_date) {
      endDate = new Date(filters.end_date);
      endDate.setHours(23, 59, 59, 59);
    }

    // built once, reused — identical semantics to the inline versions
    const createdAtFilter =
      filters.start_date || filters.end_date
        ? {
            ...(filters.start_date && {gt: startDate}),
            ...(filters.end_date && {lte: endDate}),
          }
        : undefined;

    const [
      totalDepoist,
      totalWithdraw,
      receivedFromAgents,
      notReceived,
      forClients,
      paidToClients,
      insideBranchNet,
      receivedBranchNet,
      forwardedBranchNet,
    ] = await Promise.all([
      prisma.transaction.aggregate({
        _sum: {paidAmount: true},
        where: {
          companyId: filters.companyId,
          deleted: false,
          ...(applyBranchScope
            ? {
                approvedforMain: true,
                OR: [
                  {branchId: myBranchId, type: "DEPOSIT"},
                  {
                    type: "WITHDRAW",
                    report: {
                      type: "BRANCH",
                      branchReport: {type: "received", forChildBranches: false},
                    },
                  },
                ],
              }
            : {
                approved: true,
                type: "DEPOSIT",
                branchId: filters.loggedInUser?.branchId,
              }),
        },
      }),

      prisma.transaction.aggregate({
        _sum: {paidAmount: true},
        where: {
          companyId: filters.companyId,
          deleted: false,
          ...(applyBranchScope
            ? {
                approvedforMain: true,
                OR: [
                  {branchId: myBranchId, type: "WITHDRAW"},
                  {
                    type: "DEPOSIT",
                    report: {
                      type: "BRANCH",
                      branchReport: {
                        type: "forwarded",
                        forChildBranches: false,
                      },
                    },
                  },
                ],
              }
            : {
                approved: true,
                type: "WITHDRAW",
                branchId: filters.loggedInUser?.branchId,
              }),
        },
      }),

      prisma.order.aggregate({
        _sum: {paidAmount: true, deliveryAgentNet: true},
        _count: {id: true},
        where: {
          companyId: filters.companyId,
          deleted: false,
          confirmed: true,
          branchId: myBranchId,
          deliveryAgentId: filters.deliveryAgentId,
          ...(createdAtFilter && {createdAt: createdAtFilter}),
          deliveryAgentReport: {
            report: {deleted: false, activeProfit: true},
          },
        },
      }),

      prisma.order.aggregate({
        _sum: {paidAmount: true},
        _count: {id: true},
        where: {
          companyId: filters.companyId,
          deleted: false,
          confirmed: true,
          status: {in: ["DELIVERED", "PARTIALLY_RETURNED", "REPLACED"]},
          branchId: myBranchId,
          deliveryAgent: {
            branchId: myBranchId,
          },
          ...(createdAtFilter && {createdAt: createdAtFilter}),
          OR: [
            {deliveryAgentReport: {is: null}},
            {deliveryAgentReport: {report: {deleted: true}}},
          ],
        },
      }),

      prisma.order.aggregate({
        _sum: {paidAmount: true, deliveryCost: true},
        _count: {id: true},
        where: {
          companyId: filters.loggedInUser?.companyID || undefined,
          deleted: false,
          confirmed: true,
          status: {in: ["DELIVERED", "PARTIALLY_RETURNED", "REPLACED"]},
          clientId: filters.clientId,
          client: {branchId: myBranchId},
          clientReport: {
            none: {
              secondaryType: "DELIVERED",
              report: {deleted: false},
            },
          },
        },
      }),

      prisma.report.aggregate({
        _sum: {
          clientNet: true,
          baghdadOrdersCount: true,
          governoratesOrdersCount: true,
        },
        where: {
          companyId: filters.companyId,
          deleted: false,
          ...(createdAtFilter && {createdAt: createdAtFilter}),
          clientReport: {
            clientId: filters.clientId,
            client: {branchId: myBranchId},
            secondaryType: "DELIVERED",
            report: {
              deleted: false,
              activeProfit: true,
              transaction: applyBranchScope
                ? {
                    deleted: false,
                    approvedforMain: true,
                  }
                : {
                    deleted: false,
                    approved: true,
                  },
            },
          },
        },
      }),

      applyBranchScope
        ? prisma.order.aggregate({
            _sum: {
              paidAmount: true,
              forwardedBranchNet: true,
              receivingBranchNet: true,
              deliveryAgentNet: true,
              insideBranchNet: true,
            },
            _count: {id: true},
            where: {
              companyId: filters.companyId,
              deleted: false,
              confirmed: true,
              client: {
                branchId: {not: myBranchId},
              },
              ...(createdAtFilter && {createdAt: createdAtFilter}),
              AND: [
                {
                  branchReport: {
                    some: {
                      type: "received",
                      report: {
                        deleted: false,
                        activeProfit: true,
                        transaction: {deleted: false, approvedforMain: true},
                      },
                    },
                  },
                },
                {
                  branchReport: {
                    some: {
                      type: "forwarded",
                      report: {
                        deleted: false,
                        activeProfit: true,
                        transaction: {deleted: false, approvedforMain: true},
                      },
                    },
                  },
                },
              ],
            },
          })
        : prisma.order.aggregate({
            _sum: {
              paidAmount: true,
              forwardedBranchNet: true,
              receivingBranchNet: true,
              deliveryAgentNet: true,
              insideBranchNet: true,
            },
            _count: {id: true},
            where: {
              companyId: filters.companyId,
              deleted: false,
              confirmed: true,
              branchId: filters.loggedInUser?.branchId,
              client: {
                branchId: filters.loggedInUser?.branchId,
              },
              ...(createdAtFilter && {createdAt: createdAtFilter}),
              clientReport: {
                some: {
                  clientId: filters.clientId,
                  secondaryType: "DELIVERED",
                  report: {
                    deleted: false,
                    activeProfit: true,
                    transaction: {
                      deleted: false,
                      approved: true,
                    },
                  },
                },
              },
            },
          }),

      prisma.order.aggregate({
        _sum: {receivingBranchNet: true},
        _count: {id: true},
        where: {
          companyId: filters.companyId,
          deleted: false,
          confirmed: true,
          ...(createdAtFilter && {createdAt: createdAtFilter}),
          branchReport: {
            some: {
              branchId: filters.loggedInUser?.branchId,
              type: "received",
              report: {
                deleted: false,
                activeProfit: true,
                transaction: {
                  deleted: false,
                  approvedforMain: true,
                },
              },
            },
          },
        },
      }),

      prisma.order.aggregate({
        _sum: {
          forwardedBranchNet: true,
          clientNet: true,
          deliveryCost: true,
          receivingBranchNet: true,
          deliveryAgentNet: true,
        },
        _count: {id: true},
        where: {
          companyId: filters.companyId,
          deleted: false,
          confirmed: true,
          ...(createdAtFilter && {createdAt: createdAtFilter}),
          ...(applyBranchScope
            ? {
                client: {
                  branchId: myBranchId,
                },
                branchReport: {
                  some: {
                    type: "received",
                    report: {
                      deleted: false,
                      activeProfit: true,
                      transaction: {
                        deleted: false,
                        approvedforMain: true,
                      },
                    },
                  },
                },
              }
            : {
                branchReport: {
                  some: {
                    branchId: filters.loggedInUser?.branchId,
                    type: "forwarded",
                    report: {
                      deleted: false,
                      activeProfit: true,
                      transaction: {
                        deleted: false,
                        approved: true,
                      },
                    },
                  },
                },
              }),
        },
      }),
    ]);

    return {
      totalDepoist: totalDepoist._sum.paidAmount,
      totalWithdraw: totalWithdraw._sum.paidAmount,
      total:
        (totalDepoist._sum.paidAmount ?? 0) -
        (totalWithdraw._sum.paidAmount ?? 0),
      receivedFromAgents: {
        total:
          (receivedFromAgents._sum.paidAmount ?? 0) -
          (receivedFromAgents._sum.deliveryAgentNet ?? 0),
        count: receivedFromAgents._count.id,
      },
      agentProfit: {
        total: receivedFromAgents._sum.deliveryAgentNet,
        count: receivedFromAgents._count.id,
      },
      notReceived: {
        total: notReceived._sum.paidAmount,
        count: notReceived._count.id,
      },
      forClients: {
        total:
          (forClients._sum.paidAmount ?? 0) -
          (forClients._sum.deliveryCost ?? 0),
        count: forClients._count.id,
      },
      paidToClients: {
        total: paidToClients._sum.clientNet,
        count:
          (paidToClients._sum.baghdadOrdersCount ?? 0) +
          (paidToClients._sum.governoratesOrdersCount ?? 0),
      },
      insideBranchNet: applyBranchScope
        ? {
            total:
              (insideBranchNet._sum.paidAmount ?? 0) -
              (insideBranchNet._sum.forwardedBranchNet ?? 0) -
              (insideBranchNet._sum.deliveryAgentNet ?? 0) -
              (insideBranchNet._sum.receivingBranchNet ?? 0),
            count: insideBranchNet._count.id,
          }
        : {
            total: insideBranchNet._sum.insideBranchNet,
            count: insideBranchNet._count.id,
          },
      receivedBranchNet: {
        total: receivedBranchNet._sum.receivingBranchNet,
        count: receivedBranchNet._count.id,
      },
      forwardedBranchNet: applyBranchScope
        ? {
            total:
              (forwardedBranchNet._sum.deliveryCost ?? 0) -
              (forwardedBranchNet._sum.receivingBranchNet ?? 0) -
              (forwardedBranchNet._sum.deliveryAgentNet ?? 0),
            count: forwardedBranchNet._count.id,
          }
        : {
            total:
              (forwardedBranchNet._sum.forwardedBranchNet ?? 0) -
              (forwardedBranchNet._sum.clientNet ?? 0),
            count: forwardedBranchNet._count.id,
          },
    };
  }

  async getDailyStatistics(filters: {
    companyId?: number;
    deliveryAgentId?: number;
    clientId?: number;
    branchId?: number;
    type?: string;
    start_date?: string;
    end_date?: string;
    loggedInUser?: loggedInUserType;
  }) {
    const applyBranchScope =
      filters.loggedInUser?.role === "COMPANY_MANAGER" ||
      filters.loggedInUser?.mainRepository;

    let myBranchId = filters.loggedInUser?.branchId;

    if (filters.loggedInUser?.role === "COMPANY_MANAGER") {
      const mainBranch = await prisma.repository.findFirst({
        where: {
          companyId: filters.loggedInUser.companyID,
          mainRepository: true,
        },
        select: {
          branchId: true,
        },
      });
      myBranchId = mainBranch?.branchId;
    }

    let startDate = new Date();
    let endDate = new Date();

    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 59);

    // built once, reused — identical semantics to the inline versions
    const createdAtFilter = {
      gt: startDate,
      lte: endDate,
    };

    const [
      totalDepoist,
      totalWithdraw,
      receivedFromAgents,
      paidToClients,
      insideBranchNet,
      receivedBranchNet,
      forwardedBranchNet,
    ] = await Promise.all([
      prisma.transaction.aggregate({
        _sum: {paidAmount: true},
        where: {
          companyId: filters.companyId,
          deleted: false,
          ...(applyBranchScope
            ? {
                approvedforMain: false,
                OR: [
                  {branchId: myBranchId, type: "DEPOSIT"},
                  {
                    type: "WITHDRAW",
                    report: {
                      type: "BRANCH",
                      branchReport: {type: "received", forChildBranches: false},
                    },
                  },
                ],
              }
            : {
                approved: false,
                type: "DEPOSIT",
                branchId: filters.loggedInUser?.branchId,
              }),
        },
      }),

      prisma.transaction.aggregate({
        _sum: {paidAmount: true},
        where: {
          companyId: filters.companyId,
          deleted: false,
          ...(applyBranchScope
            ? {
                approvedforMain: false,
                OR: [
                  {branchId: myBranchId, type: "WITHDRAW"},
                  {
                    type: "DEPOSIT",
                    report: {
                      type: "BRANCH",
                      branchReport: {
                        type: "forwarded",
                        forChildBranches: false,
                      },
                    },
                  },
                ],
              }
            : {
                approvedforMain: false,
                type: "WITHDRAW",
                branchId: filters.loggedInUser?.branchId,
              }),
        },
      }),

      prisma.report.aggregate({
        _sum: {
          paidAmount: true,
          deliveryAgentNet: true,
          baghdadOrdersCount: true,
          governoratesOrdersCount: true,
        },
        where: {
          companyId: filters.companyId,
          deleted: false,
          activeProfit: true,
          createdAt: createdAtFilter,
          deliveryAgentReport: {
            deliveryAgent: {
              branchId: myBranchId,
            },
          },
          transaction: applyBranchScope
            ? {
                deleted: false,
                approvedforMain: false,
              }
            : {
                deleted: false,
                approved: false,
              },
        },
      }),

      prisma.report.aggregate({
        _sum: {
          clientNet: true,
          baghdadOrdersCount: true,
          governoratesOrdersCount: true,
        },
        where: {
          companyId: filters.companyId,
          deleted: false,
          createdAt: createdAtFilter,
          activeProfit: true,
          clientReport: {
            clientId: filters.clientId,
            client: {branchId: filters.loggedInUser?.branchId},
            secondaryType: "DELIVERED",
            report: {deleted: false, activeProfit: true},
          },
          transaction: applyBranchScope
            ? {
                deleted: false,
                approvedforMain: false,
              }
            : {
                deleted: false,
                approved: false,
              },
        },
      }),

      applyBranchScope
        ? prisma.order.aggregate({
            _sum: {
              paidAmount: true,
              forwardedBranchNet: true,
              receivingBranchNet: true,
              deliveryAgentNet: true,
              insideBranchNet: true,
            },
            _count: {id: true},
            where: {
              companyId: filters.companyId,
              deleted: false,
              confirmed: true,
              client: {
                branchId: {not: myBranchId},
              },
              AND: [
                {
                  branchReport: {
                    some: {
                      type: "received",
                      report: {
                        deleted: false,
                        activeProfit: true,
                        transaction: {deleted: false, approvedforMain: false},
                      },
                    },
                  },
                },
                {
                  branchReport: {
                    some: {
                      type: "forwarded",
                      report: {
                        deleted: false,
                        activeProfit: true,
                        transaction: {deleted: false, approvedforMain: false},
                      },
                    },
                  },
                },
              ],
            },
          })
        : prisma.order.aggregate({
            _sum: {
              paidAmount: true,
              forwardedBranchNet: true,
              receivingBranchNet: true,
              deliveryAgentNet: true,
              insideBranchNet: true,
            },
            _count: {id: true},
            where: {
              companyId: filters.companyId,
              deleted: false,
              confirmed: true,
              branchId: filters.loggedInUser?.branchId,
              client: {
                branchId: filters.loggedInUser?.branchId,
              },
              clientReport: {
                some: {
                  clientId: filters.clientId,
                  secondaryType: "DELIVERED",
                  report: {
                    deleted: false,
                    activeProfit: true,
                    transaction: {
                      deleted: false,
                      approved: false,
                    },
                  },
                },
              },
            },
          }),

      prisma.order.aggregate({
        _sum: {receivingBranchNet: true},
        _count: {id: true},
        where: {
          companyId: filters.companyId,
          deleted: false,
          confirmed: true,
          branchReport: {
            some: {
              branchId: filters.loggedInUser?.branchId,
              type: "received",
              report: {
                deleted: false,
                activeProfit: true,
                transaction: {
                  deleted: false,
                  approvedforMain: false,
                },
              },
            },
          },
        },
      }),

      prisma.order.aggregate({
        _sum: {
          forwardedBranchNet: true,
          clientNet: true,
          deliveryCost: true,
          receivingBranchNet: true,
          deliveryAgentNet: true,
        },
        _count: {id: true},
        where: {
          companyId: filters.companyId,
          deleted: false,
          confirmed: true,
          ...(applyBranchScope
            ? {
                client: {
                  branchId: myBranchId,
                },
                branchReport: {
                  some: {
                    type: "received",
                    report: {
                      deleted: false,
                      activeProfit: true,
                      transaction: {
                        deleted: false,
                        approvedforMain: false,
                      },
                    },
                  },
                },
              }
            : {
                branchReport: {
                  some: {
                    branchId: filters.loggedInUser?.branchId,
                    type: "forwarded",
                    report: {
                      deleted: false,
                      activeProfit: true,
                      transaction: {
                        deleted: false,
                        approved: false,
                      },
                    },
                  },
                },
              }),
        },
      }),
    ]);

    return {
      totalDepoist: totalDepoist._sum.paidAmount,
      totalWithdraw: totalWithdraw._sum.paidAmount,
      total:
        (totalDepoist._sum.paidAmount ?? 0) -
        (totalWithdraw._sum.paidAmount ?? 0),
      receivedFromAgents: {
        total:
          (receivedFromAgents._sum.paidAmount ?? 0) -
          (receivedFromAgents._sum.deliveryAgentNet ?? 0),
        count:
          (receivedFromAgents._sum.baghdadOrdersCount ?? 0) +
          (receivedFromAgents._sum.governoratesOrdersCount ?? 0),
      },
      agentProfit: {
        total: receivedFromAgents._sum.deliveryAgentNet,
        count:
          (receivedFromAgents._sum.baghdadOrdersCount ?? 0) +
          (receivedFromAgents._sum.governoratesOrdersCount ?? 0),
      },
      notReceived: {
        total: 0,
        count: 0,
      },
      forClients: {
        total: 0,
        count: 0,
      },
      paidToClients: {
        total: paidToClients._sum.clientNet,
        count:
          (paidToClients._sum.baghdadOrdersCount ?? 0) +
          (paidToClients._sum.governoratesOrdersCount ?? 0),
      },
      insideBranchNet: applyBranchScope
        ? {
            total:
              (insideBranchNet._sum.paidAmount ?? 0) -
              (insideBranchNet._sum.forwardedBranchNet ?? 0) -
              (insideBranchNet._sum.deliveryAgentNet ?? 0) -
              (insideBranchNet._sum.receivingBranchNet ?? 0),
            count: insideBranchNet._count.id,
          }
        : {
            total: insideBranchNet._sum.insideBranchNet,
            count: insideBranchNet._count.id,
          },
      receivedBranchNet: {
        total: receivedBranchNet._sum.receivingBranchNet,
        count: receivedBranchNet._count.id,
      },
      forwardedBranchNet: applyBranchScope
        ? {
            total:
              (forwardedBranchNet._sum.deliveryCost ?? 0) -
              (forwardedBranchNet._sum.receivingBranchNet ?? 0) -
              (forwardedBranchNet._sum.deliveryAgentNet ?? 0),
            count: forwardedBranchNet._count.id,
          }
        : {
            total:
              (forwardedBranchNet._sum.forwardedBranchNet ?? 0) -
              (forwardedBranchNet._sum.clientNet ?? 0),
            count: forwardedBranchNet._count.id,
          },
    };
  }

  getTransaction = async ({transactionID}: {transactionID: number}) => {
    return prisma.transaction.findUnique({
      where: {id: transactionID},
      select: transactionSelect,
    });
  };

  approveAllBranchTransactions = async ({
    branchID,
    companyID,
    loggedInUser,
  }: {
    branchID: number;
    companyID: number;
    loggedInUser: loggedInUserType;
  }) => {
    const applyBranchScope =
      loggedInUser?.role === "COMPANY_MANAGER" || loggedInUser?.mainRepository;

    if (applyBranchScope) {
      const result = await prisma.transaction.updateMany({
        where: {
          companyId: companyID,
          approvedforMain: false,
          deleted: false,
        },
        data: {approvedforMain: true},
      });

      return {approvedCount: result.count};
    }
    const result = await prisma.transaction.updateMany({
      where: {
        branchId: branchID,
        companyId: companyID,
        approved: false,
        deleted: false,
      },
      data: {approved: true},
    });

    return {approvedCount: result.count};
  };

  updateTransaction = async ({
    transactionID,
    data,
  }: {
    transactionID: number;
    data: TransactionUpdateType;
  }) => {
    const {employeeID, reportID, branchID, ...rest} = data;

    return prisma.transaction.update({
      where: {id: transactionID},
      data: {
        ...rest,
        ...(employeeID && {employee: {connect: {id: employeeID}}}),
        ...(reportID && {report: {connect: {id: reportID}}}),
        ...(branchID && {branch: {connect: {id: branchID}}}),
      },
      select: transactionSelect,
    });
  };

  approveTransaction = async ({transactionID}: {transactionID: number}) => {
    return prisma.transaction.update({
      where: {id: transactionID},
      data: {approved: true},
      select: transactionSelect,
    });
  };

  deleteTransaction = async ({transactionID}: {transactionID: number}) => {
    return prisma.transaction.update({
      where: {id: transactionID},
      data: {deleted: true},
      select: {id: true},
    });
  };

  approveAllPendingTransactions = async () => {
    const result = await prisma.transaction.updateMany({
      where: {
        approved: false,
        deleted: false,
      },
      data: {approved: true},
    });

    await prisma.transaction.updateMany({
      where: {
        approvedforMain: false,
        deleted: false,
      },
      data: {approvedforMain: true},
    });
    return {approvedCount: result.count};
  };
}
