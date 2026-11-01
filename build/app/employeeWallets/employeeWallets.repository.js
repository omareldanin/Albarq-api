"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmployeeWalletsRepository = void 0;
const client_1 = require("@prisma/client");
const db_1 = require("../../database/db");
const AppError_1 = require("../../lib/AppError");
const transactions_responses_1 = require("../transactions/transactions.responses");
const employeeWallets_responses_1 = require("./employeeWallets.responses");
const walletTransactionSelect = {
    ...transactions_responses_1.transactionSelect,
    employeeWalletId: true,
    approved: true,
    branchId: true,
    targetBranchId: true,
    targetClientId: true,
    targetBranch: { select: { id: true, name: true } },
    targetClient: { select: { id: true, user: { select: { name: true } } } },
};
class EmployeeWalletsRepository {
    scope(user, branchID) {
        if (!user.companyID ||
            ![client_1.EmployeeRole.COMPANY_MANAGER, client_1.EmployeeRole.BRANCH_MANAGER].some((role) => role === user.role) ||
            (user.role === "COMPANY_MANAGER" && !user.showTreatury)) {
            throw new AppError_1.AppError("ليس مصرح لك القيام بهذا الفعل", 403);
        }
        if (user.role === client_1.EmployeeRole.BRANCH_MANAGER) {
            if (!user.branchId ||
                (branchID !== undefined && branchID !== user.branchId)) {
                throw new AppError_1.AppError("ليس مصرح لك بإدارة محافظ هذا الفرع", 403);
            }
            return { companyId: user.companyID, branchId: user.branchId };
        }
        return { companyId: user.companyID, branchId: branchID };
    }
    ownScope(user) {
        if (!user.companyID ||
            !Number.isInteger(user.id) ||
            user.id <= 0 ||
            ["ADMIN", "ADMIN_ASSISTANT", "CLIENT"].includes(user.role)) {
            throw new AppError_1.AppError("ليس مصرح لك بعرض هذه القاصة", 403);
        }
        return {
            companyId: user.companyID,
            employeeId: user.id,
            employee: { is: { id: user.id, companyId: user.companyID, deleted: false } },
        };
    }
    getOwnWallets = async (user) => db_1.prisma.employeeWallet.findMany({
        where: this.ownScope(user),
        select: employeeWallets_responses_1.employeeWalletSelect,
        orderBy: { id: "desc" },
    });
    getOwnWallet = async (user, walletID, findWallet = async (where) => db_1.prisma.employeeWallet.findFirst({ where, select: employeeWallets_responses_1.employeeWalletSelect })) => {
        const wallet = await findWallet({ id: walletID, ...this.ownScope(user) });
        if (!wallet)
            throw new AppError_1.AppError("القاصة غير موجودة أو غير مرتبطة بحسابك", 404);
        return wallet;
    };
    getOwnWalletFilters = async (user, walletID) => {
        const wallet = await this.getOwnWallet(user, walletID);
        const where = this.transactionWhere(wallet, {});
        const [branchRows, clientRows] = await Promise.all([
            db_1.prisma.transaction.findMany({
                where: { ...where, targetBranchId: { not: null } },
                distinct: ["targetBranchId"],
                select: { targetBranch: { select: { id: true, name: true } } },
            }),
            db_1.prisma.transaction.findMany({
                where: { ...where, targetClientId: { not: null } },
                distinct: ["targetClientId"],
                select: {
                    targetClient: { select: { id: true, user: { select: { name: true } } } },
                },
            }),
        ]);
        return {
            branches: branchRows.flatMap((row) => row.targetBranch ? [row.targetBranch] : []),
            clients: clientRows.flatMap((row) => row.targetClient
                ? [{ id: row.targetClient.id, name: row.targetClient.user.name }]
                : []),
        };
    };
    getOwnWalletTargets = async (user, walletID, filters) => {
        const wallet = await this.getOwnWallet(user, walletID);
        const { kind, search, page, size } = filters;
        if (kind === "branch") {
            const where = {
                companyId: wallet.companyId,
                name: search ? { contains: search, mode: "insensitive" } : undefined,
            };
            const [data, count] = await Promise.all([
                db_1.prisma.branch.findMany({
                    where,
                    select: { id: true, name: true },
                    orderBy: { id: "asc" },
                    skip: (page - 1) * size,
                    take: size,
                }),
                db_1.prisma.branch.count({ where }),
            ]);
            return { data, page, pagesCount: Math.ceil(count / size) };
        }
        const where = {
            companyId: wallet.companyId,
            deleted: false,
            user: search
                ? { name: { contains: search, mode: "insensitive" } }
                : undefined,
        };
        const [clients, count] = await Promise.all([
            db_1.prisma.client.findMany({
                where,
                select: { id: true, user: { select: { name: true } } },
                orderBy: { id: "asc" },
                skip: (page - 1) * size,
                take: size,
            }),
            db_1.prisma.client.count({ where }),
        ]);
        return {
            data: clients.map((client) => ({ id: client.id, name: client.user.name })),
            page,
            pagesCount: Math.ceil(count / size),
        };
    };
    createOwnTransaction = async (user, walletID, data) => {
        try {
            return await db_1.prisma.$transaction(async (tx) => {
                const wallet = await this.getOwnWallet(user, walletID, async (where) => tx.employeeWallet.findFirst({
                    where,
                    select: employeeWallets_responses_1.employeeWalletSelect,
                }));
                if (data.targetBranchId) {
                    const branch = await tx.branch.findFirst({
                        where: { id: data.targetBranchId, companyId: wallet.companyId },
                        select: { id: true },
                    });
                    if (!branch)
                        throw new AppError_1.AppError("الفرع المستهدف غير موجود في هذه الشركة", 400);
                }
                if (data.targetClientId) {
                    const client = await tx.client.findFirst({
                        where: {
                            id: data.targetClientId,
                            companyId: wallet.companyId,
                            deleted: false,
                        },
                        select: { id: true },
                    });
                    if (!client)
                        throw new AppError_1.AppError("العميل المستهدف غير موجود في هذه الشركة", 400);
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
            }, { isolationLevel: client_1.Prisma.TransactionIsolationLevel.Serializable });
        }
        catch (error) {
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError &&
                error.code === "P2034") {
                throw new AppError_1.AppError("تم تغيير بيانات المحفظة، يرجى التحديث والمحاولة مرة أخرى", 409);
            }
            throw error;
        }
    };
    async validateAssignment(companyId, branchId, employeeId) {
        const branch = await db_1.prisma.branch.findFirst({
            where: { id: branchId, companyId },
            select: { id: true },
        });
        if (!branch)
            throw new AppError_1.AppError("الفرع غير موجود في هذه الشركة", 400);
        if (employeeId !== undefined && employeeId !== null) {
            const employee = await db_1.prisma.employee.findFirst({
                where: { id: employeeId, companyId, branchId, deleted: false },
                select: { id: true },
            });
            if (!employee)
                throw new AppError_1.AppError("الموظف غير موجود في هذا الفرع", 400);
        }
    }
    createWallet = async (user, data) => {
        const branchId = user.branchId;
        const scope = this.scope(user, branchId);
        if (!branchId)
            throw new AppError_1.AppError("يجب تحديد الفرع", 400);
        await this.validateAssignment(scope.companyId, branchId, data.employeeID);
        return db_1.prisma.employeeWallet.create({
            data: {
                companyId: scope.companyId,
                branchId,
                employeeId: data.employeeID,
                createdById: user.id,
            },
            select: employeeWallets_responses_1.employeeWalletSelect,
        });
    };
    getWallets = async (user, filters) => {
        const { page, size, branch_id, employee_id } = filters;
        const where = {
            ...this.scope(user, branch_id),
            employeeId: employee_id,
        };
        const [data, count] = await Promise.all([
            db_1.prisma.employeeWallet.findMany({
                where,
                select: employeeWallets_responses_1.employeeWalletSelect,
                orderBy: { id: "desc" },
                skip: (page - 1) * size,
                take: size,
            }),
            db_1.prisma.employeeWallet.count({ where }),
        ]);
        return { data, count, page, pagesCount: Math.ceil(count / size) };
    };
    getWallet = async (user, walletID) => {
        const wallet = await db_1.prisma.employeeWallet.findFirst({
            where: { id: walletID, ...this.scope(user) },
            select: employeeWallets_responses_1.employeeWalletSelect,
        });
        if (!wallet)
            throw new AppError_1.AppError("محفظة الموظف غير موجودة", 404);
        return wallet;
    };
    updateWallet = async (user, walletID, data) => {
        const wallet = await this.getWallet(user, walletID);
        const branchId = wallet.branchId;
        const employeeId = data.employeeID === undefined ? wallet.employeeId : data.employeeID;
        const scope = this.scope(user, branchId);
        const reassigning = branchId !== wallet.branchId || employeeId !== wallet.employeeId;
        if (reassigning) {
            if (wallet._count.transactions > 0) {
                throw new AppError_1.AppError("لا يمكن تغيير فرع أو موظف محفظة مرتبطة بحركات مالية", 409);
            }
            await this.validateAssignment(scope.companyId, branchId, employeeId);
        }
        try {
            return await db_1.prisma.employeeWallet.update({
                where: {
                    id: walletID,
                    ...this.scope(user),
                    updatedAt: wallet.updatedAt,
                    ...(reassigning && { transactions: { none: {} } }),
                },
                data: {
                    branchId,
                    employeeId,
                },
                select: employeeWallets_responses_1.employeeWalletSelect,
            });
        }
        catch (error) {
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError &&
                error.code === "P2025") {
                throw new AppError_1.AppError("تم تغيير المحفظة، يرجى تحديث البيانات والمحاولة مرة أخرى", 409);
            }
            throw error;
        }
    };
    deleteWallet = async (user, walletID) => {
        const wallet = await this.getWallet(user, walletID);
        if (wallet._count.transactions > 0) {
            throw new AppError_1.AppError("لا يمكن حذف محفظة مرتبطة بحركات مالية", 409);
        }
        try {
            await db_1.prisma.employeeWallet.delete({
                where: {
                    id: walletID,
                    ...this.scope(user),
                    updatedAt: wallet.updatedAt,
                    transactions: { none: {} },
                },
            });
        }
        catch (error) {
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError &&
                ["P2003", "P2025"].includes(error.code)) {
                throw new AppError_1.AppError("تعذر حذف المحفظة بعد تغييرها أو ربطها بحركات مالية", 409);
            }
            throw error;
        }
    };
    transactionWhere(wallet, filters) {
        const { type, approved, start_date, end_date, target_branch_id, target_client_id, } = filters;
        // Calendar dates follow Baghdad time; include the entire selected end day.
        const from = start_date
            ? new Date(`${start_date}T00:00:00+03:00`)
            : undefined;
        const until = end_date ? new Date(`${end_date}T00:00:00+03:00`) : undefined;
        if (until)
            until.setUTCDate(until.getUTCDate() + 1);
        return {
            employeeWalletId: wallet.id,
            companyId: wallet.companyId,
            branchId: wallet.branchId,
            deleted: false,
            type,
            approved,
            targetBranchId: target_branch_id,
            targetClientId: target_client_id,
            createdAt: from || until ? { gte: from, lt: until } : undefined,
        };
    }
    getTransactionsExport = async (user, walletID, filters, personal = false) => {
        const wallet = personal
            ? await this.getOwnWallet(user, walletID)
            : await this.getWallet(user, walletID);
        const transactions = await db_1.prisma.transaction.findMany({
            where: this.transactionWhere(wallet, filters),
            select: walletTransactionSelect,
            orderBy: { id: "desc" },
        });
        return { wallet, transactions };
    };
    getTransactions = async (user, walletID, filters, personal = false) => {
        const wallet = personal
            ? await this.getOwnWallet(user, walletID)
            : await this.getWallet(user, walletID);
        const { page, size } = filters;
        const where = this.transactionWhere(wallet, filters);
        const [data, count] = await Promise.all([
            db_1.prisma.transaction.findMany({
                where,
                select: walletTransactionSelect,
                orderBy: { id: "desc" },
                skip: (page - 1) * size,
                take: size,
            }),
            db_1.prisma.transaction.count({ where }),
        ]);
        return { data, count, page, pagesCount: Math.ceil(count / size) };
    };
}
exports.EmployeeWalletsRepository = EmployeeWalletsRepository;
//# sourceMappingURL=employeeWallets.repository.js.map