import { z } from "zod";

export const clientReceiptCreateSchema=z.object({
    // receiptNumber:z.number(),
    clientId:z.coerce.number(),
    branchId:z.coerce.number()
})
export type clientReceiptCreateType =z.infer<typeof clientReceiptCreateSchema>