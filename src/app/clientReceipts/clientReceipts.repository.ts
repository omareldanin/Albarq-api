import { clientReceiptCreateType } from "./clientReceipts.dto";
import { prisma } from "../../database/db";
import { AppError } from "../../lib/AppError";
import { clientReceiptSelect, receiptReform } from "./clientReceipts.responses";

export class clientReceiptsRepository{
    async createClientReceipt(data:{
        clientID:number,
        receiptData:clientReceiptCreateType
    }){
        const client = await prisma.client.findUnique({
            where: {
                id: data.clientID
            },
            select: {
                id:true
            }
        });

        if (!client) {
            throw new AppError("العميل غير موجود", 400);
        }

        const createdReceipt=await prisma.clientOrderReceipt.create({
            data:{
                clientId:client.id,
                receiptNumber:data.receiptData.receiptNumber,
                branchId:data.receiptData.branchId
            },
            select:clientReceiptSelect
        })

        return receiptReform(createdReceipt)
    }
}