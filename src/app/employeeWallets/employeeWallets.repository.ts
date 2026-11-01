import {EmployeeRole, Prisma} from "@prisma/client";
import {prisma} from "../../database/db";
import {AppError} from "../../lib/AppError";
import type {loggedInUserType} from "../../types/user";
import {transactionSelect} from "../transactions/transactions.responses";
import type {
  EmployeeWalletCreateType,
  EmployeeWalletListType,
  EmployeeWalletTargetsType,
  EmployeeWalletTransactionCreateType,
  EmployeeWalletTransactionsExportType,
  EmployeeWalletTransactionsType,
  EmployeeWalletUpdateType,
} from "./employeeWallets.dto";
import {employeeWalletSelect} from "./employeeWallets.responses";

const walletTransactionSelect = {
  ...transactionSelect,
  employeeWalletId: true,
  approved: true,
  branchId: true,
  targetBranchId: true,
  targetClientId: true,
  targetBranch: {select: {id: true, name: true}},
  targetClient: {select: {id: true, user: {select: {name: true}}}},
} satisfies Prisma.TransactionSelect;

export class EmployeeWalletsRepository {
  private scope(user: loggedInUserType, branchID?: number) {
    if (
      !user.companyID ||
      ![EmployeeRole.COMPANY_MANAGER, EmployeeRole.BRANCH_MANAGER].some(
        (role) => role === user.role,
      ) ||
      (user.role === "COMPANY_MANAGER" && !user.showTreatury)
    ) {
      throw new AppError("ليس مصرح لك القيام بهذا الفعل", 403);
    }

    if (user.role === EmployeeRole.BRANCH_MANAGER) {
      if (
        !user.branchId ||
        (branchID !== undefined && branchID !== user.branchId)
      ) {
        throw new AppError("ليس مصرح لك بإدارة محافظ هذا الفرع", 403);
      }
      return {companyId: user.companyID, branchId: user.branchId};
    }

    return {companyId: user.companyID, branchId: branchID};
  }

  private ownScope(user: loggedInUserType): Prisma.EmployeeWalletWhereInput {
    if (
      !user.companyID ||
      !Number.isInteger(user.id) ||
      user.id <= 0 ||
      ["ADMIN", "ADMIN_ASSISTANT", "CLIENT"].includes(user.role)
    ) {
      throw new AppError("ليس مصرح لك بعرض هذه القاصة", 403);
    }
    return {
      companyId: user.companyID,
      employeeId: user.id,
      employee: {is: {id: user.id, companyId: user.companyID, deleted: false}},
    };
  }

  getOwnWallets = async (user: loggedInUserType) =>
    prisma.employeeWallet.findMany({
      where: this.ownScope(user),
      select: employeeWalletSelect,
      orderBy: {id: "desc"},
    });

  private getOwnWallet = async (
    user: loggedInUserType,
    walletID: number,
    findWallet: (
      where: Prisma.EmployeeWalletWhereInput,
    ) => Promise<Prisma.EmployeeWalletGetPayload<{
      select: typeof employeeWalletSelect;
    }> | null> = async (where) =>
      prisma.employeeWallet.findFirst({where, select: employeeWalletSelect}),
  ) => {
    const wallet = await findWallet({id: walletID, ...this.ownScope(user)});
    if (!wallet)
      throw new AppError("القاصة غير موجودة أو غير مرتبطة بحسابك", 404);
    return wallet;
  };

  getOwnWalletFilters = async (user: loggedInUserType, walletID: number) => {
    const wallet = await this.getOwnWallet(user, walletID);
    const where = this.transactionWhere(wallet, {});
    const [branchRows, clientRows] = await Promise.all([
      prisma.transaction.findMany({
        where: {...where, targetBranchId: {not: null}},
        distinct: ["targetBranchId"],
        select: {targetBranch: {select: {id: true, name: true}}},
      }),
      prisma.transaction.findMany({
        where: {...where, targetClientId: {not: null}},
        distinct: ["targetClientId"],
        select: {
          targetClient: {select: {id: true, user: {select: {name: true}}}},
        },
      }),
    ]);
    return {
      branches: branchRows.flatMap((row) =>
        row.targetBranch ? [row.targetBranch] : [],
      ),
      clients: clientRows.flatMap((row) =>
        row.targetClient
          ? [{id: row.targetClient.id, name: row.targetClient.user.name}]
          : [],
      ),
    };
  };

  getOwnWalletTargets = async (
    user: loggedInUserType,
    walletID: number,
    filters: EmployeeWalletTargetsType,
  ) => {
    const wallet = await this.getOwnWallet(user, walletID);
    const {kind, search, page, size} = filters;
    if (kind === "branch") {
      const where: Prisma.BranchWhereInput = {
        companyId: wallet.companyId,
        name: search ? {contains: search, mode: "insensitive"} : undefined,
      };
      const [data, count] = await Promise.all([
        prisma.branch.findMany({
          where,
          select: {id: true, name: true},
          orderBy: {id: "asc"},
          skip: (page - 1) * size,
          take: size,
        }),
        prisma.branch.count({where}),
      ]);
      return {data, page, pagesCount: Math.ceil(count / size)};
    }
    const where: Prisma.ClientWhereInput = {
      companyId: wallet.companyId,
      deleted: false,
      user: search
        ? {name: {contains: search, mode: "insensitive"}}
        : undefined,
    };
    const [clients, count] = await Promise.all([
      prisma.client.findMany({
        where,
        select: {id: true, user: {select: {name: true}}},
        orderBy: {id: "asc"},
        skip: (page - 1) * size,
        take: size,
      }),
      prisma.client.count({where}),
    ]);
    return {
      data: clients.map((client) => ({id: client.id, name: client.user.name})),
      page,
      pagesCount: Math.ceil(count / size),
    };
  };

  createOwnTransaction = async (
    user: loggedInUserType,
    walletID: number,
    data: EmployeeWalletTransactionCreateType,
  ) => {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const wallet = await this.getOwnWallet(
            user,
            walletID,
            async (where) =>
              tx.employeeWallet.findFirst({
                where,
                select: employeeWalletSelect,
              }),
          );
          if (data.targetBranchId) {
            const branch = await tx.branch.findFirst({
              where: {id: data.targetBranchId, companyId: wallet.companyId},
              select: {id: true},
            });
            if (!branch)
              throw new AppError("الفرع المستهدف غير موجود في هذه الشركة", 400);
          }
          if (data.targetClientId) {
            const client = await tx.client.findFirst({
              where: {
                id: data.targetClientId,
                companyId: wallet.companyId,
                deleted: false,
              },
              select: {id: true},
            });
            if (!client)
              throw new AppError(
                "العميل المستهدف غير موجود في هذه الشركة",
                400,
              );
          }
          return tx.transaction.create({
            data: {
              type: data.type,
              for: data.for,
              paidAmount: data.paidAmount,
              targetBranchId: data.targetBranchId,
              targetClientId: data.targetClientId,
              employeeWalletId: wallet.id,
              companyId: wallet.companyId,
              branchId: wallet.branchId,
              employeeId: user.id,
              createdById: user.id,
              forWallets: true,
              approved: false,
              approvedforMain: false,
            },
            select: walletTransactionSelect,
          });
        },
        {isolationLevel: Prisma.TransactionIsolationLevel.Serializable},
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034"
      ) {
        throw new AppError(
          "تم تغيير بيانات المحفظة، يرجى التحديث والمحاولة مرة أخرى",
          409,
        );
      }
      throw error;
    }
  };

  private async validateAssignment(
    companyId: number,
    branchId: number,
    employeeId?: number | null,
  ) {
    const branch = await prisma.branch.findFirst({
      where: {id: branchId, companyId},
      select: {id: true},
    });
    if (!branch) throw new AppError("الفرع غير موجود في هذه الشركة", 400);

    if (employeeId !== undefined && employeeId !== null) {
      const employee = await prisma.employee.findFirst({
        where: {id: employeeId, companyId, branchId, deleted: false},
        select: {id: true},
      });
      if (!employee) throw new AppError("الموظف غير موجود في هذا الفرع", 400);
    }
  }

  createWallet = async (
    user: loggedInUserType,
    data: EmployeeWalletCreateType,
  ) => {
    const branchId = user.branchId;
    const scope = this.scope(user, branchId);

    if (!branchId) throw new AppError("يجب تحديد الفرع", 400);

    await this.validateAssignment(scope.companyId, branchId, data.employeeID);

    return prisma.employeeWallet.create({
      data: {
        companyId: scope.companyId,
        branchId,
        employeeId: data.employeeID,
        createdById: user.id,
      },
      select: employeeWalletSelect,
    });
  };

  getWallets = async (
    user: loggedInUserType,
    filters: EmployeeWalletListType,
  ) => {
    const {page, size, branch_id, employee_id} = filters;
    const where: Prisma.EmployeeWalletWhereInput = {
      ...this.scope(user, branch_id),
      employeeId: employee_id,
    };
    const [data, count] = await Promise.all([
      prisma.employeeWallet.findMany({
        where,
        select: employeeWalletSelect,
        orderBy: {id: "desc"},
        skip: (page - 1) * size,
        take: size,
      }),
      prisma.employeeWallet.count({where}),
    ]);
    return {data, count, page, pagesCount: Math.ceil(count / size)};
  };

  getWallet = async (user: loggedInUserType, walletID: number) => {
    const wallet = await prisma.employeeWallet.findFirst({
      where: {id: walletID, ...this.scope(user)},
      select: employeeWalletSelect,
    });
    if (!wallet) throw new AppError("محفظة الموظف غير موجودة", 404);
    return wallet;
  };

  updateWallet = async (
    user: loggedInUserType,
    walletID: number,
    data: EmployeeWalletUpdateType,
  ) => {
    const wallet = await this.getWallet(user, walletID);
    const branchId = wallet.branchId;
    const employeeId =
      data.employeeID === undefined ? wallet.employeeId : data.employeeID;
    const scope = this.scope(user, branchId);
    const reassigning =
      branchId !== wallet.branchId || employeeId !== wallet.employeeId;

    if (reassigning) {
      if (wallet._count.transactions > 0) {
        throw new AppError(
          "لا يمكن تغيير فرع أو موظف محفظة مرتبطة بحركات مالية",
          409,
        );
      }
      await this.validateAssignment(scope.companyId, branchId, employeeId);
    }

    try {
      return await prisma.employeeWallet.update({
        where: {
          id: walletID,
          ...this.scope(user),
          updatedAt: wallet.updatedAt,
          ...(reassigning && {transactions: {none: {}}}),
        },
        data: {
          branchId,
          employeeId,
        },
        select: employeeWalletSelect,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw new AppError(
          "تم تغيير المحفظة، يرجى تحديث البيانات والمحاولة مرة أخرى",
          409,
        );
      }
      throw error;
    }
  };

  deleteWallet = async (user: loggedInUserType, walletID: number) => {
    const wallet = await this.getWallet(user, walletID);
    if (wallet._count.transactions > 0) {
      throw new AppError("لا يمكن حذف محفظة مرتبطة بحركات مالية", 409);
    }
    try {
      await prisma.employeeWallet.delete({
        where: {
          id: walletID,
          ...this.scope(user),
          updatedAt: wallet.updatedAt,
          transactions: {none: {}},
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ["P2003", "P2025"].includes(error.code)
      ) {
        throw new AppError(
          "تعذر حذف المحفظة بعد تغييرها أو ربطها بحركات مالية",
          409,
        );
      }
      throw error;
    }
  };

  private transactionWhere(
    wallet: {id: number; companyId: number; branchId: number},
    filters: EmployeeWalletTransactionsExportType,
  ): Prisma.TransactionWhereInput {
    const {
      type,
      approved,
      start_date,
      end_date,
      target_branch_id,
      target_client_id,
    } = filters;
    // Calendar dates follow Baghdad time; include the entire selected end day.
    const from = start_date
      ? new Date(`${start_date}T00:00:00+03:00`)
      : undefined;
    const until = end_date ? new Date(`${end_date}T00:00:00+03:00`) : undefined;
    if (until) until.setUTCDate(until.getUTCDate() + 1);
    return {
      employeeWalletId: wallet.id,
      companyId: wallet.companyId,
      branchId: wallet.branchId,
      deleted: false,
      type,
      approved,
      targetBranchId: target_branch_id,
      targetClientId: target_client_id,
      createdAt: from || until ? {gte: from, lt: until} : undefined,
    };
  }

  getTransactionsExport = async (
    user: loggedInUserType,
    walletID: number,
    filters: EmployeeWalletTransactionsExportType,
    personal = false,
  ) => {
    const wallet = personal
      ? await this.getOwnWallet(user, walletID)
      : await this.getWallet(user, walletID);
    const transactions = await prisma.transaction.findMany({
      where: this.transactionWhere(wallet, filters),
      select: walletTransactionSelect,
      orderBy: {id: "desc"},
    });
    return {wallet, transactions};
  };

  getTransactions = async (
    user: loggedInUserType,
    walletID: number,
    filters: EmployeeWalletTransactionsType,
    personal = false,
  ) => {
    const wallet = personal
      ? await this.getOwnWallet(user, walletID)
      : await this.getWallet(user, walletID);
    const {page, size} = filters;
    const where = this.transactionWhere(wallet, filters);
    const [data, count] = await Promise.all([
      prisma.transaction.findMany({
        where,
        select: walletTransactionSelect,
        orderBy: {id: "desc"},
        skip: (page - 1) * size,
        take: size,
      }),
      prisma.transaction.count({where}),
    ]);
    return {data, count, page, pagesCount: Math.ceil(count / size)};
  };
}
