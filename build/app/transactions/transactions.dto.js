"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionUpdateSchema = exports.TransactionCreateSchema = void 0;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
exports.TransactionCreateSchema = zod_1.z.object({
    type: zod_1.z.nativeEnum(client_1.TransactionType),
    for: zod_1.z.string().min(1),
    employeeID: zod_1.z.number().int().positive().optional(),
    reportID: zod_1.z.number().int().positive().optional(),
    branchID: zod_1.z.number().int().positive().optional(),
    paidAmount: zod_1.z.number().optional().default(0),
    branchNet: zod_1.z.number().optional().default(0),
    clientNet: zod_1.z.number().optional().default(0),
    totalPaidAmount: zod_1.z.number().optional().default(0),
    deliveryAgentNet: zod_1.z.number().optional().default(0),
    forwardedBranchNet: zod_1.z.number().optional().default(0),
    receivingBranchNet: zod_1.z.number().optional().default(0),
    insideBranchNet: zod_1.z.number().optional().default(0),
    approved: zod_1.z.boolean().optional().default(false),
});
exports.TransactionUpdateSchema = exports.TransactionCreateSchema.partial();
//# sourceMappingURL=transactions.dto.js.map