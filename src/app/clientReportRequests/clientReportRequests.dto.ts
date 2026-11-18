import { ReportReceiveMethod, ReportRequestStatus } from "@prisma/client";
import { z } from "zod";

const numericInput = z.union([z.number(), z.string().trim().min(1)]);
const idSchema = numericInput.pipe(z.coerce.number().int().positive().max(2147483647));

export const ReportRequestCreateSchema = z
    .object({
        receiveMethod: z.nativeEnum(ReportReceiveMethod),
        note: z.string().trim().max(300).optional()
    })
    .strict();

export const ReportRequestParamsSchema = z.object({ requestID: idSchema });

export const ReportRequestRejectSchema = z
    .object({ reason: z.string().trim().min(1, "اكتب سبب الرفض").max(300) })
    .strict();

export const ReportRequestsListSchema = z.object({
    page: idSchema.default(1),
    size: numericInput.pipe(z.coerce.number().int().min(1).max(100)).default(10),
    status: z.nativeEnum(ReportRequestStatus).optional(),
    client_id: idSchema.optional()
});

export type ReportRequestCreateType = z.infer<typeof ReportRequestCreateSchema>;
export type ReportRequestsListType = z.infer<typeof ReportRequestsListSchema>;
