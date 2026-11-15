import { z } from "zod";

// How the client handled an order the delivery agent put in processing.
export const clientProcessingActions = {
    CONTACTED_REDELIVER: "تم التواصل - يرجى إعادة التوصيل",
    CONTACT_WHATSAPP: "تواصل واتساب",
    SEND_SMS: "ارسل رسالة نصية",
    CHANGE_PHONE: "تغيير رقم الهاتف",
    OTHER: "أخرى"
} as const;

export type ClientProcessingAction = keyof typeof clientProcessingActions;

const numericInput = z.union([z.number(), z.string().trim().min(1)]);

export const ClientProcessOrderSchema = z
    .object({
        action: z.enum(Object.keys(clientProcessingActions) as [ClientProcessingAction, ...ClientProcessingAction[]]),
        note: z.string().trim().max(300).optional(),
        phone: z.string().trim().max(20).optional()
    })
    .strict()
    .superRefine((data, ctx) => {
        if (data.action === "CHANGE_PHONE" && !data.phone) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["phone"], message: "ادخل رقم الهاتف الجديد" });
        }
        if (data.action === "OTHER" && !data.note) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["note"], message: "اكتب ملاحظة المعالجة" });
        }
    });

export const ClientProcessingListSchema = z.object({
    state: z.enum(["pending", "processed"]).default("pending"),
    page: numericInput.pipe(z.coerce.number().int().positive()).default(1),
    size: numericInput.pipe(z.coerce.number().int().min(1).max(50)).default(10)
});

export const ClientProcessingParamsSchema = z.object({ orderID: z.string().trim().min(1).max(64) });

export type ClientProcessOrderType = z.infer<typeof ClientProcessOrderSchema>;
export type ClientProcessingListType = z.infer<typeof ClientProcessingListSchema>;
