"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmployeeWalletTransactionCreateOpenAPISchema = exports.EmployeeWalletTransactionCreateSchema = exports.EmployeeWalletTargetsSchema = exports.EmployeeWalletUpdateOpenAPISchema = exports.EmployeeWalletCreateOpenAPISchema = exports.EmployeeWalletTransactionsExportSchema = exports.EmployeeWalletTransactionsSchema = exports.EmployeeWalletListSchema = exports.EmployeeWalletParamsSchema = exports.EmployeeWalletUpdateSchema = exports.EmployeeWalletCreateSchema = void 0;
const zod_openapi_1 = require("@anatine/zod-openapi");
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
// Accept JSON numbers and multipart/query strings without coercing null or booleans.
const numericInput = zod_1.z.union([zod_1.z.number(), zod_1.z.string().trim().min(1)]);
const idSchema = numericInput.pipe(zod_1.z.coerce.number().int().positive().max(2147483647));
const walletFields = zod_1.z
    .object({
    employeeID: idSchema.nullable().optional()
})
    .strict();
exports.EmployeeWalletCreateSchema = walletFields;
exports.EmployeeWalletUpdateSchema = walletFields.refine((data) => Object.values(data).some((value) => value !== undefined), { message: "يجب تحديد حقل واحد على الأقل للتعديل" });
exports.EmployeeWalletParamsSchema = zod_1.z.object({ walletID: idSchema });
const paginationSchema = zod_1.z.object({
    page: idSchema.default(1),
    size: numericInput.pipe(zod_1.z.coerce.number().int().min(1).max(100)).default(10)
});
exports.EmployeeWalletListSchema = paginationSchema
    .extend({
    branch_id: idSchema.optional(),
    employee_id: idSchema.optional()
})
    .strict();
const transactionQuerySchema = paginationSchema
    .extend({
    start_date: zod_1.z.string().date().optional(),
    end_date: zod_1.z.string().date().optional(),
    target_branch_id: idSchema.optional(),
    target_client_id: idSchema.optional(),
    type: zod_1.z.nativeEnum(client_1.TransactionType).optional(),
    approved: zod_1.z
        .enum(["true", "false"])
        .transform((value) => value === "true")
        .optional()
})
    .strict();
const validDateRange = ({ start_date, end_date }) => !start_date || !end_date || start_date <= end_date;
const dateRangeError = { message: "تاريخ النهاية يجب أن يكون بعد تاريخ البداية", path: ["end_date"] };
exports.EmployeeWalletTransactionsSchema = transactionQuerySchema.refine(validDateRange, dateRangeError);
exports.EmployeeWalletTransactionsExportSchema = transactionQuerySchema
    .omit({ page: true, size: true })
    .refine(validDateRange, dateRangeError);
function generateWalletSchema(schema) {
    const generated = (0, zod_openapi_1.generateSchema)(schema, true, "3.0");
    // This converter emits a null type for nullable fields; OpenAPI 3.0 uses nullable instead.
    return {
        ...generated,
        properties: {
            ...generated.properties,
            employeeID: { ...(0, zod_openapi_1.generateSchema)(idSchema, true, "3.0"), nullable: true }
        }
    };
}
exports.EmployeeWalletCreateOpenAPISchema = generateWalletSchema(exports.EmployeeWalletCreateSchema);
exports.EmployeeWalletUpdateOpenAPISchema = {
    ...generateWalletSchema(exports.EmployeeWalletUpdateSchema),
    minProperties: 1
};
exports.EmployeeWalletTargetsSchema = paginationSchema
    .extend({
    kind: zod_1.z.enum(["branch", "client"]),
    search: zod_1.z.string().trim().max(100).optional()
})
    .strict();
exports.EmployeeWalletTransactionCreateSchema = zod_1.z
    .object({
    type: zod_1.z.enum(["DEPOSIT", "WITHDRAW", "FROM_BRANCH", "TO_BRANCH", "FROM_CLIENT", "TO_CLIENT"]),
    for: zod_1.z.string().trim().min(1).max(2000),
    paidAmount: numericInput.pipe(zod_1.z.coerce.number().finite().positive().max(Number.MAX_SAFE_INTEGER)),
    targetBranchId: idSchema.optional(),
    targetClientId: idSchema.optional()
})
    .strict()
    .superRefine((data, context) => {
    const branch = data.type === "FROM_BRANCH" || data.type === "TO_BRANCH";
    const client = data.type === "FROM_CLIENT" || data.type === "TO_CLIENT";
    if (branch && !data.targetBranchId)
        context.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            path: ["targetBranchId"],
            message: "يجب تحديد الفرع المستهدف"
        });
    if (client && !data.targetClientId)
        context.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            path: ["targetClientId"],
            message: "يجب تحديد العميل المستهدف"
        });
    if (!branch && data.targetBranchId !== undefined)
        context.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            path: ["targetBranchId"],
            message: "الفرع المستهدف غير مطلوب لهذا النوع"
        });
    if (!client && data.targetClientId !== undefined)
        context.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            path: ["targetClientId"],
            message: "العميل المستهدف غير مطلوب لهذا النوع"
        });
});
exports.EmployeeWalletTransactionCreateOpenAPISchema = (0, zod_openapi_1.generateSchema)(exports.EmployeeWalletTransactionCreateSchema, true, "3.0");
//# sourceMappingURL=employeeWallets.dto.js.map