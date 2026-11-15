"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientProcessingParamsSchema = exports.ClientProcessingListSchema = exports.ClientProcessOrderSchema = exports.clientProcessingActions = void 0;
const zod_1 = require("zod");
// How the client handled an order the delivery agent put in processing.
exports.clientProcessingActions = {
    CONTACTED_REDELIVER: "تم التواصل - يرجى إعادة التوصيل",
    CONTACT_WHATSAPP: "تواصل واتساب",
    SEND_SMS: "ارسل رسالة نصية",
    CHANGE_PHONE: "تغيير رقم الهاتف",
    OTHER: "أخرى"
};
const numericInput = zod_1.z.union([zod_1.z.number(), zod_1.z.string().trim().min(1)]);
exports.ClientProcessOrderSchema = zod_1.z
    .object({
    action: zod_1.z.enum(Object.keys(exports.clientProcessingActions)),
    note: zod_1.z.string().trim().max(300).optional(),
    phone: zod_1.z.string().trim().max(20).optional()
})
    .strict()
    .superRefine((data, ctx) => {
    if (data.action === "CHANGE_PHONE" && !data.phone) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ["phone"], message: "ادخل رقم الهاتف الجديد" });
    }
    if (data.action === "OTHER" && !data.note) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ["note"], message: "اكتب ملاحظة المعالجة" });
    }
});
exports.ClientProcessingListSchema = zod_1.z.object({
    state: zod_1.z.enum(["pending", "processed"]).default("pending"),
    page: numericInput.pipe(zod_1.z.coerce.number().int().positive()).default(1),
    size: numericInput.pipe(zod_1.z.coerce.number().int().min(1).max(50)).default(10)
});
exports.ClientProcessingParamsSchema = zod_1.z.object({ orderID: zod_1.z.string().trim().min(1).max(64) });
//# sourceMappingURL=clientProcessing.dto.js.map