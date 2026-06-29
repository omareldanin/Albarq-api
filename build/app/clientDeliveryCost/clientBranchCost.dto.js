"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientBranchCostUpsertSchema = void 0;
const zod_1 = require("zod");
exports.ClientBranchCostUpsertSchema = zod_1.z.object({
    branchID: zod_1.z.number().int().positive(),
    deliveryAgentProfit: zod_1.z.number().int().min(0).optional().default(0),
    mainBranchProfit: zod_1.z.number().int().min(0).optional().default(0),
    forwardedBranchProfit: zod_1.z.number().int().min(0).optional().default(0),
    receivingBranchProfit: zod_1.z.number().int().min(0).optional().default(0),
    activeProfit: zod_1.z.boolean().optional().default(false),
});
//# sourceMappingURL=clientBranchCost.dto.js.map