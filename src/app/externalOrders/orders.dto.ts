import {Governorate, OrderStatus} from "@prisma/client";
import {z} from "zod";

export const OrderCreateSchema = z.object({
  receiptNumber: z.string().optional(),
  clientName: z
    .string()
    .min(5, {message: "يجب إدخال اسم العميل اكثر من 5 حروف"}),
  storeName: z
    .string()
    .min(4, {message: "يجب إدخال اسم المتجر اكثر من 4 حروف"}),
  clientPhone: z
    .string()
    .min(11, {message: "يجب إدخال رقم هاتف العميل من 11 رقم"}),
  recipientName: z.string().optional().default("غير معرف"),
  confirmed: z.coerce.boolean().optional(),
  status: z.nativeEnum(OrderStatus).default(OrderStatus.REGISTERED),
  recipientPhones: z.array(z.string().min(6)).optional(),
  recipientPhone: z.string().min(6).optional(),
  recipientAddress: z.string(),
  details: z.string().optional(),
  notes: z.string().optional(),
  governorate: z.nativeEnum(Governorate),
  locationID: z.coerce.number(),
  totalCost: z.number(),
  quantity: z.number().default(1),
});

export type OrderCreateType = z.infer<typeof OrderCreateSchema>;

export const ShipmentSchema = z.object({
  shipment_id: z.number(),
  shipment_number: z.string(),
  receiver_name: z.string().optional().default("غير معرف"),
  receiver_phone_1: z.string(),
  governorate_code: z.string(),
  city_name: z.string(),
  city: z.string(),
  address: z.string(),
  amount_iqd: z.number().default(0),
  quantity: z.number().default(1),
  note: z.string().nullish(),
  sender_name: z.string().nullish(),
  sender_phone: z.string(),
});

export const CreateShipmentsSchema = z.object({
  system_code: z.string(),
  shipments: z.array(ShipmentSchema),
});

export type ShipmentType = z.infer<typeof ShipmentSchema>;
export type CreateShipmentsType = z.infer<typeof CreateShipmentsSchema>;
