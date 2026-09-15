import {Prisma, ReportType} from "@prisma/client";
import {prisma} from "../../database/db";
import {AppError} from "../../lib/AppError";
import type {loggedInUserType} from "../../types/user";
import type {
  ReportCreateType,
  ReportUpdateType,
  ReportsFiltersType,
} from "./reports.dto";
import {
  AllreportReform,
  AllreportSelect,
  reportReform,
  reportSelect,
} from "./reports.responses";
import {recomputeReportFlags} from "../orders/helpers/recomputeReportFlags";

export class ReportsRepository {
  async createReport(data: {
    loggedInUser: loggedInUserType;
    reportData: ReportCreateType & {ordersIDs: string[]};
    type?: string;
    // TODO: Make reportMetaData a type
    reportMetaData: {
      totalCost: number;
      paidAmount: number;
      deliveryCost: number;
      baghdadOrdersCount: number;
      governoratesOrdersCount: number;
      clientNet: number;
      deliveryAgentNet: number;
      companyNet: number;
      branchNet: number;
    };
  }) {
    const orders = {
      connect: data.reportData.ordersIDs.map((orderID) => {
        return {
          id: orderID,
        };
      }),
    };

    const report = {
      create: {
        type: data.reportData.type,
        createdBy: {
          connect: {
            id: data.loggedInUser.id,
          },
        },
        company: {
          connect: {
            // TODO: Is it always number ?
            id: data.loggedInUser.companyID as number,
          },
        },
        baghdadOrdersCount: data.reportMetaData.baghdadOrdersCount,
        governoratesOrdersCount: data.reportMetaData.governoratesOrdersCount,
        totalCost: data.reportMetaData.totalCost,
        paidAmount: data.reportMetaData.paidAmount,
        deliveryCost: data.reportMetaData.deliveryCost,
        clientNet: data.reportMetaData.clientNet,
        deliveryAgentNet: data.reportMetaData.deliveryAgentNet,
        companyNet: data.reportMetaData.companyNet,
        branchNet: data.reportMetaData.branchNet,
        activeProfit: true,
      },
    };

    if (data.reportData.type === ReportType.CLIENT) {
      const reportData = data.reportData;
      const ordersIDs = [...new Set(reportData.ordersIDs)];
      const companyId = data.loggedInUser.companyID;
      // Matches both ReportCreateSchema and ClientReport's database default.
      const secondaryType = reportData.secondaryType ?? "DELIVERED";

      if (ordersIDs.length === 0) {
        throw new AppError("لا يوجد طلبات لعمل الكشف", 400);
      }
      if (
        typeof companyId !== "number" ||
        !Number.isSafeInteger(companyId) ||
        companyId < 1
      ) {
        throw new AppError("لم يتم تحديد الشركة", 400);
      }

      return prisma.$transaction(
        async (tx) => {
          // All CLIENT-report creation paths must acquire these locks first.
          // Fixed ordering reduces deadlocks when batches overlap.
          // text[] matches the Order ID cast already used by recomputeReportFlags.
          const lockedOrders = await tx.$queryRaw<{id: string}[]>(Prisma.sql`
        SELECT o."id"
        FROM "Order" o
        WHERE o."id" = ANY(${ordersIDs}::text[])
          AND o."companyId" = ${companyId}
        ORDER BY o."id"
        FOR UPDATE OF o
      `);

          if (lockedOrders.length !== ordersIDs.length) {
            throw new AppError("بعض الطلبات غير موجودة أو لا تتبع الشركة", 400);
          }

          // Read again AFTER acquiring locks. Do not reuse the service's old orders.
          const existingReport = await tx.clientReport.findFirst({
            where: {
              secondaryType,
              orders: {some: {id: {in: ordersIDs}}},
              report: {
                deleted: false,
              },
            },
            select: {
              id: true,
              orders: {
                where: {id: {in: ordersIDs}},
                select: {receiptNumber: true},
                take: 1,
              },
            },
          });

          if (existingReport) {
            const receipt = existingReport.orders[0]?.receiptNumber ?? "";
            const label = secondaryType === "RETURNED" ? "راجع" : "واصل";
            throw new AppError(
              `الطلب ${receipt} يوجد في كشف عملاء ${label} آخر رقمه ${existingReport.id}`,
              409,
            );
          }

          const createdReport = await tx.clientReport.create({
            data: {
              secondaryType,
              client: {connect: {id: reportData.clientID}},
              store: {connect: {id: reportData.storeID}},
              repository: reportData.repositoryID
                ? {connect: {id: reportData.repositoryID}}
                : undefined,
              orders: {connect: ordersIDs.map((id) => ({id}))},
              baghdadDeliveryCost: reportData.baghdadDeliveryCost,
              governoratesDeliveryCost: reportData.governoratesDeliveryCost,
              receivingAgentId: reportData.receivingAgentId,
              report,
            },
          });

          await recomputeReportFlags(
            Prisma.sql`o."id" = ANY(${ordersIDs}::text[])`,
            tx,
          );

          return createdReport;
        },
        {
          // The query after waiting for a row lock must see the latest commit.
          isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
          timeout: 30000,
        },
      );
    }

    // ---------- REPOSITORY (no flags) ----------
    if (data.reportData.type === ReportType.REPOSITORY) {
      const createdReport = await prisma.repositoryReport.create({
        data: {
          secondaryType: data.reportData.secondaryType,
          targetRepositoryId: data.reportData.targetRepositoryId,
          targetRepositoryName: data.reportData.repositoryName,
          repository: {
            connect: {
              id: data.reportData.repositoryID,
            },
          },
          orders: orders,
          report: report,
        },
      });
      return createdReport;
    }

    // ---------- BRANCH (has flags) ----------
    if (data.reportData.type === ReportType.BRANCH) {
      const reportData = data.reportData;
      const ordersIDs = data.reportData.ordersIDs;
      const branchReportType = data.type;

      return prisma.$transaction(
        async (tx) => {
          const createdReport = await tx.branchReport.create({
            data: {
              branch: {
                connect: {
                  id: reportData.branchID,
                },
              },
              orders: orders,
              baghdadDeliveryCost: reportData.baghdadDeliveryCost,
              governoratesDeliveryCost: reportData.governoratesDeliveryCost,
              report: report,
              forChildBranches: reportData.forChilds,
              type: branchReportType,
            },
          });

          await recomputeReportFlags(
            Prisma.sql`o."id" = ANY(${ordersIDs}::text[])`,
            tx,
          );

          return createdReport;
        },
        {timeout: 30000},
      );
    }

    // ---------- DELIVERY_AGENT (no flags) ----------
    if (data.reportData.type === ReportType.DELIVERY_AGENT) {
      const createdReport = await prisma.deliveryAgentReport.create({
        data: {
          deliveryAgent: {
            connect: {
              id: data.reportData.deliveryAgentID,
            },
          },
          orders: orders,
          deliveryAgentDeliveryCost: data.reportData.deliveryAgentDeliveryCost,
          report: report,
        },
      });
      return createdReport;
    }

    // ---------- GOVERNORATE (no flags) ----------
    if (data.reportData.type === ReportType.GOVERNORATE) {
      const createdReport = await prisma.governorateReport.create({
        data: {
          governorate: data.reportData.governorate,
          orders: orders,
          baghdadDeliveryCost: data.reportData.baghdadDeliveryCost,
          governoratesDeliveryCost: data.reportData.governoratesDeliveryCost,
          report: report,
        },
      });
      return createdReport;
    }

    // ---------- COMPANY (no flags) ----------
    if (data.reportData.type === ReportType.COMPANY) {
      const createdReport = await prisma.companyReport.create({
        data: {
          secondaryType: data.reportData.secondaryType,
          company: {
            connect: {
              id: data.reportData.companyID,
            },
          },
          repository: data.reportData.repositoryID
            ? {
                connect: {
                  id: data.reportData.repositoryID,
                },
              }
            : undefined,
          orders: orders,
          baghdadDeliveryCost: data.reportData.baghdadDeliveryCost,
          governoratesDeliveryCost: data.reportData.governoratesDeliveryCost,
          report: report,
        },
      });
      return createdReport;
    }

    throw new AppError("Invalid report type", 400);
  }

  async getAllReportsPaginated(data: {filters: ReportsFiltersType}) {
    let startDate = new Date();
    let endDate = new Date();
    if (data.filters.startDate) {
      startDate = new Date(data.filters.startDate);
      startDate.setHours(0, 0, 0, 0);
    }
    if (data.filters.endDate) {
      endDate = new Date(data.filters.endDate);
      endDate.setHours(23, 59, 59, 59);
    }

    const where = {
      AND: [
        {
          OR: [
            {
              deliveryAgentReport: data.filters.branch
                ? {
                    orders: {
                      some: {
                        branch: {
                          id: data.filters.branch,
                        },
                      },
                    },
                  }
                : undefined,
            },
            {
              clientReport: data.filters.branch
                ? {
                    secondaryType: data.filters.secondaryType,
                    client: {
                      branch: {
                        id: data.filters.branch,
                      },
                    },
                  }
                : undefined,
            },
            {
              repositoryReport: data.filters.branch
                ? {
                    orders: {
                      some: {
                        branch: {
                          id: data.filters.branch,
                        },
                      },
                    },
                  }
                : undefined,
            },
            {
              branchReport: data.filters.branch
                ? {
                    branch: {
                      parentBranchId: data.filters.branch,
                    },
                  }
                : undefined,
            },
            {
              deliveryAgentReport: data.filters.branch
                ? {
                    deliveryAgent: {
                      branch: {
                        parentBranchId: data.filters.branch,
                      },
                    },
                  }
                : undefined,
            },
            {
              deliveryAgentReport: data.filters.branch
                ? {
                    deliveryAgent: {
                      branch: {
                        id: data.filters.branch,
                      },
                    },
                  }
                : undefined,
            },
          ],
        },
        {
          createdAt: data.filters.startDate
            ? {
                gt: startDate,
              }
            : undefined,
        },
        // Filter by endDate
        {
          createdAt: data.filters.endDate
            ? {
                lte: endDate,
              }
            : undefined,
        },
        {
          clientReport: {
            clientId: data.filters.clientID,
          },
        },
        {
          clientReport: data.filters.forMainClients
            ? {
                client: {
                  branch: {
                    repositories: {
                      some: {
                        mainRepository: true,
                      },
                    },
                  },
                },
              }
            : undefined,
        },
        {
          clientReport:
            data.filters.type === "CLIENT"
              ? {
                  secondaryType: data.filters.secondaryType,
                }
              : undefined,
        },
        {
          clientReport: {
            storeId: data.filters.storeID,
          },
        },
        {
          repositoryReport:
            data.filters.type === "REPOSITORY"
              ? {
                  secondaryType: data.filters.secondaryType,
                  orders: {
                    some: {},
                  },
                  repositoryId: data.filters.exported_repository_id,
                  targetRepositoryId: data.filters.target_repository_id,
                  OR: [
                    {repositoryId: data.filters.repositoryID},
                    {targetRepositoryId: data.filters.repositoryID},
                  ],
                }
              : undefined,
        },
        {
          branchReport: {
            branchId: data.filters.branchID,
          },
        },
        {
          deliveryAgentReport:
            data.filters.type !== "EMPLOYEE" && data.filters.deliveryAgentID
              ? {
                  deliveryAgentId: data.filters.deliveryAgentID,
                }
              : undefined,
        },
        {
          employeeReport:
            data.filters.type === "EMPLOYEE"
              ? {
                  employeeId: data.filters.deliveryAgentID,
                }
              : undefined,
        },
        {
          governorateReport: {
            governorate: data.filters.governorate,
          },
        },
        {
          // TODO: fix this: Report type filter vs company filter
          companyReport: data.filters.companyID
            ? {
                companyId: data.filters.companyID,
              }
            : undefined,
        },
        {
          companyReport: {
            secondaryType:
              data.filters.type === "COMPANY"
                ? data.filters.secondaryType
                : undefined,
          },
        },
        {
          status: data.filters.status,
        },
        {
          type: data.filters.type,
        },
        {
          type: {in: data.filters.types},
        },
        {
          deleted: data.filters.deleted,
        },
        {
          OR: [
            {
              company: {
                id: data.filters.company,
              },
              clientReport:
                data.filters.type === "CLIENT"
                  ? {
                      secondaryType: data.filters.secondaryType,
                    }
                  : undefined,
            },
            {
              companyReport: {
                companyId: data.filters.company,
              },
            },
          ],
        },

        {
          createdBy: {
            id: data.filters.createdByID,
          },
        },
      ],
    } satisfies Prisma.ReportWhereInput;

    if (data.filters.minified === true) {
      const paginatedReports = await prisma.report.findManyPaginated(
        {
          where: where,
          select: {
            id: true,
          },
        },
        {
          page: data.filters.page,
          size: data.filters.size,
          withCount: true,
        },
      );
      return {
        reports: {
          reports: paginatedReports.data,
          pagesCount: paginatedReports.pagesCount,
        },
      };
    }

    const paginatedReports = await prisma.report.findManyPaginated(
      {
        where: where,
        orderBy: {
          [data.filters.sort.split(":")[0]]:
            data.filters.sort.split(":")[1] === "desc" ? "desc" : "asc",
        },
        select: AllreportSelect,
      },
      {
        page: data.filters.page,
        withCount: true,
        size: data.filters.size,
      },
    );

    const reportsReformed = paginatedReports.data.map((report) =>
      AllreportReform(report),
    );

    const reportsMetaData = await prisma.report.aggregate({
      where: {
        ...where,
        OR:
          data.filters.type === "CLIENT"
            ? [
                {
                  clientReport: {
                    secondaryType: "DELIVERED",
                  },
                },
              ]
            : undefined,
      },
      _count: {
        id: true,
      },
      _sum: {
        totalCost: true,
        paidAmount: true,
        deliveryCost: true,
        baghdadOrdersCount: true,
        governoratesOrdersCount: true,
        clientNet: true,
        deliveryAgentNet: true,
        companyNet: true,
      },
    });

    const reportsMetaDataReformed = {
      reportsCount: reportsMetaData._count.id,
      totalCost: reportsMetaData._sum.totalCost,
      paidAmount: reportsMetaData._sum.paidAmount,
      deliveryCost: reportsMetaData._sum.deliveryCost,
      baghdadOrdersCount: reportsMetaData._sum.baghdadOrdersCount,
      governoratesOrdersCount: reportsMetaData._sum.governoratesOrdersCount,
      clientNet: reportsMetaData._sum.clientNet,
      deliveryAgentNet: reportsMetaData._sum.deliveryAgentNet,
      companyNet: reportsMetaData._sum.companyNet,
    };

    return {
      reports: reportsReformed,
      reportsMetaData: reportsMetaDataReformed,
      pagesCount: paginatedReports.pagesCount,
    };

    // return reports.map((report) => reportReform(report));
  }

  async getReportsByIDs(data: {reportsIDs: number[]}) {
    const reports = await prisma.report.findMany({
      where: {
        id: {
          in: data.reportsIDs,
        },
      },
      orderBy: {
        id: "asc",
      },
      select: reportSelect,
    });
    return reports.map(reportReform);
  }

  async getReport(data: {reportID: number}) {
    const report = await prisma.report.findUnique({
      where: {
        id: data.reportID,
      },
      select: reportSelect,
    });
    return reportReform(report);
  }

  async updateReport(data: {reportID: number; reportData: ReportUpdateType}) {
    const report = await prisma.report.update({
      where: {
        id: data.reportID,
      },
      data: {
        status: data.reportData.status,
        confirmed: data.reportData.confirmed,
        repositoryReport: data.reportData.repositoryID
          ? {
              update: {
                repositoryId: data.reportData.repositoryID,
              },
            }
          : undefined,
      },
      select: reportSelect,
    });

    if (data.reportData.repositoryID) {
      const repository = await prisma.repository.findUnique({
        where: {
          id: data.reportData.repositoryID,
        },
        select: {
          branchId: true,
        },
      });
      const orders = await prisma.order.findMany({
        where: {
          repositoryReport: {
            some: {
              id: data.reportID,
            },
          },
        },
        select: {
          id: true,
        },
      });
      orders.forEach(async (order) => {
        await prisma.order.update({
          where: {
            id: order.id,
          },
          data: {
            repositoryId: data.reportData.repositoryID,
            branchId: repository?.branchId,
          },
        });
      });
    }
    if (
      report.clientReport &&
      report.clientReport.secondaryType === "RETURNED" &&
      data.reportData.confirmed
    ) {
      await prisma.order.updateMany({
        where: {
          clientReport: {
            some: {
              id: report.clientReport.id,
            },
          },
          status: {in: ["PARTIALLY_RETURNED", "REPLACED", "RETURNED"]},
        },
        data: {
          secondaryStatus: "WITH_CLIENT",
        },
      });
    }
    return reportReform(report);
  }

  async deleteReport(data: {reportID: number}) {
    const deletedReport = await prisma.report.delete({
      where: {
        id: data.reportID,
      },
      select: reportSelect,
    });
    return reportReform(deletedReport);
  }

  async deactivateReport(data: {reportID: number; deletedByID: number}) {
    const report = await prisma.report.findUnique({
      where: {id: data.reportID},
      select: reportSelect,
    });

    if (
      (report?.type === "CLIENT" &&
        report.clientReport?.secondaryType === "RETURNED") ||
      (report?.type === "REPOSITORY" &&
        report.repositoryReport?.secondaryType === "RETURNED")
    ) {
      if (report?.type === "REPOSITORY") {
        await prisma.order.updateMany({
          where: {
            repositoryReport: {some: {id: report.repositoryReport?.id}},
          },
          data: {
            repositoryId: report.repositoryReport?.repository.id,
            secondaryStatus: "IN_REPOSITORY",
          },
        });
      }
      if (report?.type === "CLIENT" && report.confirmed === false) {
        await prisma.order.updateMany({
          where: {
            clientReport: {some: {id: report.clientReport?.id}},
          },
          data: {
            repositoryId: report.clientReport?.repository?.id,
            secondaryStatus: "IN_REPOSITORY",
          },
        });
      }
    }

    const needsFlagSync =
      report?.type === "CLIENT" || report?.type === "BRANCH";

    const deletedReport = await prisma.$transaction(
      async (tx) => {
        const updated = await tx.report.update({
          where: {id: data.reportID},
          data: {
            deleted: true,
            deletedById: data.deletedByID,
            deletedAt: new Date(),
          },
          select: reportSelect,
        });

        await tx.transaction.updateMany({
          where: {reportId: updated.id},
          data: {deleted: true},
        });

        // recompute flags AFTER deleted=true so EXISTS sees the new state
        if (needsFlagSync) {
          const joinTable =
            report?.type === "CLIENT"
              ? Prisma.sql`"_ClientReportToOrder"`
              : Prisma.sql`"_BranchReportToOrder"`;

          await recomputeReportFlags(
            Prisma.sql`o."id" IN (
            SELECT "B" FROM ${joinTable} WHERE "A" = ${data.reportID}
          )`,
            tx,
          );
        }

        return updated;
      },
      {timeout: 30000},
    );

    return reportReform(deletedReport);
  }

  async reactivateReport(data: {reportID: number}) {
    const report = await prisma.report.findUnique({
      where: {id: data.reportID},
      select: {type: true},
    });

    const needsFlagSync =
      report?.type === "CLIENT" || report?.type === "BRANCH";

    const restoredReport = await prisma.$transaction(
      async (tx) => {
        const updated = await tx.report.update({
          where: {id: data.reportID},
          data: {deleted: false},
          select: reportSelect,
        });

        await tx.transaction.updateMany({
          where: {reportId: updated.id},
          data: {deleted: false},
        });

        if (needsFlagSync) {
          const joinTable =
            report?.type === "CLIENT"
              ? Prisma.sql`"_ClientReportToOrder"`
              : Prisma.sql`"_BranchReportToOrder"`;

          await recomputeReportFlags(
            Prisma.sql`o."id" IN (
            SELECT "B" FROM ${joinTable} WHERE "A" = ${data.reportID}
          )`,
            tx,
          );
        }

        return updated;
      },
      {timeout: 30000},
    );

    return reportReform(restoredReport);
  }
}
