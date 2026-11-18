"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportRequestsListSchema = exports.ReportRequestRejectSchema = exports.ReportRequestParamsSchema = exports.ReportRequestCreateSchema = void 0;
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const numericInput = zod_1.z.union([zod_1.z.number(), zod_1.z.string().trim().min(1)]);
const idSchema = numericInput.pipe(zod_1.z.coerce.number().int().positive().max(2147483647));
exports.ReportRequestCreateSchema = zod_1.z
    .object({
    receiveMethod: zod_1.z.nativeEnum(client_1.ReportReceiveMethod),
    note: zod_1.z.string().trim().max(300).optional()
})
    .strict();
exports.ReportRequestParamsSchema = zod_1.z.object({ requestID: idSchema });
exports.ReportRequestRejectSchema = zod_1.z
    .object({ reason: zod_1.z.string().trim().min(1, "اكتب سبب الرفض").max(300) })
    .strict();
exports.ReportRequestsListSchema = zod_1.z.object({
    page: idSchema.default(1),
    size: numericInput.pipe(zod_1.z.coerce.number().int().min(1).max(100)).default(10),
    status: zod_1.z.nativeEnum(client_1.ReportRequestStatus).optional(),
    client_id: idSchema.optional()
});
//# sourceMappingURL=clientReportRequests.dto.js.map