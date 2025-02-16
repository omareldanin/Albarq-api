import { clientReceiptCreateType } from "./clientReceipts.dto";
import { prisma } from "../../database/db";
import { AppError } from "../../lib/AppError";
import { clientReceiptSelect, receiptReform } from "./clientReceipts.responses";

export class clientReceiptsRepository{
    async createClientReceipt(data:{
        storeId:number,
        receiptData:clientReceiptCreateType
    }){
        const store = await prisma.store.findUnique({
            where: {
                id: data.storeId
            },
            select: {
                id:true
            }
        });

        if (!store) {
            throw new AppError("العميل غير موجود", 400);
        }

        const createdReceipt=await prisma.clientOrderReceipt.create({
            data:{
                storeId:store.id,
                branchId:data.receiptData.branchId
            },
            select:clientReceiptSelect
        })

        return receiptReform(createdReceipt)
    }
}