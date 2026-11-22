"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientLoansRepository = void 0;
const db_1 = require("../../database/db");
const AppError_1 = require("../../lib/AppError");
const loanSelect = {
    id: true,
    amount: true,
    note: true,
    createdAt: true,
    settledAt: true,
    reportId: true,
    deletedAt: true,
    client: { select: { id: true, user: { select: { name: true, phone: true } } } },
    createdBy: { select: { id: true, name: true } },
    deletedBy: { select: { id: true, name: true } },
    transaction: { select: { id: true, approved: true } }
};
const loanReform = (loan) => ({
    id: loan.id,
    amount: loan.amount,
    note: loan.note,
    createdAt: loan.createdAt,
    settledAt: loan.settledAt,
    reportId: loan.reportId,
    status: loan.reportId ? "settled" : "open",
    client: { id: loan.client.id, name: loan.client.user.name, phone: loan.client.user.phone },
    createdBy: loan.createdBy,
    deletedAt: loan.deletedAt,
    deletedBy: loan.deletedBy,
    transactionId: loan.transaction.id,
    approved: loan.transaction.approved
});
// A loan stays valid while it and its treasury transaction are not deleted.
const activeLoan = { deleted: false, transaction: { deleted: false } };
const loanTransactionFor = (clientName, note) => `سلفة للعميل ${clientName}${note ? ` - ${note}` : ""}`;
const formatAmount = (value) => new Intl.NumberFormat("en-US").format(value);
class ClientLoansRepository {
    scope(user) {
        if (!user.companyID || (user.role !== "COMPANY_MANAGER" && user.role !== "BRANCH_MANAGER")) {
            throw new AppError_1.AppError("ليس مصرح لك القيام بهذا الفعل", 403);
        }
        return { companyId: user.companyID };
    }
    /** Treasury branch of the loan's withdrawal, chosen like other treasury transactions. */
    async treasuryBranch(user) {
        if (user.role === "COMPANY_MANAGER") {
            const main = await db_1.prisma.repository.findFirst({
                where: { companyId: user.companyID, mainRepository: true },
                select: { branchId: true }
            });
            return main?.branchId || user.branchId || undefined;
        }
        return user.branchId || undefined;
    }
    /** Pays a loan to a client: a treasury withdrawal plus the loan record, together. */
    createLoan = async (user, data) => {
        const { companyId } = this.scope(user);
        const client = await this.loanClient(user, companyId, data.clientID);
        const branchId = await this.treasuryBranch(user);
        const note = data.note ?? "";
        const loan = await db_1.prisma.$transaction(async (tx) => {
            const transaction = await tx.transaction.create({
                data: {
                    type: "WITHDRAW",
                    for: loanTransactionFor(client.user.name, note),
                    paidAmount: data.amount,
                    totalPaidAmount: data.amount,
                    approved: data.approved,
                    approvedforMain: data.approved,
                    company: { connect: { id: companyId } },
                    createdBy: { connect: { id: user.id } },
                    ...(branchId && { branch: { connect: { id: branchId } } })
                },
                select: { id: true }
            });
            return tx.clientLoan.create({
                data: {
                    companyId,
                    clientId: client.id,
                    amount: data.amount,
                    note,
                    transactionId: transaction.id,
                    createdById: user.id
                },
                select: loanSelect
            });
        });
        return loanReform(loan);
    };
    /** A client of the company that the user may give a loan to. */
    async loanClient(user, companyId, clientID) {
        const client = await db_1.prisma.client.findFirst({
            where: { id: clientID, companyId, deleted: false },
            select: { id: true, branchId: true, user: { select: { name: true } } }
        });
        if (!client)
            throw new AppError_1.AppError("العميل غير موجود", 404);
        if (user.role === "BRANCH_MANAGER" && client.branchId !== user.branchId) {
            throw new AppError_1.AppError("هذا العميل ليس من فرعك", 403);
        }
        return client;
    }
    /** An open loan (not deducted in a report) the user may edit or delete. */
    async openLoan(user, loanID, action) {
        const { companyId } = this.scope(user);
        const loan = await db_1.prisma.clientLoan.findFirst({
            where: { id: loanID, companyId, ...activeLoan },
            select: {
                id: true,
                amount: true,
                note: true,
                clientId: true,
                reportId: true,
                releasedReportId: true,
                transactionId: true,
                client: { select: { branchId: true, user: { select: { name: true } } } }
            }
        });
        if (!loan)
            throw new AppError_1.AppError("السلفة غير موجودة", 404);
        if (user.role === "BRANCH_MANAGER" && loan.client.branchId !== user.branchId) {
            throw new AppError_1.AppError("هذا العميل ليس من فرعك", 403);
        }
        if (loan.reportId) {
            throw new AppError_1.AppError(`لا يمكن ${action} سلفة خُصمت من كشف رقم ${loan.reportId}، احذف الكشف أولاً`, 400);
        }
        return { ...loan, companyId };
    }
    /** Edits an open loan and its treasury withdrawal together. */
    updateLoan = async (user, loanID, data) => {
        const loan = await this.openLoan(user, loanID, "تعديل");
        const amount = data.amount ?? loan.amount;
        const note = data.note ?? loan.note;
        const client = data.clientID !== undefined && data.clientID !== loan.clientId
            ? await this.loanClient(user, loan.companyId, data.clientID)
            : { id: loan.clientId, user: loan.client.user };
        // A deleted report restores the loans it deducted; changing them would not match it.
        if (loan.releasedReportId && (amount !== loan.amount || client.id !== loan.clientId)) {
            throw new AppError_1.AppError(`هذه السلفة كانت مخصومة من الكشف المحذوف رقم ${loan.releasedReportId}، يمكن تعديل الملاحظة فقط`, 400);
        }
        await db_1.prisma.$transaction(async (tx) => {
            // Only while still open: a report made meanwhile keeps the loan as it was.
            const updated = await tx.clientLoan.updateMany({
                where: { id: loan.id, reportId: null, deleted: false },
                data: { amount, note, clientId: client.id }
            });
            if (updated.count === 0)
                throw new AppError_1.AppError("خُصمت السلفة في كشف أو حُذفت، حدّث الصفحة", 409);
            await tx.transaction.update({
                where: { id: loan.transactionId },
                data: { for: loanTransactionFor(client.user.name, note), paidAmount: amount, totalPaidAmount: amount }
            });
        });
        const saved = await db_1.prisma.clientLoan.findUniqueOrThrow({ where: { id: loan.id }, select: loanSelect });
        return loanReform(saved);
    };
    /** Deletes an open loan: kept for deleted items, and its treasury withdrawal is deleted. */
    deleteLoan = async (user, loanID) => {
        const loan = await this.openLoan(user, loanID, "حذف");
        await db_1.prisma.$transaction(async (tx) => {
            const deleted = await tx.clientLoan.updateMany({
                where: { id: loan.id, reportId: null, deleted: false },
                data: { deleted: true, deletedAt: new Date(), deletedById: user.id }
            });
            if (deleted.count === 0)
                throw new AppError_1.AppError("خُصمت السلفة في كشف أو حُذفت، حدّث الصفحة", 409);
            await tx.transaction.update({ where: { id: loan.transactionId }, data: { deleted: true } });
        });
    };
    getLoans = async (user, filters) => {
        const { companyId } = this.scope(user);
        const branchScope = user.role === "BRANCH_MANAGER" && { client: { branchId: user.branchId } };
        if (filters.deleted) {
            const where = {
                companyId,
                deleted: true,
                clientId: filters.client_id,
                ...branchScope
            };
            const [loans, count] = await Promise.all([
                db_1.prisma.clientLoan.findMany({
                    where,
                    orderBy: [{ deletedAt: { sort: "desc", nulls: "last" } }, { id: "desc" }],
                    skip: (filters.page - 1) * filters.size,
                    take: filters.size,
                    select: loanSelect
                }),
                db_1.prisma.clientLoan.count({ where })
            ]);
            return {
                page: filters.page,
                pagesCount: Math.max(1, Math.ceil(count / filters.size)),
                data: { loans: loans.map(loanReform), openTotal: 0, openCount: 0 }
            };
        }
        const base = {
            ...activeLoan,
            companyId,
            clientId: filters.client_id,
            ...branchScope
        };
        const where = {
            ...base,
            ...(filters.status === "open" && { reportId: null }),
            ...(filters.status === "settled" && { reportId: { not: null } })
        };
        const [loans, count, open] = await Promise.all([
            db_1.prisma.clientLoan.findMany({
                where,
                orderBy: { id: "desc" },
                skip: (filters.page - 1) * filters.size,
                take: filters.size,
                select: loanSelect
            }),
            db_1.prisma.clientLoan.count({ where }),
            db_1.prisma.clientLoan.aggregate({ where: { ...base, reportId: null }, _sum: { amount: true }, _count: { id: true } })
        ]);
        return {
            page: filters.page,
            pagesCount: Math.max(1, Math.ceil(count / filters.size)),
            data: {
                loans: loans.map(loanReform),
                openTotal: open._sum.amount ?? 0,
                openCount: open._count.id
            }
        };
    };
    /** The client's loans not deducted from a report yet. */
    getOpenLoans = async (clientId) => {
        const loans = await db_1.prisma.clientLoan.findMany({
            where: { ...activeLoan, clientId, reportId: null },
            select: { id: true, amount: true }
        });
        return { ids: loans.map((loan) => loan.id), total: loans.reduce((sum, loan) => sum + loan.amount, 0) };
    };
    /** Blocks a delivered report whose net cannot cover the client's open loans. */
    assertLoansCovered = (loansTotal, clientNet) => {
        if (loansTotal > 0 && loansTotal > clientNet) {
            throw new AppError_1.AppError(`لا يمكن عمل كشف واصل لهذا العميل: سلفه المفتوحة (${formatAmount(loansTotal)}) أكبر من صافي الكشف (${formatAmount(clientNet)})`, 400);
        }
    };
    /**
     * Deducts these open loans on a delivered report and records the total on the report.
     * Only loans still open are taken, so the same loan is never deducted twice.
     */
    settleLoans = async (loanIDs, reportId) => {
        if (loanIDs.length === 0)
            return 0;
        return db_1.prisma.$transaction(async (tx) => {
            await tx.clientLoan.updateMany({
                where: { id: { in: loanIDs }, reportId: null },
                data: { reportId, settledAt: new Date(), releasedReportId: null }
            });
            const settled = await tx.clientLoan.aggregate({ where: { reportId }, _sum: { amount: true } });
            const total = settled._sum.amount ?? 0;
            await tx.report.update({ where: { id: reportId }, data: { loansDeduction: total } });
            return total;
        });
    };
}
exports.ClientLoansRepository = ClientLoansRepository;
//# sourceMappingURL=clientLoans.repository.js.map