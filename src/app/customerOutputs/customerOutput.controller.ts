import { catchAsync } from "../../lib/catchAsync";
import { prisma } from "../../database/db";
import { orderReform, orderSelect } from "../orders/orders.responses";
import { AppError } from "../../lib/AppError";
import { loggedInUserType } from "../../types/user";
import { ReportsRepository } from "../reports/reports.repository";
import { sendNotification } from "../notifications/helpers/sendNotification";
import { OrdersRepository } from "../orders/orders.repository";
import { ReportType } from "@prisma/client";
import { localizeReportType } from "../../lib/localize";
import { generateReport } from "../reports/helpers/generateReport";

const reportsRepository = new ReportsRepository();
const ordersRepository = new OrdersRepository();

export class CustomerOutputController{
    saveOrderInCache=catchAsync(async (req,res)=>{
        const loggedInUser = res.locals.user as loggedInUserType;
        
        const {orderId,clientId,companyId,type,storeId}=req.body

        let order=await prisma.order.findFirst({
            where:{
                id:orderId,
            },
            select:orderSelect
        })

        
        if(!order){
            throw new AppError("الطلب غير موجود", 404);
        }

        if(type === "company" && +companyId !== +order.company.id){
            throw new AppError("هذا الطلب غير تابع لهذه الشركه", 404);
        }

        if(type === "client" && +clientId !== +order.client.user.id){
            
            throw new AppError("هذا الطلب غير تابع لهذا العميل", 404);
        }
        
        if(type === "client" && +storeId !== +order.store.id){
            
            throw new AppError("هذا الطلب غير تابع لهذا المتجر", 404);
        }

        const checkIfExist=await prisma.customerOutput.findFirst({
            select:{
                id:true
            },
            where:{
                orderId:orderId,
            }
        })

        const userRepository=await prisma.employee.findFirst({
            select:{
                repositoryId:true
            },
            where:{
                id:loggedInUser.id
            }
        })

        if(checkIfExist){
            throw new AppError("هذا الطلب موجود بالفعل", 404);
        }

        if(!userRepository){
            throw new AppError("حسابك غير مرتبط بمخزن", 404);
        }

        await prisma.customerOutput.create({
            data:{
                orderId:orderId,
                clientId:clientId ? clientId :null,
                storeId:storeId ? storeId :null,
                companyId:companyId ? companyId : null,
                repositoryId:userRepository.repositoryId
            }
        })

        res.status(200).json({
            status: "success",
        });
    })

    getCustomerOldData=catchAsync(async(req,res)=>{
        const {clientId,companyId,size,page,type,storeId}=req.query
        
        const loggedInUser = res.locals.user as loggedInUserType;
        
        const userRepository=await prisma.employee.findFirst({
            select:{
                repositoryId:true
            },
            where:{
                id:loggedInUser.id
            }
        })

        if(!userRepository){
            throw new AppError("حسابك غير مرتبط بمخزن", 404);
        }

        const results = await prisma.customerOutput.findManyPaginated({
                where:{
                    AND:[
                        {repositoryId:userRepository.repositoryId},
                        type === "client" ? {storeId:storeId ? +storeId:null}:{},
                        type === "client" ? {clientId:clientId ? +clientId:null}:{companyId:companyId? +companyId:null}
                    ]
                },
                orderBy: {
                    id: "desc"
                },
                select:{
                    id:true,
                    order:{
                        select:orderSelect
                    }
                }
            },{
                page:page ? +page : 1,
                size:size ? +size: 10
                }
            )
        
        const newData = results.data.map(order => orderReform(order.order))
        res.status(200).json({
            status: "success",
            data: {
                count:results.dataCount,
                pageCount:results.pagesCount,
                currentPage:results.currentPage,
                orders:newData
            }
        });
    })

    saveAndCreateReport=catchAsync(async(req,res)=>{
        const {clientId,companyId,type,storeId}=req.body;

        let ordersIDs: number[] = [];

        const loggedInUser = res.locals.user as loggedInUserType;
        
        const userRepository=await prisma.employee.findFirst({
            select:{
                repositoryId:true
            },
            where:{
                id:loggedInUser.id
            }
        })

        if(!userRepository){
            throw new AppError("حسابك غير مرتبط بمخزن", 404);
        }
        const results = await prisma.customerOutput.findManyPaginated({
                where:{
                    AND:[
                        {repositoryId:userRepository.repositoryId},
                        type === "client" ? {storeId:storeId ? +storeId:null}:{},
                        type === "client" ? {clientId:clientId ? +clientId:null}:{companyId:companyId? +companyId:null}
                    ]
                },
                select:{
                    id:true,
                    order:{
                        select:orderSelect
                    }
                }
                },{
                    page:1,
                    size:5000
                    }
            )
    
        const orders = results.data.map(order => orderReform(order.order))

        if (!results || results.data.length === 0) {
            throw new AppError("لا يوجد طلبات لعمل الكشف", 400);
        }

        const reportMetaData = {
            baghdadOrdersCount: 0,
            governoratesOrdersCount: 0,
            totalCost: 0,
            paidAmount: 0,
            deliveryCost: 0,
            clientNet: 0,
            deliveryAgentNet: 0,
            companyNet: 0
        };

        for (const order of orders) {
            // @ts-expect-error Fix later
            ordersIDs.push(order?.id)
            // @ts-expect-error Fix later
            reportMetaData.totalCost += +order.totalCost;
            // @ts-expect-error Fix later
            reportMetaData.paidAmount += +order.paidAmount;
            // @ts-expect-error Fix later
            reportMetaData.deliveryCost += +order.deliveryCost;
            // @ts-expect-error Fix later
            reportMetaData.clientNet += +order.clientNet;
            // @ts-expect-error Fix later
            reportMetaData.deliveryAgentNet += order.deliveryAgentNet;
            // @ts-expect-error Fix later
            reportMetaData.companyNet += +order.companyNet;
            // @ts-expect-error Fix later
            if (order.governorate === "BAGHDAD") {
                reportMetaData.baghdadOrdersCount++;
            } else {
                reportMetaData.governoratesOrdersCount++;
            }
        }

        const report = await reportsRepository.createReport({
            loggedInUser:loggedInUser,
            reportData:{
                type:type === "client"?"CLIENT":"COMPANY",
                secondaryType:"RETURNED",
                clientID:clientId,
                companyID:companyId,
                baghdadDeliveryCost:0,
                governoratesDeliveryCost:0,
                storeID:storeId,
                ordersIDs:ordersIDs
            },
            reportMetaData: reportMetaData
        });
        
        if (!report) {
            throw new AppError("حدث خطأ اثناء عمل الكشف", 500);
        }
        
        // if client report, make secondary status WITH_CLIENT
        if (type === "client") {
            await ordersRepository.updateOrdersSecondaryStatus({
                ordersIDs,
                secondaryStatus: "WITH_CLIENT"
            });
        }

        const reportData = await reportsRepository.getReport({
            reportID: report.id
        });

        if (!reportData) {
            throw new AppError("حدث خطأ اثناء عمل الكشف", 500);
        }

        await prisma.customerOutput.deleteMany({
            where:{
                AND:[
                    {repositoryId:userRepository.repositoryId},
                    type === "client" ? {storeId:storeId ? +storeId:null}:{},
                    type === "client" ? {clientId:clientId ? +clientId:null}:{companyId:companyId? +companyId:null}
                ]
            }
        })
        // Send notification to client if report type is client report
        if (type === "client") {
            await sendNotification({
                title: "تم انشاء كشف جديد",
                content: `تم انشاء كشف جديد برقم ${reportData?.id}`,
                userID: clientId as number
            });
        }

        // update orders timeline
        for (const order of orders) {
            if (!order) {
                continue;
            }
            await ordersRepository.updateOrderTimeline({
                orderID: order.id,
                data: {
                    type: "REPORT_CREATE",
                    date: reportData?.createdAt,
                    old: null,
                    new: {
                        id: reportData?.id,
                        type: reportData?.type as ReportType
                    },
                    by: {
                        id: loggedInUser.id,
                        name: loggedInUser.name
                    },
                    message: `تم انشاء كشف ${localizeReportType(reportData?.type)} برقم ${reportData?.id}`
                }
            });
        }

        // TODO
        const pdf = await generateReport(type === "client"?"CLIENT":"COMPANY", reportData, orders);

        const pdfBuffer = Buffer.isBuffer(pdf) ? pdf : Buffer.from(pdf);
        // Set headers for a PDF response
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=generated.pdf');
        console.log('PDF size:', pdfBuffer.length);

        res.send(pdfBuffer);
    })
    
    // deleteOrderFromSavedData=catchAsync(async(req,res)=>{
    //     const {orderIds}=req.body
        
    //     await prisma.customerOutput.deleteMany({
    //         where:{
    //             orderId:
    //         }
    //     })

    //     res.status(200).json({
    //         status: "success",
    //     });
    // })
}