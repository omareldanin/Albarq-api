"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertPhone = exports.CustomerLookupQuerySchema = exports.phoneVariants = exports.toLocalPhone = void 0;
const zod_1 = require("zod");
const AppError_1 = require("../../lib/AppError");
/** Any Iraqi mobile format → "07XXXXXXXXX" (Arabic digits, +964, 00964, spaces). */
const toLocalPhone = (input) => {
    const digits = input
        .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
        .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
        .replace(/\D/g, "")
        .replace(/^(?:00|0)?964(?=\d)/, "0");
    return digits.startsWith("0") ? digits : `0${digits}`;
};
exports.toLocalPhone = toLocalPhone;
/** The ways the same number may have been saved on older orders. */
const phoneVariants = (local) => {
    const rest = local.slice(1); // without the leading 0
    return [local, rest, `964${rest}`, `+964${rest}`, `00964${rest}`];
};
exports.phoneVariants = phoneVariants;
exports.CustomerLookupQuerySchema = zod_1.z.object({
    phone: zod_1.z
        .string()
        .trim()
        .min(1)
        .transform(exports.toLocalPhone)
        .refine((phone) => /^07\d{9}$/.test(phone), {
        message: "رقم الهاتف غير صحيح",
    }),
});
const assertPhone = (phone) => {
    const parsed = exports.CustomerLookupQuerySchema.safeParse({ phone });
    if (!parsed.success)
        throw new AppError_1.AppError("رقم الهاتف غير صحيح", 400);
    return parsed.data.phone;
};
exports.assertPhone = assertPhone;
//# sourceMappingURL=customers.dto.js.map