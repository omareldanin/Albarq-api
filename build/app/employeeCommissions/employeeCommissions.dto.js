"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmployeeClientCommissionUpsertSchema = void 0;
const zod_1 = require("zod");
exports.EmployeeClientCommissionUpsertSchema = zod_1.z.object({
    clientID: zod_1.z.number().int().positive(),
    govOrderCost: zod_1.z.number().min(0),
    baghdadOrderCost: zod_1.z.number().min(0),
    active: zod_1.z.boolean().optional().default(true),
});
//# sourceMappingURL=employeeCommissions.dto.js.map