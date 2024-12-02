// // import { generateMock } from "@anatine/zod-mock";
import { generateSchema } from "@anatine/zod-openapi";
import {
    DeliveryType,
    Governorate,
    OrderStatus,
    OrderTimelineType,
    ReportType,
    SecondaryStatus
} from "@prisma/client";
import { z } from "zod";

export const OrderCreateBaseSchema = z.object({
    receiptNumber: z.number().optional(),
    recipientName: z.string().optional().default("غير معرف"),
    confirmed: z.boolean().optional(),
    status: z.nativeEnum(OrderStatus).default(OrderStatus.REGISTERED),
    recipientPhones: z.array(z.string().min(6)).optional(),
    recipientPhone: z.string().min(6).optional(),
    recipientAddress: z.string(),
    notes: z.string().optional(),
    details: z.string().optional(),
    deliveryType: z.nativeEnum(DeliveryType).default(DeliveryType.NORMAL),
    governorate: z.nativeEnum(Governorate),
    locationID: z.coerce.number(),
    storeID: z.coerce.number(),
    repositoryID: z.coerce.number().optional(),
    branchID: z.coerce.number().optional(),
    clientID: z.coerce.number().optional(),
    inquiryEmployeesIDs: z.array(z.coerce.number()).optional(),
    forwardedCompanyID: z.coerce.number().optional()
});

export const OrderCreateSchema = z
    .discriminatedUnion("withProducts", [
        z.object({
            withProducts: z.literal(true),
            products: z.array(
                z.object({
                    productID: z.coerce.number(),
                    quantity: z.number().min(1).default(1),
                    colorID: z.coerce.number().optional(),
                    sizeID: z.coerce.number().optional()
                })
            )
        }),
        z.object({
            withProducts: z.literal(false),
            totalCost: z.number(),
            quantity: z.number().default(1),
            weight: z.number().optional()
        })
    ])
    .and(OrderCreateBaseSchema);

export type OrderCreateType = z.infer<typeof OrderCreateSchema>;

export const OrderCreateOpenAPISchema = generateSchema(OrderCreateSchema);

// export const OrderCreateMock = generateMock(OrderCreateSchema);

/* --------------------------------------------------------------- */

// export const OrderUpdateSchema = OrderCreateSchema.partial();

export const OrderUpdateSchema = z
    .object({
        quantity: z.number(),
        totalCost: z.number(),
        paidAmount: z.number(),
        receiptNumber: z.number(),
        processed: z.boolean(),
        confirmed: z.boolean(),
        discount: z.number(),
        status: z.nativeEnum(OrderStatus),
        secondaryStatus: z.nativeEnum(SecondaryStatus),
        deliveryAgentID: z.coerce.number().or(z.literal(null)).optional(),
        oldDeliveryAgentId: z.coerce.number().or(z.literal(null)).optional(),
        deliveryDate: z.coerce.date(),
        recipientName: z.string(),
        recipientPhones: z.array(z.string().min(6)),
        recipientPhone: z.string().min(6),
        recipientAddress: z.string(),
        notes: z.string(),
        details: z.string(),
        repositoryID: z.coerce.number(),
        branchID: z.coerce.number(),
        currentLocation: z.string(),
        clientID: z.coerce.number(),
        inquiryEmployeesIDs: z.array(z.coerce.number()),
        forwardedCompanyID: z.coerce.number().optional()
    })
    .partial();

export type OrderUpdateType = z.infer<typeof OrderUpdateSchema>;

export const OrderUpdateOpenAPISchema = generateSchema(OrderUpdateSchema);

// export const OrderUpdateMock = generateMock(OrderUpdateSchema);

/* --------------------------------------------------------------- */

export const OrderRepositoryConfirmByReceiptNumberSchema = z.object({
    repositoryID: z.coerce.number()
});
export type OrderRepositoryConfirmByReceiptNumberType = z.infer<
    typeof OrderRepositoryConfirmByReceiptNumberSchema
>;

export const OrderRepositoryConfirmByReceiptNumberOpenAPISchema = generateSchema(
    OrderRepositoryConfirmByReceiptNumberSchema
);

/* --------------------------------------------------------------- */

export const OrdersReceiptsCreateSchema = z.object({
    ordersIDs: z.array(z.coerce.number()).min(1)
});

export type OrdersReceiptsCreateType = z.infer<typeof OrdersReceiptsCreateSchema>;

export const OrdersReceiptsCreateOpenAPISchema = generateSchema(OrdersReceiptsCreateSchema);

// export const OrdersReceiptsCreateMock = generateMock(OrdersReceiptsCreateSchema);

/* --------------------------------------------------------------- */

export const OrderTimelinePieceBaseSchema = z.object({
    date: z.date(),
    message: z.string(),
    by: z.object({
        id: z.coerce.number(),
        name: z.string()
        // role: z.nativeEnum(EmployeeRole || AdminRole || ClientRole).
    })
});

export const OrderTimelinePieceSchema = z
    .discriminatedUnion("type", [
        z.object({
            type: z.enum([OrderTimelineType.STATUS_CHANGE]),
            old: z
                .object({
                    value: z.nativeEnum(OrderStatus)
                })
                .or(z.literal(null)),
            new: z
                .object({
                    value: z.nativeEnum(OrderStatus)
                })
                .or(z.literal(null))
        }),
        z.object({
            type: z.enum([OrderTimelineType.CURRENT_LOCATION_CHANGE]),
            old: z
                .object({
                    value: z.string()
                })
                .or(z.literal(null)),
            new: z
                .object({
                    value: z.string()
                })
                .or(z.literal(null))
        }),
        z.object({
            type: z.enum([
                OrderTimelineType.DELIVERY_AGENT_CHANGE,
                OrderTimelineType.CLIENT_CHANGE,
                OrderTimelineType.REPOSITORY_CHANGE,
                OrderTimelineType.BRANCH_CHANGE,
                OrderTimelineType.COMPANY_CHANGE
            ]),
            old: z
                .object({
                    id: z.coerce.number(),
                    name: z.string()
                })
                .or(z.literal(null)),
            new: z
                .object({
                    id: z.coerce.number(),
                    name: z.string()
                })
                .or(z.literal(null))
        }),
        z.object({
            type: z.enum([OrderTimelineType.PAID_AMOUNT_CHANGE]),
            old: z
                .object({
                    value: z.coerce.number()
                })
                .or(z.literal(null)),
            new: z
                .object({
                    value: z.coerce.number()
                })
                .or(z.literal(null))
        }),
        z.object({
            type: z.enum([OrderTimelineType.REPORT_DELETE, OrderTimelineType.REPORT_CREATE]),
            old: z
                .object({
                    id: z.coerce.number(),
                    type: z.nativeEnum(ReportType)
                })
                .or(z.literal(null)),
            new: z
                .object({
                    id: z.coerce.number(),
                    type: z.nativeEnum(ReportType)
                })
                .or(z.literal(null))
        }),
        z.object({
            type: z.enum([
                OrderTimelineType.ORDER_DELIVERY,
                OrderTimelineType.OTHER,
                OrderTimelineType.ORDER_CREATION,
                OrderTimelineType.ORDER_CONFIRMATION,
                OrderTimelineType.ORDER_PROCESS
            ]),
            old: z.literal(null),
            new: z.literal(null)
        })
    ])
    .and(OrderTimelinePieceBaseSchema);

export type OrderTimelinePieceType = z.infer<typeof OrderTimelinePieceSchema>;

/* --------------------------------------------------------------- */

export const OrderTimelineFiltersSchema = z.object({
    type: z.nativeEnum(OrderTimelineType).optional(),
    types: z.preprocess((val) => {
        if (typeof val === "string") {
            return val.split(",");
        }
        return val;
    }, z.array(z.nativeEnum(OrderTimelineType)).optional())
});

export type OrderTimelineFiltersType = z.infer<typeof OrderTimelineFiltersSchema>;

/* --------------------------------------------------------------- */

export const OrderChatNotificationCreateSchema = z.object({
    title: z.string().optional().default("رسالة جديدة"),
    content: z.string().optional()
});

export type OrderChatNotificationCreateType = z.infer<typeof OrderChatNotificationCreateSchema>;

// export const OrderChatNotificationCreateOpenAPISchema = generateSchema(
//     OrderChatNotificationCreateSchema
// );

// export const OrderChatNotificationCreateMock = generateMock(ChatNotificationCreateSchema);

/* --------------------------------------------------------------- */

export const OrdersFiltersSchema = z.object({
    confirmed: z.preprocess((val) => {
        if (val === "true") return true;
        if (val === "false") return false;
        return val;
    }, z.boolean().optional()),
    forwarded: z.preprocess((val) => {
        if (val === "true") return true;
        if (val === "false") return false;
        return val;
    }, z.boolean().optional()),
    processed: z.preprocess((val) => {
        if (val === "true") return true;
        if (val === "false") return false;
        return val;
    }, z.boolean().optional()),
    forwardedByID: z.coerce.number().optional(),
    forwardedFromID: z.coerce.number().optional(),
    clientID: z.coerce.number().optional(),
    deliveryAgentID: z.coerce.number().optional(),
    companyID: z.coerce.number().optional(),
    automaticUpdateID: z.coerce.number().optional(),
    search: z.string().optional(),
    sort: z.string().optional().default("id:desc"),
    page: z.coerce.number().optional().default(1),
    size: z.coerce.number().optional().default(10),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    deliveryDate: z.coerce.date().optional(),
    governorate: z.nativeEnum(Governorate).optional(),
    statuses: z.preprocess((val) => {
        if (typeof val === "string") {
            return val.split(",");
        }
        return val;
    }, z.array(z.nativeEnum(OrderStatus)).optional()),
    // secondaryStatuses: z.preprocess((val) => {
    //     if (typeof val === "string") {
    //         return val.split(",");
    //     }
    //     return val;
    // }, z.array(z.nativeEnum(SecondaryStatus)).optional()),
    // secondaryStatus: z.nativeEnum(SecondaryStatus).optional(),
    status: z.nativeEnum(OrderStatus).optional(),
    deliveryType: z.nativeEnum(DeliveryType).optional(),
    storeID: z.coerce.number().optional(),
    repositoryID: z.coerce.number().optional(),
    branchID: z.coerce.number().optional(),
    productID: z.coerce.number().optional(),
    locationID: z.coerce.number().optional(),
    receiptNumber: z.coerce.number().optional(),
    receiptNumbers: z.preprocess((val) => {
        if (typeof val === "string") {
            return val.split(",");
        }
        return val;
    }, z.array(z.coerce.number()).optional()),
    recipientName: z.string().optional(),
    recipientPhone: z.string().optional(),
    recipientAddress: z.string().optional(),
    clientReport: z.string().optional(),
    repositoryReport: z.string().optional(),
    branchReport: z.string().optional(),
    deliveryAgentReport: z.string().optional(),
    governorateReport: z.string().optional(),
    companyReport: z.string().optional(),
    notes: z.string().optional(),
    deleted: z.preprocess((val) => {
        if (val === "true") return true;
        if (val === "false") return false;
        return false;
    }, z.boolean().default(false).optional()),
    orderID: z.coerce.number().optional(),
    minified: z.preprocess((val) => {
        if (val === "true") return true;
        if (val === "false") return false;
        return val;
    }, z.boolean().optional()),
    inquiryBranchesIDs: z.array(z.coerce.number()).optional(),
    inquiryLocationsIDs: z.array(z.coerce.number()).optional(),
    inquiryStoresIDs: z.array(z.coerce.number()).optional(),
    inquiryCompaniesIDs: z.array(z.coerce.number()).optional(),
    inquiryDeliveryAgentsIDs: z.array(z.coerce.number()).optional(),
    inquiryGovernorates: z.array(z.nativeEnum(Governorate)).optional(),
    inquiryStatuses: z.array(z.nativeEnum(OrderStatus)).optional()
});

export type OrdersFiltersType = z.infer<typeof OrdersFiltersSchema>;

export const OrdersFiltersOpenAPISchema = generateSchema(OrdersFiltersSchema);

// export const OrdersFiltersMock = generateMock(OrdersFiltersSchema);

/* --------------------------------------------------------------- */

export const OrdersStatisticsFiltersSchema = z.object({
    clientID: z.coerce.number().optional(),
    deliveryAgentID: z.coerce.number().optional(),
    companyID: z.coerce.number().optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    governorate: z.nativeEnum(Governorate).optional(),
    statuses: z.preprocess((val) => {
        if (typeof val === "string") {
            return val.split(",");
        }
        return val;
    }, z.array(z.nativeEnum(OrderStatus)).optional()),
    deliveryType: z.nativeEnum(DeliveryType).optional(),
    storeID: z.coerce.number().optional(),
    locationID: z.coerce.number().optional(),
    clientReport: z.preprocess((val) => {
        if (val === "true") return true;
        if (val === "false") return false;
        return val;
    }, z.boolean().optional()),
    repositoryReport: z.preprocess((val) => {
        if (val === "true") return true;
        if (val === "false") return false;
        return val;
    }, z.boolean().optional()),
    branchReport: z.preprocess((val) => {
        if (val === "true") return true;
        if (val === "false") return false;
        return val;
    }, z.boolean().optional()),
    deliveryAgentReport: z.preprocess((val) => {
        if (val === "true") return true;
        if (val === "false") return false;
        return val;
    }, z.boolean().optional()),
    governorateReport: z.preprocess((val) => {
        if (val === "true") return true;
        if (val === "false") return false;
        return val;
    }, z.boolean().optional()),
    companyReport: z.preprocess((val) => {
        if (val === "true") return true;
        if (val === "false") return false;
        return val;
    }, z.boolean().optional()),
    inquiryBranchesIDs: z.array(z.coerce.number()).optional(),
    inquiryLocationsIDs: z.array(z.coerce.number()).optional(),
    inquiryStoresIDs: z.array(z.coerce.number()).optional(),
    inquiryCompaniesIDs: z.array(z.coerce.number()).optional(),
    inquiryDeliveryAgentsIDs: z.array(z.coerce.number()).optional(),
    inquiryGovernorates: z.array(z.nativeEnum(Governorate)).optional(),
    inquiryStatuses: z.array(z.nativeEnum(OrderStatus)).optional()
});

export type OrdersStatisticsFiltersType = z.infer<typeof OrdersStatisticsFiltersSchema>;

export const OrdersStatisticsFiltersOpenAPISchema = generateSchema(OrdersStatisticsFiltersSchema);

// export const OrdersStatisticsFiltersMock = generateMock(OrdersStatisticsFiltersSchema);

/* --------------------------------------------------------------- */

export const OrdersReportPDFCreateSchema = z.object({
    ordersIDs: z.array(z.coerce.number()).min(1).or(z.literal("*")),
    type: z.literal("GENERAL").or(z.literal("DELIVERY_AGENT_MANIFEST"))
});

export type OrdersReportPDFCreateType = z.infer<typeof OrdersReportPDFCreateSchema>;
