"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientLoansListSchema = exports.ClientLoanCreateSchema = void 0;
const zod_1 = require("zod");
// Accept JSON numbers and multipart/query strings.
const numericInput = zod_1.z.union([zod_1.z.number(), zod_1.z.string().trim().min(1)]);
const idSchema = numericInput.pipe(zod_1.z.coerce.number().int().positive().max(2147483647));
const booleanInput = zod_1.z.union([zod_1.z.boolean(), zod_1.z.enum(["true", "false"]).transform((value) => value === "true")]);
exports.ClientLoanCreateSchema = zod_1.z
    .object({
    clientID: idSchema,
    amount: numericInput.pipe(zod_1.z.coerce.number().positive("مبلغ السلفة يجب أن يكون أكبر من صفر").max(1_000_000_000)),
    note: zod_1.z.string().trim().max(300).optional(),
    // Same meaning as for other treasury transactions (main treasury = approved).
    approved: booleanInput.optional().default(false)
})
    .strict();
exports.ClientLoansListSchema = zod_1.z.object({
    page: idSchema.default(1),
    size: numericInput.pipe(zod_1.z.coerce.number().int().min(1).max(100)).default(10),
    client_id: idSchema.optional(),
    status: zod_1.z.enum(["open", "settled", "all"]).default("all")
});
//# sourceMappingURL=clientLoans.dto.js.map