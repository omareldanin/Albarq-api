"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportReceiptScope = reportReceiptScope;
const AppError_1 = require("../../../lib/AppError");
const validID = (id) => typeof id === "number" && Number.isSafeInteger(id) && id > 0;
// Apply access restrictions in the query, before loading financial details.
function reportReceiptScope(user) {
    if (user.role === "ADMIN" || user.role === "ADMIN_ASSISTANT")
        return {};
    const forbidden = () => new AppError_1.AppError("غير مصرح لك بالاطلاع على هذا الكشف", 403);
    if (!validID(user.companyID))
        throw forbidden();
    const company = { companyId: user.companyID };
    if (user.role === "INQUIRY_EMPLOYEE" ||
        user.role === "RECEIVING_AGENT" ||
        user.role === "EMPLOYEE_CLIENT_ASSISTANT")
        throw forbidden();
    if (user.role === "CLIENT" || user.role === "CLIENT_ASSISTANT") {
        if (user.role === "CLIENT_ASSISTANT" && !user.permissions.includes("MANAGE_REPORTS")) {
            throw forbidden();
        }
        const clientId = user.role === "CLIENT" ? user.id : user.clientId;
        if (!validID(clientId))
            throw forbidden();
        return { ...company, type: "CLIENT", clientReport: { clientId } };
    }
    if (user.role === "DELIVERY_AGENT") {
        if (!validID(user.id))
            throw forbidden();
        return {
            ...company,
            type: "DELIVERY_AGENT",
            deliveryAgentReport: { deliveryAgentId: user.id }
        };
    }
    if (user.role === "COMPANY_MANAGER" || user.mainRepository)
        return company;
    if (!validID(user.branchId))
        throw forbidden();
    const branchId = user.branchId;
    const scope = {
        ...company,
        OR: [
            { createdBy: { branchId } },
            { clientReport: { client: { branchId } } },
            {
                branchReport: {
                    branch: { OR: [{ id: branchId }, { parentBranchId: branchId }] }
                }
            },
            {
                deliveryAgentReport: {
                    deliveryAgent: {
                        branch: { OR: [{ id: branchId }, { parentBranchId: branchId }] }
                    }
                }
            },
            { repositoryReport: { repository: { branchId } } },
            { repositoryReport: { orders: { some: { branchId } } } }
        ]
    };
    if (user.role === "REPOSITORIY_EMPLOYEE") {
        if (!validID(user.repositoryId))
            throw forbidden();
        scope.AND = [
            {
                OR: [
                    { type: { not: "REPOSITORY" } },
                    {
                        repositoryReport: {
                            OR: [{ repositoryId: user.repositoryId }, { targetRepositoryId: user.repositoryId }]
                        }
                    }
                ]
            }
        ];
    }
    return scope;
}
//# sourceMappingURL=reportReceiptScope.js.map