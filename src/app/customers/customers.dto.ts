import {z} from "zod";
import {AppError} from "../../lib/AppError";

/** Any Iraqi mobile format → "07XXXXXXXXX" (Arabic digits, +964, 00964, spaces). */
export const toLocalPhone = (input: string) => {
  const digits = input
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/\D/g, "")
    .replace(/^(?:00|0)?964(?=\d)/, "0");
  return digits.startsWith("0") ? digits : `0${digits}`;
};

/** The ways the same number may have been saved on older orders. */
export const phoneVariants = (local: string) => {
  const rest = local.slice(1); // without the leading 0
  return [local, rest, `964${rest}`, `+964${rest}`, `00964${rest}`];
};

export const CustomerLookupQuerySchema = z.object({
  phone: z
    .string()
    .trim()
    .min(1)
    .transform(toLocalPhone)
    .refine((phone) => /^07\d{9}$/.test(phone), {
      message: "رقم الهاتف غير صحيح",
    }),
});

export const assertPhone = (phone: unknown) => {
  const parsed = CustomerLookupQuerySchema.safeParse({phone});
  if (!parsed.success) throw new AppError("رقم الهاتف غير صحيح", 400);
  return parsed.data.phone;
};
