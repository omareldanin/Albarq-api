import type { Prisma } from "@prisma/client";
import { prisma } from "../../database/db";
import { AppError } from "../../lib/AppError";
import type { loggedInUserType } from "../../types/user";
import type { ClientLoanCreateType, ClientLoansListType } from "./clientLoans.dto";

const loanSelect = {
    id: true,
    amount: true,
    note: true,
    createdAt: true,
    settledAt: true,
    reportId: true,
    client: { select: { id: true, user: { select: { name: true, phone: true } } } },
    createdBy: { select: { id: true, name: true } },
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
    transactionId: loan.transaction.id,
    approved: loan.transaction.approved
});

// A loan stays valid while its treasury transaction is not deleted.
const activeLoan = { transaction: { deleted: false } } satisfies Prisma.ClientLoanWhereInput;
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
        const client = await prisma.client.findFirst({
            where: { id: data.clientID, companyId, deleted: false },
            select: { id: true, branchId: true, user: { select: { name: true } } }
        });
        if (!client) throw new AppError("العميل غير موجود", 404);
        if (user.role === "BRANCH_MANAGER" && client.branchId !== user.branchId) {
            throw new AppError("هذا العميل ليس من فرعك", 403);
        }
        const branchId = await this.treasuryBranch(user);
        const note = data.note ?? "";

        const loan = await prisma.$transaction(async (tx) => {
            const transaction = await tx.transaction.create({
                data: {
                    type: "WITHDRAW",
                    for: `سلفة للعميل ${client.user.name}${note ? ` - ${note}` : ""}`,
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

    getLoans = async (user: loggedInUserType, filters: ClientLoansListType) => {
        const { companyId } = this.scope(user);
        const base: Prisma.ClientLoanWhereInput = {
            ...activeLoan,
            companyId,
            clientId: filters.client_id,
            ...(user.role === "BRANCH_MANAGER" && { client: { branchId: user.branchId } })
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
