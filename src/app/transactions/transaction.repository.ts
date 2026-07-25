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

  getAllTransactionsPaginated = async ({
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
  }) => {
    const where = {
      companyId: companyID,
      branchId: branchID,
      employeeId: employeeID,
      type: type as never,
      approved: approved,
      deleted: deleted ?? false,
      ...((startDate || endDate) && {
        createdAt: {
          ...(startDate && {gte: startDate}),
          ...(endDate && {lte: endDate}),
        },
      }),
    };

    const [transactions, count] = await prisma.$transaction([
      prisma.transaction.findMany({
        skip: (page - 1) * size,
        take: size,
        where,
        orderBy: {createdAt: "desc"},
        select: transactionSelect,
      }),
      prisma.transaction.count({where}),
    ]);

    return {
      transactions,
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
          type: "DEPOSIT",
          companyId: filters.companyId,
          branchId: filters.branchId,
          approved: true,
          deleted: false,
        },
      }),

      prisma.transaction.aggregate({
        _sum: {paidAmount: true},
        where: {
          type: "WITHDRAW",
          companyId: filters.companyId,
          branchId: filters.branchId,
          approved: true,
          deleted: false,
        },
      }),

      prisma.order.aggregate({
        _sum: {paidAmount: true, deliveryAgentNet: true},
        _count: {id: true},
        where: {
          companyId: filters.companyId,
          deleted: false,
          confirmed: true,
          branchId: filters.branchId,
          deliveryAgentId: filters.deliveryAgentId,
          ...(createdAtFilter && {createdAt: createdAtFilter}),
          OR: [
            {deliveryAgentReport: {isNot: null}},
            {deliveryAgentReport: {report: {deleted: false}}},
          ],
          deliveryAgentReport: {report: {activeProfit: true}},
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
          branchId: filters.loggedInUser?.branchId,
          deliveryAgent: {
            branchId: filters.loggedInUser?.branchId,
          },
          ...(createdAtFilter && {createdAt: createdAtFilter}),
          OR: [
            {deliveryAgentReport: {is: null}},
            {deliveryAgentReport: {report: {deleted: true}}},
          ],
        },
      }),

      prisma.order.aggregate({
        _sum: {clientNet: true},
        _count: {id: true},
        where: {
          companyId: filters.loggedInUser?.companyID || undefined,
          deleted: false,
          confirmed: true,
          status: {in: ["DELIVERED", "PARTIALLY_RETURNED", "REPLACED"]},
          clientId: filters.clientId,
          client: {branchId: filters.loggedInUser?.branchId},
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
            client: {branchId: filters.loggedInUser?.branchId},
            secondaryType: "DELIVERED",
            report: {deleted: false, activeProfit: true},
          },
        },
      }),
      prisma.order.aggregate({
        _sum: {insideBranchNet: true},
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
                  approved: true,
                },
              },
            },
          },
        },
      }),
      prisma.order.aggregate({
        _sum: {forwardedBranchNet: true},
        _count: {id: true},
        where: {
          companyId: filters.companyId,
          deleted: false,
          confirmed: true,
          ...(createdAtFilter && {createdAt: createdAtFilter}),
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
        total: forClients._sum.clientNet,
        count: forClients._count.id,
      },
      paidToClients: {
        total: paidToClients._sum.clientNet,
        count:
          (paidToClients._sum.baghdadOrdersCount ?? 0) +
          (paidToClients._sum.governoratesOrdersCount ?? 0),
      },
      insideBranchNet: {
        total: insideBranchNet._sum.insideBranchNet,
        count: insideBranchNet._count.id,
      },
      receivedBranchNet: {
        total: receivedBranchNet._sum.receivingBranchNet,
        count: receivedBranchNet._count.id,
      },
      forwardedBranchNet: {
        total: forwardedBranchNet._sum.forwardedBranchNet,
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
          type: "DEPOSIT",
          companyId: filters.companyId,
          branchId: filters.branchId,
          approved: false,
          deleted: false,
        },
      }),

      prisma.transaction.aggregate({
        _sum: {paidAmount: true},
        where: {
          type: "WITHDRAW",
          companyId: filters.companyId,
          branchId: filters.branchId,
          approved: false,
          deleted: false,
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
              branchId: filters.loggedInUser?.branchId,
            },
          },
          transaction: {
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
          transaction: {
            approved: false,
          },
        },
      }),

      prisma.order.aggregate({
        _sum: {insideBranchNet: true},
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
                  approved: false,
                },
              },
            },
          },
        },
      }),
      prisma.order.aggregate({
        _sum: {forwardedBranchNet: true},
        _count: {id: true},
        where: {
          companyId: filters.companyId,
          deleted: false,
          confirmed: true,
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
      insideBranchNet: {
        total: insideBranchNet._sum.insideBranchNet,
        count: insideBranchNet._count.id,
      },
      receivedBranchNet: {
        total: receivedBranchNet._sum.receivingBranchNet,
        count: receivedBranchNet._count.id,
      },
      forwardedBranchNet: {
        total: forwardedBranchNet._sum.forwardedBranchNet,
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
  }: {
    branchID: number;
    companyID: number;
  }) => {
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

    return {approvedCount: result.count};
  };
}
