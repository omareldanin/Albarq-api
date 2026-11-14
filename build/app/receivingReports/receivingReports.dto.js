"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReceivingReportsListSchema = exports.ReceivingReportParamsSchema = exports.ReceivingReportCreateSchema = void 0;
const zod_1 = require("zod");
// Accept JSON numbers and query strings without coercing null or booleans.
const numericInput = zod_1.z.union([zod_1.z.number(), zod_1.z.string().trim().min(1)]);
const idSchema = numericInput.pipe(zod_1.z.coerce.number().int().positive().max(2147483647));
exports.ReceivingReportCreateSchema = zod_1.z
    .object({
    // Limit the report to one client; omitted = all of the agent's clients.
    clientID: idSchema.optional(),
    // Limit the report to these orders; omitted = every eligible order.
    ordersIDs: zod_1.z.array(zod_1.z.string().trim().min(1)).min(1).max(5000).optional()
})
    .strict();
exports.ReceivingReportParamsSchema = zod_1.z.object({ reportID: idSchema });
exports.ReceivingReportsListSchema = zod_1.z
    .object({
    page: idSchema.default(1),
    size: numericInput.pipe(zod_1.z.coerce.number().int().min(1).max(100)).default(10),
    start_date: zod_1.z.string().date().optional(),
    end_date: zod_1.z.string().date().optional(),
    client_id: idSchema.optional(),
    receiving_agent_id: idSchema.optional()
})
    .refine(({ start_date, end_date }) => !start_date || !end_date || start_date <= end_date, {
    message: "تاريخ النهاية يجب أن يكون بعد تاريخ البداية",
    path: ["end_date"]
});
//# sourceMappingURL=receivingReports.dto.js.map