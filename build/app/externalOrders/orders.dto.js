"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateShipmentsSchema = exports.ShipmentSchema = exports.OrderCreateSchema = void 0;
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
exports.OrderCreateSchema = zod_1.z.object({
    receiptNumber: zod_1.z.string().optional(),
    clientName: zod_1.z
        .string()
        .min(5, { message: "يجب إدخال اسم العميل اكثر من 5 حروف" }),
    storeName: zod_1.z
        .string()
        .min(4, { message: "يجب إدخال اسم المتجر اكثر من 4 حروف" }),
    clientPhone: zod_1.z
        .string()
        .min(11, { message: "يجب إدخال رقم هاتف العميل من 11 رقم" }),
    recipientName: zod_1.z.string().optional().default("غير معرف"),
    confirmed: zod_1.z.coerce.boolean().optional(),
    status: zod_1.z.nativeEnum(client_1.OrderStatus).default(client_1.OrderStatus.REGISTERED),
    recipientPhones: zod_1.z.array(zod_1.z.string().min(6)).optional(),
    recipientPhone: zod_1.z.string().min(6).optional(),
    recipientAddress: zod_1.z.string(),
    details: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
    governorate: zod_1.z.nativeEnum(client_1.Governorate),
    locationID: zod_1.z.coerce.number(),
    totalCost: zod_1.z.number(),
    quantity: zod_1.z.number().default(1),
});
exports.ShipmentSchema = zod_1.z.object({
    shipment_id: zod_1.z.number(),
    shipment_number: zod_1.z.string(),
    receiver_name: zod_1.z.string().min(1).nullable(),
    receiver_phone_1: zod_1.z.string().min(11, {
        message: "يجب إدخال رقم هاتف المستلم من 11 رقم",
    }),
    governorate_code: zod_1.z.string(),
    city_name: zod_1.z.string(),
    city: zod_1.z.string(),
    address: zod_1.z.string(),
    amount_iqd: zod_1.z.number(),
    quantity: zod_1.z.number().default(1),
    note: zod_1.z.string().nullish(),
    sender_name: zod_1.z.string(),
    sender_phone: zod_1.z.string(),
    is_proof_of_delivery: zod_1.z.coerce.boolean().default(false),
    is_fragile: zod_1.z.coerce.boolean().default(false),
});
exports.CreateShipmentsSchema = zod_1.z.object({
    system_code: zod_1.z.string(),
    shipments: zod_1.z.array(exports.ShipmentSchema),
});
//# sourceMappingURL=orders.dto.js.map