import type { Prisma } from "@prisma/client";

export const clientReceiptSelect={
    id:true,
    receiptNumber:true,
    clientId:true,
    branchId:true,
    client:{
        select:{
            id:true,
            user:{
                select:{
                    name:true,
                    phone:true
                }
            },
            company:{
                select:{
                    id:true,
                    logo:true
                }
            },
        }
    },
    branch:{
        select:{
            name:true
        }
    }
} satisfies Prisma.ClientOrderReceiptSelect

export const receiptReform = (
    receipt: Prisma.ClientOrderReceiptGetPayload<{
        select: typeof clientReceiptSelect;
    }> | null
) => {
    if (!receipt) {
        return null;
    }
    const receiptReformed = {
        ...receipt,
        // TODO
        client: {
            name: receipt.client.user.name,
            phone: receipt.client.user.phone,
            companyLogo:receipt.client.company.logo,
            companyId:receipt.client.company.id
        },
        
    };
    return receiptReformed;
};