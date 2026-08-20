import {AdminRole, EmployeeRole, Governorate} from "@prisma/client";
import {AppError} from "../../lib/AppError";
import {catchAsync} from "../../lib/catchAsync";
import type {loggedInUserType} from "../../types/user";
import {
  TransactionCreateSchema,
  TransactionUpdateSchema,
} from "./transactions.dto";
import {TransactionsRepository} from "./transaction.repository";
import {prisma} from "../../database/db";

const transactionsRepository = new TransactionsRepository();

export class TransactionsController {
  createTransaction = catchAsync(async (req, res) => {
    const loggedInUser = res.locals.user as loggedInUserType;
    const data = TransactionCreateSchema.parse(req.body);

    let branchID = loggedInUser.branchId as number;
    const companyID = loggedInUser.companyID as number;

    if (!companyID) {
      throw new AppError("الشركة غير محددة", 400);
    }

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
      branchID = mainBranch?.branchId || loggedInUser.branchId;
    }

    const transaction = await transactionsRepository.createTransaction({
      companyID,
      createdByID: loggedInUser.id,
      data: {...data, branchID},
    });

    res.status(200).json({status: "success", data: transaction});
  });

  getProfitOrders = catchAsync(async (req, res) => {
    const loggedInUser = res.locals.user as loggedInUserType;

    let companyId: number;
    if (Object.keys(AdminRole).includes(loggedInUser.role)) {
      companyId = req.query.company_id
        ? +req.query.company_id
        : (loggedInUser.companyID as number);
    } else {
      companyId = loggedInUser.companyID as number;
    }

    const bucket = req.query.bucket as
      | "inside"
      | "received"
      | "forwarded"
      | undefined;

    if (!bucket || !["inside", "received", "forwarded"].includes(bucket)) {
      throw new AppError("نوع الأرباح غير صحيح", 400);
    }

    // resolve the branch the same way getAllDailyProfits does
    const targetBranch = req.query.targetBranch
      ? +req.query.targetBranch
      : undefined;

    const receivedBranch = req.query.receivedBranch
      ? +req.query.receivedBranch
      : undefined;

    const forwardedBranch = req.query.forwardedBranch
      ? +req.query.forwardedBranch
      : undefined;

    let myBranchId = loggedInUser.branchId;

    if (loggedInUser.role === EmployeeRole.BRANCH_MANAGER) {
      myBranchId = loggedInUser.branchId;
    } else if (loggedInUser.role === EmployeeRole.COMPANY_MANAGER) {
      const mainBranch = await prisma.repository.findFirst({
        where: {
          companyId: loggedInUser.companyID,
          mainRepository: true,
        },
        select: {branchId: true},
      });
      myBranchId = mainBranch?.branchId || loggedInUser?.branchId;
    }

    let applyBranchScope =
      (loggedInUser.role === "COMPANY_MANAGER" ||
        !!loggedInUser.mainRepository) &&
      !targetBranch;

    if (
      loggedInUser?.role === "COMPANY_MANAGER" &&
      loggedInUser.mainRepository &&
      targetBranch
    ) {
      myBranchId = targetBranch;
      applyBranchScope = false;
    }

    const startDay = req.query.start_day as string | undefined;
    const endDay = req.query.end_day as string | undefined;

    const clientId = req.query.client_id ? +req.query.client_id : undefined;
    const storeId = req.query.store_id ? +req.query.store_id : undefined;
    const deliveryAgentId = req.query.delivery_agent_id
      ? +req.query.delivery_agent_id
      : undefined;
    const governorate = req.query.governorate as Governorate | undefined;
    const receiptNumber = req.query.receipt_number as string | undefined;

    const size = req.query.size ? +req.query.size : 20;
    let page = 1;
    if (
      req.query.page &&
      !Number.isNaN(+req.query.page) &&
      +req.query.page > 0
    ) {
      page = +req.query.page;
    }

    const {orders, pagesCount, totals} =
      await transactionsRepository.getProfitOrders({
        companyId,
        myBranchId,
        bucket,
        applyBranchScope,
        startDay,
        endDay,
        page,
        size,
        clientId,
        storeId,
        deliveryAgentId,
        governorate,
        receiptNumber,
        receivedBranch,
        forwardedBranch,
      });

    res.status(200).json({
      status: "success",
      page,
      pagesCount,
      totals,
      data: orders,
    });
  });

  getAllTransactions = catchAsync(async (req, res) => {
    const loggedInUser = res.locals.user as loggedInUserType;

    let companyID: number | undefined;
    if (Object.keys(AdminRole).includes(loggedInUser.role)) {
      companyID = req.query.company_id ? +req.query.company_id : undefined;
    } else {
      companyID = loggedInUser.companyID as number;
    }

    const branchID = req.query.branch_id
      ? +req.query.branch_id
      : loggedInUser.branchId;
    const targetBranch = req.query.targetBranch
      ? +req.query.targetBranch
      : undefined;
    const employeeID = req.query.employee_id
      ? +req.query.employee_id
      : undefined;
    const type = req.query.type as string | undefined;
    const approved = req.query.approved
      ? req.query.approved === "true"
      : undefined;
    const deleted = req.query.deleted === "true";
    const startDate = req.query.start_date
      ? new Date(req.query.start_date as string)
      : undefined;
    const endDate = req.query.end_date
      ? new Date(req.query.end_date as string)
      : undefined;

    const size = req.query.size ? +req.query.size : 10;
    let page = 1;
    if (
      req.query.page &&
      !Number.isNaN(+req.query.page) &&
      +req.query.page > 0
    ) {
      page = +req.query.page;
    }

    const {transactions, pagesCount} =
      await transactionsRepository.getAllTransactionsPaginated(
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
          targetBranch,
        },
        loggedInUser,
      );

    res.status(200).json({
      status: "success",
      page,
      pagesCount,
      data: transactions,
    });
  });

  getAllDailyProfits = catchAsync(async (req, res) => {
    const loggedInUser = res.locals.user as loggedInUserType;

    let companyId: number;
    if (Object.keys(AdminRole).includes(loggedInUser.role)) {
      companyId = req.query.company_id
        ? +req.query.company_id
        : (loggedInUser.companyID as number);
    } else {
      companyId = loggedInUser.companyID as number;
    }

    // branch managers see only their own branch
    let branchId = req.query.branch_id ? +req.query.branch_id : undefined;
    const targetBranch = req.query.targetBranch
      ? +req.query.targetBranch
      : undefined;

    if (loggedInUser.role === EmployeeRole.BRANCH_MANAGER) {
      branchId = loggedInUser.branchId;
    } else if (loggedInUser.role === EmployeeRole.COMPANY_MANAGER) {
      const mainBranch = await prisma.repository.findFirst({
        where: {
          companyId: loggedInUser.companyID,
          mainRepository: true,
        },
        select: {
          branchId: true,
        },
      });
      branchId = mainBranch?.branchId || loggedInUser?.branchId;
    }

    if (
      loggedInUser?.role === "COMPANY_MANAGER" &&
      loggedInUser.mainRepository &&
      targetBranch
    ) {
      branchId = targetBranch;
    }
    const startDay = req.query.start_day as string | undefined;
    const endDay = req.query.end_day as string | undefined;

    const size = req.query.size ? +req.query.size : 30;
    let page = 1;
    if (
      req.query.page &&
      !Number.isNaN(+req.query.page) &&
      +req.query.page > 0
    ) {
      page = +req.query.page;
    }

    const {dailyProfits, pagesCount, totals} =
      await transactionsRepository.getAllDailyProfits({
        page,
        size,
        companyId,
        branchId,
        startDay,
        endDay,
      });

    res.status(200).json({
      status: "success",
      page,
      pagesCount,
      totals,
      data: dailyProfits,
    });
  });

  getTransaction = catchAsync(async (req, res) => {
    const transactionID = +req.params.transactionID;

    const transaction = await transactionsRepository.getTransaction({
      transactionID,
    });

    if (!transaction) {
      throw new AppError("العملية غير موجودة", 404);
    }

    res.status(200).json({status: "success", data: transaction});
  });

  getStatistics = catchAsync(async (req, res) => {
    const loggedInUser = res.locals.user as loggedInUserType;

    // Admins may query any company; everyone else is scoped to their own
    let companyId: number | undefined;
    if (Object.keys(AdminRole).includes(loggedInUser.role)) {
      companyId = req.query.company_id ? +req.query.company_id : undefined;
    } else {
      companyId = loggedInUser.companyID as number;
    }

    const deliveryAgentId = req.query.delivery_agent_id
      ? +req.query.delivery_agent_id
      : undefined;
    const clientId = req.query.client_id ? +req.query.client_id : undefined;
    const branchId = req.query.branch_id ? +req.query.branch_id : undefined;
    const type = req.query.type as string | undefined;
    const start_date = req.query.start_date as string | undefined;
    const end_date = req.query.end_date as string | undefined;
    const targetBranch = req.query.targetBranch
      ? +req.query.targetBranch
      : undefined;
    const statistics = await transactionsRepository.getStatistics({
      companyId,
      deliveryAgentId,
      clientId,
      branchId,
      type,
      start_date,
      end_date,
      targetBranch,
      loggedInUser,
    });

    res.status(200).json({
      status: "success",
      data: statistics,
    });
  });

  getDailyStatistics = catchAsync(async (req, res) => {
    const loggedInUser = res.locals.user as loggedInUserType;

    // Admins may query any company; everyone else is scoped to their own
    let companyId: number | undefined;
    if (Object.keys(AdminRole).includes(loggedInUser.role)) {
      companyId = req.query.company_id ? +req.query.company_id : undefined;
    } else {
      companyId = loggedInUser.companyID as number;
    }

    const deliveryAgentId = req.query.delivery_agent_id
      ? +req.query.delivery_agent_id
      : undefined;
    const clientId = req.query.client_id ? +req.query.client_id : undefined;
    const branchId = req.query.branch_id ? +req.query.branch_id : undefined;
    const type = req.query.type as string | undefined;
    const start_date = req.query.start_date as string | undefined;
    const end_date = req.query.end_date as string | undefined;
    const targetBranch = req.query.targetBranch
      ? +req.query.targetBranch
      : undefined;

    const statistics = await transactionsRepository.getDailyStatistics({
      companyId,
      deliveryAgentId,
      clientId,
      branchId,
      type,
      start_date,
      targetBranch,
      end_date,
      loggedInUser,
    });

    res.status(200).json({
      status: "success",
      data: statistics,
    });
  });

  getBranchrofit = catchAsync(async (req, res) => {
    const loggedInUser = res.locals.user as loggedInUserType;

    // Admins may query any company; everyone else is scoped to their own
    let companyId: number | undefined;
    if (Object.keys(AdminRole).includes(loggedInUser.role)) {
      companyId = req.query.company_id ? +req.query.company_id : undefined;
    } else {
      companyId = loggedInUser.companyID as number;
    }

    const deliveryAgentId = req.query.delivery_agent_id
      ? +req.query.delivery_agent_id
      : undefined;
    const clientId = req.query.client_id ? +req.query.client_id : undefined;
    const branchId = req.query.branch_id ? +req.query.branch_id : undefined;
    const type = req.query.type as string | undefined;
    const start_date = req.query.start_date as string | undefined;
    const end_date = req.query.end_date as string | undefined;
    const targetBranch = req.query.targetBranch
      ? +req.query.targetBranch
      : undefined;

    const statistics = await transactionsRepository.getDailyProfit({
      companyId,
      deliveryAgentId,
      clientId,
      branchId,
      type,
      start_date,
      end_date,
      targetBranch,
      loggedInUser,
    });

    res.status(200).json({
      status: "success",
      data: {
        today: statistics.today,
      },
    });
  });

  updateTransaction = catchAsync(async (req, res) => {
    const transactionID = +req.params.transactionID;
    const data = TransactionUpdateSchema.parse(req.body);

    const transaction = await transactionsRepository.updateTransaction({
      transactionID,
      data,
    });

    res.status(200).json({status: "success", data: transaction});
  });

  approveTransaction = catchAsync(async (req, res) => {
    const transactionID = +req.params.transactionID;

    const transaction = await transactionsRepository.approveTransaction({
      transactionID,
    });

    res.status(200).json({status: "success", data: transaction});
  });

  approveAllBranchTransactions = catchAsync(async (_req, res) => {
    const loggedInUser = res.locals.user as loggedInUserType;

    const branchID = loggedInUser.branchId;
    if (!branchID) {
      throw new AppError("لا يوجد فرع مرتبط بهذا المستخدم", 400);
    }

    const companyID = loggedInUser.companyID as number;
    if (!companyID) {
      throw new AppError("الشركة غير محددة", 400);
    }

    const {approvedCount} =
      await transactionsRepository.approveAllBranchTransactions({
        branchID,
        companyID,
        loggedInUser,
      });

    res.status(200).json({
      status: "success",
      data: {approvedCount},
    });
  });

  deleteTransaction = catchAsync(async (req, res) => {
    const transactionID = +req.params.transactionID;

    await transactionsRepository.deleteTransaction({transactionID});

    res.status(200).json({status: "success"});
  });
}
