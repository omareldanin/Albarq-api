import type { Prisma } from "@prisma/client";

export const employeeWalletSelect = {
    id: true,
    companyId: true,
    branchId: true,
    employeeId: true,
    createdById: true,
    total: true,
    paid: true,
    pending: true,
    createdAt: true,
    updatedAt: true,
    company: { select: { id: true, name: true } },
    branch: { select: { id: true, name: true } },
    employee: { select: { id: true, user: { select: { id: true, name: true } } } },
    createdBy: { select: { id: true, name: true } },
    _count: { select: { transactions: true } }
} satisfies Prisma.EmployeeWalletSelect;
