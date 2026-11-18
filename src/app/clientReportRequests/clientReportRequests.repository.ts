import {EmployeeRole, type Prisma} from "@prisma/client";
import {prisma} from "../../database/db";
import {AppError} from "../../lib/AppError";
import {Logger} from "../../lib/logger";
import type {loggedInUserType} from "../../types/user";
import {ClientLoansRepository} from "../clientLoans/clientLoans.repository";
import {sendNotification} from "../notifications/helpers/sendNotification";
import {ReportCreateOrdersFiltersSchema} from "../reports/reports.dto";
import {ReportsService} from "../reports/reports.service";
import type {
  ReportRequestCreateType,
  ReportRequestsListType,
} from "./clientReportRequests.dto";

const reportsService = new ReportsService();
const clientLoansRepository = new ClientLoansRepository();

// Same orders the dashboard puts in a delivered client report.
const REPORT_STATUSES = [
  "DELIVERED",
  "PARTIALLY_RETURNED",
  "REPLACED",
] as const;
const eligibleOrders = (clientId: number) =>
  ({
    clientId,
    deleted: false,
    confirmed: true,
    status: {in: [...REPORT_STATUSES]},
    hasDeliveredClientReport: false,
  }) satisfies Prisma.OrderWhereInput;

const requestSelect = {
  id: true,
  status: true,
  receiveMethod: true,
  note: true,
  ordersCount: true,
  clientNet: true,
  loansTotal: true,
  reviewedAt: true,
  rejectReason: true,
  reportIds: true,
  createdAt: true,
  client: {
    select: {
      id: true,
      user: {select: {name: true, phone: true}},
      branch: {select: {id: true, name: true}},
    },
  },
  reviewedBy: {select: {id: true, name: true}},
} satisfies Prisma.ClientReportRequestSelect;

type RequestRow = Prisma.ClientReportRequestGetPayload<{
  select: typeof requestSelect;
}>;

const requestReform = (request: RequestRow) => ({
  ...request,
  due: request.clientNet - request.loansTotal,
  client: {
    id: request.client.id,
    name: request.client.user.name,
    phone: request.client.user.phone,
    branch: request.client.branch,
  },
});

const formatAmount = (value: number) =>
  new Intl.NumberFormat("en-US").format(value);

export class ClientReportRequestsRepository {
  private clientID(user: loggedInUserType) {
    if (
      user.role !== "CLIENT" ||
      !user.companyID ||
      !Number.isInteger(user.id) ||
      user.id <= 0
    ) {
      throw new AppError("ليس مصرح لك القيام بهذا الفعل", 403);
    }
    return user.id;
  }

  /** Which requests an employee may review: the company, or only their branch's clients. */
  private reviewScope(
    user: loggedInUserType,
  ): Prisma.ClientReportRequestWhereInput {
    if (!user.companyID)
      throw new AppError("ليس مصرح لك القيام بهذا الفعل", 403);
    if (user.role === EmployeeRole.COMPANY_MANAGER || user.mainRepository) {
      return {companyId: user.companyID};
    }
    if (!user.branchId) throw new AppError("انت غير مرتبط بفرع", 403);
    return {companyId: user.companyID, client: {branchId: user.branchId}};
  }

  /** What the client would get now, and anything that stops a request. */
  getPreview = async (user: loggedInUserType) => {
    const clientId = this.clientID(user);
    const [orders, loans, unconfirmedReports, pending] = await Promise.all([
      prisma.order.aggregate({
        where: eligibleOrders(clientId),
        _count: {id: true},
        _sum: {clientNet: true, totalCost: true},
      }),
      clientLoansRepository.getOpenLoans(clientId),
      prisma.report.count({
        where: {
          type: "CLIENT",
          deleted: false,
          confirmed: false,
          clientReport: {secondaryType: "DELIVERED", clientId},
        },
      }),
      prisma.clientReportRequest.findFirst({
        where: {clientId, status: "PENDING"},
        select: requestSelect,
        orderBy: {id: "desc"},
      }),
    ]);
    const ordersCount = orders._count.id;
    const clientNet = orders._sum.clientNet ?? 0;
    const loansTotal = loans.total;

    // The first reason that blocks a new request, if any.
    const blockReason = pending
      ? "لديك طلب حساب قيد المراجعة"
      : unconfirmedReports > 0
        ? `يجب تأكيد استلام كشوفاتك السابقة أولاً (${unconfirmedReports})`
        : ordersCount === 0
          ? "لا توجد طلبات واصلة لعمل كشف حساب"
          : loansTotal > clientNet
            ? `سلفك المفتوحة (${formatAmount(loansTotal)}) أكبر من صافي حسابك (${formatAmount(clientNet)})`
            : null;

    return {
      ordersCount,
      totalCost: orders._sum.totalCost ?? 0,
      clientNet,
      loansTotal,
      due: clientNet - loansTotal,
      unconfirmedReports,
      pendingRequest: pending ? requestReform(pending) : null,
      canRequest: blockReason === null,
      blockReason,
    };
  };

  createRequest = async (
    user: loggedInUserType,
    data: ReportRequestCreateType,
  ) => {
    const clientId = this.clientID(user);
    const preview = await this.getPreview(user);
    if (!preview.canRequest)
      throw new AppError(preview.blockReason ?? "لا يمكن طلب حساب الآن", 400);

    const client = await prisma.client.findFirst({
      where: {id: clientId, deleted: false},
      select: {companyId: true, branchId: true, user: {select: {name: true}}},
    });
    if (!client) throw new AppError("العميل غير موجود", 404);

    const request = await prisma.clientReportRequest.create({
      data: {
        companyId: client.companyId,
        clientId,
        receiveMethod: data.receiveMethod,
        note: data.note ?? "",
        ordersCount: preview.ordersCount,
        clientNet: preview.clientNet,
        loansTotal: preview.loansTotal,
      },
      select: requestSelect,
    });

    void this.notifyReviewers(client, request.id, preview.ordersCount);
    return requestReform(request);
  };

  getMyRequests = async (user: loggedInUserType) => {
    const clientId = this.clientID(user);
    const requests = await prisma.clientReportRequest.findMany({
      where: {clientId},
      orderBy: {id: "desc"},
      take: 20,
      select: requestSelect,
    });
    return requests.map(requestReform);
  };

  cancelRequest = async (user: loggedInUserType, requestID: number) => {
    const clientId = this.clientID(user);
    const updated = await prisma.clientReportRequest.updateMany({
      where: {id: requestID, clientId, status: "PENDING"},
      data: {status: "CANCELLED"},
    });
    if (updated.count === 0) throw new AppError("لا يمكن إلغاء هذا الطلب", 400);
  };

  getRequests = async (
    user: loggedInUserType,
    filters: ReportRequestsListType,
  ) => {
    const where: Prisma.ClientReportRequestWhereInput = {
      ...this.reviewScope(user),
      status: filters.status,
      clientId: filters.client_id,
    };
    const [requests, count, pending] = await Promise.all([
      prisma.clientReportRequest.findMany({
        where,
        orderBy: {id: "desc"},
        skip: (filters.page - 1) * filters.size,
        take: filters.size,
        select: requestSelect,
      }),
      prisma.clientReportRequest.count({where}),
      prisma.clientReportRequest.count({
        where: {...this.reviewScope(user), status: "PENDING"},
      }),
    ]);
    return {
      page: filters.page,
      pagesCount: Math.max(1, Math.ceil(count / filters.size)),
      data: {requests: requests.map(requestReform), pendingCount: pending},
    };
  };

  /**
   * Approves a request by making the client's delivered report now, one per store,
   * through the regular report service (so loans, costs and treasury work as usual).
   */
  approveRequest = async (user: loggedInUserType, requestID: number) => {
    const request = await prisma.clientReportRequest.findFirst({
      where: {id: requestID, ...this.reviewScope(user)},
      select: {id: true, status: true, clientId: true, receiveMethod: true},
    });
    if (!request) throw new AppError("الطلب غير موجود", 404);

    // Claim it so two reviewers cannot approve the same request.
    const claimed = await prisma.clientReportRequest.updateMany({
      where: {id: request.id, status: "PENDING"},
      data: {status: "APPROVED", reviewedById: user.id, reviewedAt: new Date()},
    });
    if (claimed.count === 0)
      throw new AppError("تمت مراجعة هذا الطلب مسبقاً", 409);

    const receivingAgentId =
      request.receiveMethod === "RECEIVING_AGENT"
        ? await this.receivingAgentOf(request.clientId)
        : undefined;
    // Bigger stores first, so open loans are deducted from the report that can cover them.
    const stores = await prisma.order.groupBy({
      by: ["storeId"],
      where: eligibleOrders(request.clientId),
      _sum: {clientNet: true},
      orderBy: {_sum: {clientNet: "desc"}},
    });

    const reportIds: number[] = [];
    const failures: string[] = [];
    for (const store of stores) {
      try {
        const {reportID} = await reportsService.createReport({
          loggedInUser: user,
          reportData: {
            type: "CLIENT",
            secondaryType: "DELIVERED",
            clientID: request.clientId,
            storeID: store.storeId,
            receivingAgentId,
            ordersIDs: "*",
          },
          ordersFilters: ReportCreateOrdersFiltersSchema.parse({
            type: "CLIENT",
            clientID: request.clientId,
            storeID: store.storeId,
            statuses: REPORT_STATUSES.join(","),
            clientReport: "false",
            delivered: "true",
            confirmed: "true",
            sort: "branchId:asc",
            minified: false,
          }),
        });
        reportIds.push(reportID);
      } catch (error) {
        failures.push(
          error instanceof AppError ? error.message : "حدث خطأ اثناء عمل الكشف",
        );
        if (!(error instanceof AppError)) Logger.error(error);
      }
    }

    if (reportIds.length === 0) {
      // Nothing was made: put the request back for another try.
      await prisma.clientReportRequest.update({
        where: {id: request.id},
        data: {status: "PENDING", reviewedById: null, reviewedAt: null},
      });
      throw new AppError(failures[0] ?? "لا توجد طلبات لعمل الكشف", 400);
    }

    const approved = await prisma.clientReportRequest.update({
      where: {id: request.id},
      data: {reportIds},
      select: requestSelect,
    });
    void this.notifyClient(
      request.clientId,
      "تمت الموافقة على طلب الحساب",
      `تم إنشاء كشف الحساب رقم ${reportIds.join("، ")}`,
    );
    return {request: requestReform(approved), failures};
  };

  rejectRequest = async (
    user: loggedInUserType,
    requestID: number,
    reason: string,
  ) => {
    const request = await prisma.clientReportRequest.findFirst({
      where: {id: requestID, ...this.reviewScope(user)},
      select: {id: true, clientId: true},
    });
    if (!request) throw new AppError("الطلب غير موجود", 404);
    const updated = await prisma.clientReportRequest.updateMany({
      where: {id: request.id, status: "PENDING"},
      data: {
        status: "REJECTED",
        rejectReason: reason,
        reviewedById: user.id,
        reviewedAt: new Date(),
      },
    });
    if (updated.count === 0)
      throw new AppError("تمت مراجعة هذا الطلب مسبقاً", 409);
    void this.notifyClient(request.clientId, "تم رفض طلب الحساب", reason);
  };

  /** The client's receiving agent, when exactly one is assigned. */
  private async receivingAgentOf(clientId: number) {
    const agents = await prisma.receivingAgentClients.findMany({
      where: {
        clientId,
        receivingAgent: {role: "RECEIVING_AGENT", deleted: false},
      },
      select: {agentId: true},
      take: 2,
    });
    return agents.length === 1 ? agents[0].agentId : undefined;
  }

  private async notifyReviewers(
    client: {companyId: number; branchId: number | null; user: {name: string}},
    requestID: number,
    ordersCount: number,
  ) {
    try {
      const reviewers = await prisma.employee.findMany({
        where: {
          companyId: client.companyId,
          deleted: false,
          OR: [
            {role: "COMPANY_MANAGER"},
            ...(client.branchId
              ? [{role: EmployeeRole.BRANCH_MANAGER, branchId: client.branchId}]
              : []),
          ],
        },
        select: {id: true},
      });
      await Promise.all(
        reviewers.map((reviewer) =>
          sendNotification({
            userID: reviewer.id,
            title: "طلب حساب جديد",
            content: `طلب العميل ${client.user.name} كشف حساب (${ordersCount} طلب) - طلب رقم ${requestID}`,
          }),
        ),
      );
    } catch (error) {
      Logger.error(error);
    }
  }

  private async notifyClient(clientId: number, title: string, content: string) {
    try {
      await sendNotification({userID: clientId, title, content});
    } catch (error) {
      Logger.error(error);
    }
  }
}
