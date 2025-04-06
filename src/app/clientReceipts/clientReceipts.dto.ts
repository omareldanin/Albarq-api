import { z } from "zod";

export const clientReceiptCreateSchema=z.object({
    // receiptNumber:z.number(),
    storeId:z.coerce.number(),
    branchId:z.coerce.number(),
    receiptNumber:z.coerce.string()
})
export type clientReceiptCreateType =z.infer<typeof clientReceiptCreateSchema>