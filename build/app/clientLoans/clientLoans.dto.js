"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientLoansListSchema = exports.ClientLoanParamsSchema = exports.ClientLoanUpdateSchema = exports.ClientLoanCreateSchema = void 0;
const zod_1 = require("zod");
// Accept JSON numbers and multipart/query strings.
const numericInput = zod_1.z.union([zod_1.z.number(), zod_1.z.string().trim().min(1)]);
const idSchema = numericInput.pipe(zod_1.z.coerce.number().int().positive().max(2147483647));
const booleanInput = zod_1.z.union([zod_1.z.boolean(), zod_1.z.enum(["true", "false"]).transform((value) => value === "true")]);
const amountSchema = numericInput.pipe(zod_1.z.coerce.number().positive("مبلغ السلفة يجب أن يكون أكبر من صفر").max(1_000_000_000));
exports.ClientLoanCreateSchema = zod_1.z
    .object({
    clientID: idSchema,
    amount: amountSchema,
    note: zod_1.z.string().trim().max(300).optional(),
    // Same meaning as for other treasury transactions (main treasury = approved).
    approved: booleanInput.optional().default(false)
})
    .strict();
/** Open loans only (not deducted in a report). */
exports.ClientLoanUpdateSchema = zod_1.z
    .object({
    clientID: idSchema.optional(),
    amount: amountSchema.optional(),
    note: zod_1.z.string().trim().max(300).optional()
})
    .strict()
    .refine((data) => Object.values(data).some((value) => value !== undefined), "لا يوجد ما يُعدّل");
exports.ClientLoanParamsSchema = zod_1.z.object({ loanID: idSchema });
exports.ClientLoansListSchema = zod_1.z.object({
    page: idSchema.default(1),
    size: numericInput.pipe(zod_1.z.coerce.number().int().min(1).max(100)).default(10),
    client_id: idSchema.optional(),
    status: zod_1.z.enum(["open", "settled", "all"]).default("all"),
    /** true: deleted loans only (deleted items). */
    deleted: booleanInput.optional().default(false)
});
//# sourceMappingURL=clientLoans.dto.js.map