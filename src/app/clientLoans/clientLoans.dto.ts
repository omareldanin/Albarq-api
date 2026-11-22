import { z } from "zod";

// Accept JSON numbers and multipart/query strings.
const numericInput = z.union([z.number(), z.string().trim().min(1)]);
const idSchema = numericInput.pipe(z.coerce.number().int().positive().max(2147483647));
const booleanInput = z.union([z.boolean(), z.enum(["true", "false"]).transform((value) => value === "true")]);

const amountSchema = numericInput.pipe(
    z.coerce.number().positive("مبلغ السلفة يجب أن يكون أكبر من صفر").max(1_000_000_000)
);

export const ClientLoanCreateSchema = z
    .object({
        clientID: idSchema,
        amount: amountSchema,
        note: z.string().trim().max(300).optional(),
        // Same meaning as for other treasury transactions (main treasury = approved).
        approved: booleanInput.optional().default(false)
    })
    .strict();

/** Open loans only (not deducted in a report). */
export const ClientLoanUpdateSchema = z
    .object({
        clientID: idSchema.optional(),
        amount: amountSchema.optional(),
        note: z.string().trim().max(300).optional()
    })
    .strict()
    .refine((data) => Object.values(data).some((value) => value !== undefined), "لا يوجد ما يُعدّل");

export const ClientLoanParamsSchema = z.object({ loanID: idSchema });

export const ClientLoansListSchema = z.object({
    page: idSchema.default(1),
    size: numericInput.pipe(z.coerce.number().int().min(1).max(100)).default(10),
    client_id: idSchema.optional(),
    status: z.enum(["open", "settled", "all"]).default("all"),
    /** true: deleted loans only (deleted items). */
    deleted: booleanInput.optional().default(false)
});

export type ClientLoanCreateType = z.infer<typeof ClientLoanCreateSchema>;
export type ClientLoanUpdateType = z.infer<typeof ClientLoanUpdateSchema>;
export type ClientLoansListType = z.infer<typeof ClientLoansListSchema>;
