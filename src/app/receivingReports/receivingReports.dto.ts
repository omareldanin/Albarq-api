import { z } from "zod";

// Accept JSON numbers and query strings without coercing null or booleans.
const numericInput = z.union([z.number(), z.string().trim().min(1)]);
const idSchema = numericInput.pipe(z.coerce.number().int().positive().max(2147483647));

export const ReceivingReportCreateSchema = z
    .object({
        // Limit the report to one client; omitted = all of the agent's clients.
        clientID: idSchema.optional(),
        // Limit the report to these orders; omitted = every eligible order.
        ordersIDs: z.array(z.string().trim().min(1)).min(1).max(5000).optional()
    })
    .strict();

export const ReceivingReportParamsSchema = z.object({ reportID: idSchema });

export const ReceivingReportsListSchema = z
    .object({
        page: idSchema.default(1),
        size: numericInput.pipe(z.coerce.number().int().min(1).max(100)).default(10),
        start_date: z.string().date().optional(),
        end_date: z.string().date().optional(),
        client_id: idSchema.optional(),
        receiving_agent_id: idSchema.optional()
    })
    .refine(({ start_date, end_date }) => !start_date || !end_date || start_date <= end_date, {
        message: "تاريخ النهاية يجب أن يكون بعد تاريخ البداية",
        path: ["end_date"]
    });

export type ReceivingReportCreateType = z.infer<typeof ReceivingReportCreateSchema>;
export type ReceivingReportsListType = z.infer<typeof ReceivingReportsListSchema>;
