import type { AdminRole, ClientRole, EmployeeRole, Prisma } from "@prisma/client";

export const userSelect = {
    id: true,
    password: true,
    username: true,
    name: true,
    admin: {
        select: {
            role: true
        }
    },
    employee: {
        select: {
            role: true,
            permissions: true,
            company: {
                select: {
                    id: true,
                    name: true,
                    logo: true,
                    mainCompany: true
                }
            }
        }
    },
    client: {
        select: {
            role: true,
            company: {
                select: {
                    id: true,
                    name: true,
                    logo: true,
                    mainCompany: true
                }
            }
        }
    }
} satisfies Prisma.UserSelect;

export const userReform = (
    user: Prisma.UserGetPayload<{
        select: typeof userSelect;
    }> | null
) => {
    if (!user) {
        return null;
    }
    return {
        id: user.id,
        username: user.username,
        password: user.password,
        name: user.name,
        companyID: user.employee?.company.id || user.client?.company.id || null,
        companyName: user.employee?.company.name || user.client?.company.name || null,
        mainCompany: user.employee?.company.mainCompany ?? user.client?.company.mainCompany ?? null,
        role: (user.admin?.role || user.employee?.role || user.client?.role) as
            | AdminRole
            | EmployeeRole
            | ClientRole,
        permissions: user.employee?.permissions || []
    };
};
