import { generateSchema } from "@anatine/zod-openapi";
import { TransactionType } from "@prisma/client";
import { z } from "zod";

// Accept JSON numbers and multipart/query strings without coercing null or booleans.
const numericInput = z.union([z.number(), z.string().trim().min(1)]);
const idSchema = numericInput.pipe(z.coerce.number().int().positive().max(2147483647));

const walletFields = z
    .object({
        employeeID: idSchema.nullable().optional()
    })
    .strict();

export const EmployeeWalletCreateSchema = walletFields;

export const EmployeeWalletUpdateSchema = walletFields.refine(
    (data) => Object.values(data).some((value) => value !== undefined),
    { message: "يجب تحديد حقل واحد على الأقل للتعديل" }
);

export const EmployeeWalletParamsSchema = z.object({ walletID: idSchema });

const paginationSchema = z.object({
    page: idSchema.default(1),
    size: numericInput.pipe(z.coerce.number().int().min(1).max(100)).default(10)
});

export const EmployeeWalletListSchema = paginationSchema
    .extend({
        branch_id: idSchema.optional(),
        employee_id: idSchema.optional()
    })
    .strict();

const transactionQuerySchema = paginationSchema
    .extend({
        start_date: z.string().date().optional(),
        end_date: z.string().date().optional(),
        target_branch_id: idSchema.optional(),
        target_client_id: idSchema.optional(),
        type: z.nativeEnum(TransactionType).optional(),
        approved: z
            .enum(["true", "false"])
            .transform((value) => value === "true")
            .optional()
    })
    .strict();

const validDateRange = ({ start_date, end_date }: { start_date?: string; end_date?: string }) =>
    !start_date || !end_date || start_date <= end_date;
const dateRangeError = { message: "تاريخ النهاية يجب أن يكون بعد تاريخ البداية", path: ["end_date"] };

export const EmployeeWalletTransactionsSchema = transactionQuerySchema.refine(validDateRange, dateRangeError);
export const EmployeeWalletTransactionsExportSchema = transactionQuerySchema
    .omit({ page: true, size: true })
    .refine(validDateRange, dateRangeError);
export type EmployeeWalletTransactionsExportType = z.infer<typeof EmployeeWalletTransactionsExportSchema>;

export type EmployeeWalletCreateType = z.infer<typeof EmployeeWalletCreateSchema>;
export type EmployeeWalletUpdateType = z.infer<typeof EmployeeWalletUpdateSchema>;
export type EmployeeWalletListType = z.infer<typeof EmployeeWalletListSchema>;
export type EmployeeWalletTransactionsType = z.infer<typeof EmployeeWalletTransactionsSchema>;

function generateWalletSchema(schema: z.ZodTypeAny) {
    const generated = generateSchema(schema, true, "3.0");
    // This converter emits a null type for nullable fields; OpenAPI 3.0 uses nullable instead.
    return {
        ...generated,
        properties: {
            ...generated.properties,
            employeeID: { ...generateSchema(idSchema, true, "3.0"), nullable: true }
        }
    };
}

export const EmployeeWalletCreateOpenAPISchema = generateWalletSchema(EmployeeWalletCreateSchema);
export const EmployeeWalletUpdateOpenAPISchema = {
    ...generateWalletSchema(EmployeeWalletUpdateSchema),
    minProperties: 1
};

export const EmployeeWalletTargetsSchema = paginationSchema
    .extend({
        kind: z.enum(["branch", "client"]),
        search: z.string().trim().max(100).optional()
    })
    .strict();
export type EmployeeWalletTargetsType = z.infer<typeof EmployeeWalletTargetsSchema>;

export const EmployeeWalletTransactionCreateSchema = z
    .object({
        type: z.enum(["DEPOSIT", "WITHDRAW", "FROM_BRANCH", "TO_BRANCH", "FROM_CLIENT", "TO_CLIENT"]),
        for: z.string().trim().min(1).max(2000),
        paidAmount: numericInput.pipe(z.coerce.number().finite().positive().max(Number.MAX_SAFE_INTEGER)),
        targetBranchId: idSchema.optional(),
        targetClientId: idSchema.optional()
    })
    .strict()
    .superRefine((data, context) => {
        const branch = data.type === "FROM_BRANCH" || data.type === "TO_BRANCH";
        const client = data.type === "FROM_CLIENT" || data.type === "TO_CLIENT";
        if (branch && !data.targetBranchId)
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["targetBranchId"],
                message: "يجب تحديد الفرع المستهدف"
            });
        if (client && !data.targetClientId)
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["targetClientId"],
                message: "يجب تحديد العميل المستهدف"
            });
        if (!branch && data.targetBranchId !== undefined)
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["targetBranchId"],
                message: "الفرع المستهدف غير مطلوب لهذا النوع"
            });
        if (!client && data.targetClientId !== undefined)
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["targetClientId"],
                message: "العميل المستهدف غير مطلوب لهذا النوع"
            });
    });
export type EmployeeWalletTransactionCreateType = z.infer<typeof EmployeeWalletTransactionCreateSchema>;
export const EmployeeWalletTransactionCreateOpenAPISchema = generateSchema(
    EmployeeWalletTransactionCreateSchema,
    true,
    "3.0"
);
