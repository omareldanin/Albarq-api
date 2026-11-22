import type { Prisma } from "@prisma/client";
import { prisma } from "../../database/db";
import { AppError } from "../../lib/AppError";
import type { loggedInUserType } from "../../types/user";
import type { ClientLoanCreateType, ClientLoansListType, ClientLoanUpdateType } from "./clientLoans.dto";

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
} satisfies Prisma.ClientLoanSelect;

type LoanRow = Prisma.ClientLoanGetPayload<{ select: typeof loanSelect }>;

const loanReform = (loan: LoanRow) => ({
    id: loan.id,
    amount: loan.amount,
    note: loan.note,
    createdAt: loan.createdAt,
    settledAt: loan.settledAt,
    reportId: loan.reportId,
    status: loan.reportId ? ("settled" as const) : ("open" as const),
    client: { id: loan.client.id, name: loan.client.user.name, phone: loan.client.user.phone },
    createdBy: loan.createdBy,
    deletedAt: loan.deletedAt,
    deletedBy: loan.deletedBy,
    transactionId: loan.transaction.id,
    approved: loan.transaction.approved
});

// A loan stays valid while it and its treasury transaction are not deleted.
const activeLoan = { deleted: false, transaction: { deleted: false } } satisfies Prisma.ClientLoanWhereInput;
const loanTransactionFor = (clientName: string, note: string) => `سلفة للعميل ${clientName}${note ? ` - ${note}` : ""}`;
const formatAmount = (value: number) => new Intl.NumberFormat("en-US").format(value);

export class ClientLoansRepository {
    private scope(user: loggedInUserType) {
        if (!user.companyID || (user.role !== "COMPANY_MANAGER" && user.role !== "BRANCH_MANAGER")) {
            throw new AppError("ليس مصرح لك القيام بهذا الفعل", 403);
        }
        return { companyId: user.companyID };
    }

    /** Treasury branch of the loan's withdrawal, chosen like other treasury transactions. */
    private async treasuryBranch(user: loggedInUserType) {
        if (user.role === "COMPANY_MANAGER") {
            const main = await prisma.repository.findFirst({
                where: { companyId: user.companyID as number, mainRepository: true },
                select: { branchId: true }
            });
            return main?.branchId || user.branchId || undefined;
        }
        return user.branchId || undefined;
    }

    /** Pays a loan to a client: a treasury withdrawal plus the loan record, together. */
    createLoan = async (user: loggedInUserType, data: ClientLoanCreateType) => {
        const { companyId } = this.scope(user);
        const client = await this.loanClient(user, companyId, data.clientID);
        const branchId = await this.treasuryBranch(user);
        const note = data.note ?? "";

        const loan = await prisma.$transaction(async (tx) => {
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
    private async loanClient(user: loggedInUserType, companyId: number, clientID: number) {
        const client = await prisma.client.findFirst({
            where: { id: clientID, companyId, deleted: false },
            select: { id: true, branchId: true, user: { select: { name: true } } }
        });
        if (!client) throw new AppError("العميل غير موجود", 404);
        if (user.role === "BRANCH_MANAGER" && client.branchId !== user.branchId) {
            throw new AppError("هذا العميل ليس من فرعك", 403);
        }
        return client;
    }

    /** An open loan (not deducted in a report) the user may edit or delete. */
    private async openLoan(user: loggedInUserType, loanID: number, action: "تعديل" | "حذف") {
        const { companyId } = this.scope(user);
        const loan = await prisma.clientLoan.findFirst({
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
        if (!loan) throw new AppError("السلفة غير موجودة", 404);
        if (user.role === "BRANCH_MANAGER" && loan.client.branchId !== user.branchId) {
            throw new AppError("هذا العميل ليس من فرعك", 403);
        }
        if (loan.reportId) {
            throw new AppError(`لا يمكن ${action} سلفة خُصمت من كشف رقم ${loan.reportId}، احذف الكشف أولاً`, 400);
        }
        return { ...loan, companyId };
    }

    /** Edits an open loan and its treasury withdrawal together. */
    updateLoan = async (user: loggedInUserType, loanID: number, data: ClientLoanUpdateType) => {
        const loan = await this.openLoan(user, loanID, "تعديل");
        const amount = data.amount ?? loan.amount;
        const note = data.note ?? loan.note;
        const client =
            data.clientID !== undefined && data.clientID !== loan.clientId
                ? await this.loanClient(user, loan.companyId, data.clientID)
                : { id: loan.clientId, user: loan.client.user };
        // A deleted report restores the loans it deducted; changing them would not match it.
        if (loan.releasedReportId && (amount !== loan.amount || client.id !== loan.clientId)) {
            throw new AppError(
                `هذه السلفة كانت مخصومة من الكشف المحذوف رقم ${loan.releasedReportId}، يمكن تعديل الملاحظة فقط`,
                400
            );
        }

        await prisma.$transaction(async (tx) => {
            // Only while still open: a report made meanwhile keeps the loan as it was.
            const updated = await tx.clientLoan.updateMany({
                where: { id: loan.id, reportId: null, deleted: false },
                data: { amount, note, clientId: client.id }
            });
            if (updated.count === 0) throw new AppError("خُصمت السلفة في كشف أو حُذفت، حدّث الصفحة", 409);
            await tx.transaction.update({
                where: { id: loan.transactionId },
                data: { for: loanTransactionFor(client.user.name, note), paidAmount: amount, totalPaidAmount: amount }
            });
        });
        const saved = await prisma.clientLoan.findUniqueOrThrow({ where: { id: loan.id }, select: loanSelect });
        return loanReform(saved);
    };

    /** Deletes an open loan: kept for deleted items, and its treasury withdrawal is deleted. */
    deleteLoan = async (user: loggedInUserType, loanID: number) => {
        const loan = await this.openLoan(user, loanID, "حذف");
        await prisma.$transaction(async (tx) => {
            const deleted = await tx.clientLoan.updateMany({
                where: { id: loan.id, reportId: null, deleted: false },
                data: { deleted: true, deletedAt: new Date(), deletedById: user.id }
            });
            if (deleted.count === 0) throw new AppError("خُصمت السلفة في كشف أو حُذفت، حدّث الصفحة", 409);
            await tx.transaction.update({ where: { id: loan.transactionId }, data: { deleted: true } });
        });
    };

    getLoans = async (user: loggedInUserType, filters: ClientLoansListType) => {
        const { companyId } = this.scope(user);
        const branchScope = user.role === "BRANCH_MANAGER" && { client: { branchId: user.branchId } };
        if (filters.deleted) {
            const where: Prisma.ClientLoanWhereInput = {
                companyId,
                deleted: true,
                clientId: filters.client_id,
                ...branchScope
            };
            const [loans, count] = await Promise.all([
                prisma.clientLoan.findMany({
                    where,
                    orderBy: [{ deletedAt: { sort: "desc", nulls: "last" } }, { id: "desc" }],
                    skip: (filters.page - 1) * filters.size,
                    take: filters.size,
                    select: loanSelect
                }),
                prisma.clientLoan.count({ where })
            ]);
            return {
                page: filters.page,
                pagesCount: Math.max(1, Math.ceil(count / filters.size)),
                data: { loans: loans.map(loanReform), openTotal: 0, openCount: 0 }
            };
        }
        const base: Prisma.ClientLoanWhereInput = {
            ...activeLoan,
            companyId,
            clientId: filters.client_id,
            ...branchScope
        };
        const where: Prisma.ClientLoanWhereInput = {
            ...base,
            ...(filters.status === "open" && { reportId: null }),
            ...(filters.status === "settled" && { reportId: { not: null } })
        };
        const [loans, count, open] = await Promise.all([
            prisma.clientLoan.findMany({
                where,
                orderBy: { id: "desc" },
                skip: (filters.page - 1) * filters.size,
                take: filters.size,
                select: loanSelect
            }),
            prisma.clientLoan.count({ where }),
            prisma.clientLoan.aggregate({ where: { ...base, reportId: null }, _sum: { amount: true }, _count: { id: true } })
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
    getOpenLoans = async (clientId: number) => {
        const loans = await prisma.clientLoan.findMany({
            where: { ...activeLoan, clientId, reportId: null },
            select: { id: true, amount: true }
        });
        return { ids: loans.map((loan) => loan.id), total: loans.reduce((sum, loan) => sum + loan.amount, 0) };
    };

    /** Blocks a delivered report whose net cannot cover the client's open loans. */
    assertLoansCovered = (loansTotal: number, clientNet: number) => {
        if (loansTotal > 0 && loansTotal > clientNet) {
            throw new AppError(
                `لا يمكن عمل كشف واصل لهذا العميل: سلفه المفتوحة (${formatAmount(loansTotal)}) أكبر من صافي الكشف (${formatAmount(clientNet)})`,
                400
            );
        }
    };

    /**
     * Deducts these open loans on a delivered report and records the total on the report.
     * Only loans still open are taken, so the same loan is never deducted twice.
     */
    settleLoans = async (loanIDs: number[], reportId: number) => {
        if (loanIDs.length === 0) return 0;
        return prisma.$transaction(async (tx) => {
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
