import { prisma } from "../../database/db";
import { catchAsync } from "../../lib/catchAsync";
import type { loggedInUserType } from "../../types/user";
import {
    OrderChatNotificationCreateSchema,
    OrderCreateSchema,
    type OrderCreateType,
    OrderRepositoryConfirmByReceiptNumberSchema,
    OrderTimelineFiltersSchema,
    OrderUpdateSchema,
    OrdersFiltersSchema,
    OrdersReceiptsCreateSchema,
    OrdersReportPDFCreateSchema,
    // OrdersReceiptsCreateSchema,
    OrdersStatisticsFiltersSchema
} from "./orders.dto";
import { OrdersService } from "./orders.service";
import { EmployeesRepository } from "../employees/employees.repository";
import { Governorate, OrderStatus, SecondaryStatus } from "@prisma/client";
import { orderReform, orderSelect } from "./orders.responses";
import { AppError } from "../../lib/AppError";
import { OrdersRepository } from "./orders.repository";
const employeesRepository = new EmployeesRepository();

const ordersService = new OrdersService();

const ordersRepository = new OrdersRepository();

export class OrdersController {
    createOrder = catchAsync(async (req, res) => {
        const loggedInUser = res.locals.user as loggedInUserType;
        let orderOrOrders: OrderCreateType | OrderCreateType[];
        if (Array.isArray(req.body)) {
            orderOrOrders = req.body.map((order) => OrderCreateSchema.parse(order));
        } else {
            orderOrOrders = OrderCreateSchema.parse(req.body);
        }
        
        const createdOrderOrOrders = await ordersService.createOrder({
            loggedInUser: loggedInUser,
            orderOrOrdersData: orderOrOrders
        });

        res.status(200).json({
            status: "success",
            data: createdOrderOrOrders
        });
    });

    getAllOrders = catchAsync(async (req, res) => {
        const loggedInUser = res.locals.user as loggedInUserType;

        const filters = OrdersFiltersSchema.parse({
            clientID: req.query.client_id,
            deliveryAgentID: req.query.delivery_agent_id,
            companyID: req.query.company_id,
            automaticUpdateID: req.query.automatic_update_id,
            search: req.query.search,
            sort: req.query.sort,
            page: req.query.page,
            size: req.query.size,
            confirmed: req.query.confirmed,
            startDate: req.query.start_date,
            endDate: req.query.end_date,
            deliveryDate: req.query.delivery_date,
            governorate: req.query.governorate,
            statuses: req.query.statuses,
            status: req.query.status,
            deliveryType: req.query.delivery_type,
            storeID: req.query.store_id,
            repositoryID: req.query.repository_id,
            branchID: req.query.branch_id,
            productID: req.query.product_id,
            locationID: req.query.location_id,
            receiptNumber: req.query.receipt_number,
            receiptNumbers: req.query.receipt_numbers,
            recipientName: req.query.recipient_name,
            recipientPhone: req.query.recipient_phone,
            recipientAddress: req.query.recipient_address,
            clientReport: req.query.client_report,
            repositoryReport: req.query.repository_report,
            branchReport: req.query.branch_report,
            deliveryAgentReport: req.query.delivery_agent_report,
            governorateReport: req.query.governorate_report,
            companyReport: req.query.company_report,
            notes: req.query.notes,
            deleted: req.query.deleted,
            orderID: req.query.order_id,
            minified: req.query.minified,
            forMobile:req.query.for_mobile,
            forwarded: req.query.forwarded,
            forwardedByID: req.query.forwarded_by_id,
            forwardedFromID: req.query.forwarded_from_id,
            processed: req.query.processed,
            secondaryStatus:req.query.secondaryStatus,
            clientOrderReceiptId:req.query.clientOrderReceiptId,
            printed:req.query.printed
        });
        
        const { orders, ordersMetaData, page, pagesCount } = await ordersService.getAllOrders({
            loggedInUser: loggedInUser,
            filters: filters
        });
        
        res.status(200).json({
            status: "success",
            page: page,
            pagesCount: pagesCount,
            data: {
                ordersMetaData: ordersMetaData,
                orders: orders,
            }
        });
    });

    getRepositoryOrders=catchAsync(async (req,res)=>{
        const {client_id,size,page,store_id,repository_id,governorate,secondaryStatus,status,getIncoming}=req.query

        const loggedInUser=res.locals.user as loggedInUserType

        const user=await prisma.employee.findUnique({
            where:{
                id:loggedInUser.id
            },
            select:{
                branch:{
                    select:{
                        id:true,
                        repositories:{
                            select:{
                                id:true,
                                type:true,
                                name:true,
                                mainRepository:true
                            }
                        }
                    }
                },
            }
        })

        const exportRepo=user?.branch?.repositories.find(repo => repo.type === "EXPORT")
        const returnRepo=user?.branch?.repositories.find(repo => repo.type === "RETURN")

        if(!user){
            throw new AppError("حسابك غير موجود", 404);
        }

        if(!exportRepo && status !== "RETURNED"){
            throw new AppError("لا يوجد مخزن وارد للفرع الخاص بك ", 404);
        }

        if(!returnRepo && status === "RETURNED"){
            throw new AppError("لا يوجد مخزن راوجع للفرع الخاص بك ", 404);
        }

        if(loggedInUser.role ==="BRANCH_MANAGER" && !repository_id){
            throw res.status(200).json({
                status: "success",
                data: {
                    count:0,
                    pageCount:0,
                    currentPage:0,
                    orders:[]
                }
            });
        }

        const results=await prisma.order.findManyPaginated({
            where:{
                repositoryId: repository_id ? Number(repository_id) :secondaryStatus === 'IN_CAR'? undefined :status === "RETURNED" ? returnRepo?.id : exportRepo?.id,
                secondaryStatus:secondaryStatus as SecondaryStatus,
                status:status === "RETURNED" ? {in:["RETURNED","PARTIALLY_RETURNED","REPLACED"]}: status as OrderStatus,
                storeId:store_id ? Number(store_id):undefined,
                clientId:client_id ? Number(client_id):undefined,
                governorate:governorate ? governorate as Governorate:undefined,
                forwardedRepo:getIncoming ? undefined :secondaryStatus === 'IN_CAR'?exportRepo?.id:undefined
            },  
            orderBy: {
                updatedAt:"desc"
            },
            select:orderSelect
        },{
            page:page ? +page : 1,
            size:size ? +size: 10
        })

        const newData = results.data.map(order => orderReform(order))
        
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

    getOrder = catchAsync(async (req, res) => {
        const params = {
            orderID: req.params.orderID
        };

        const order = await ordersService.getOrder({
            params: params
        });

        res.status(200).json({
            status: "success",
            data: order
        });
    });

    updateOrder = catchAsync(async (req, res) => {
        const params = {
            orderID: req.params.orderID
        };
        const loggedInUser = res.locals.user as loggedInUserType;
        const orderData = OrderUpdateSchema.parse(req.body);

        if(orderData.status === "PARTIALLY_RETURNED" && req.query.for_mobile){
            orderData.paidAmount = orderData.quantity
        }
        const order = await ordersService.updateOrder({
            params: params,
            orderData: orderData,
            loggedInUser: loggedInUser
        });

        res.status(200).json({
            status: "success",
            data: order
        });
    });

    sendOrdersToReceivingAgent=catchAsync(async (req,res)=>{
        const ordersIDs = OrdersReceiptsCreateSchema.parse(req.body);
        const loggedInUser = res.locals.user as loggedInUserType;

        if(loggedInUser.role === "CLIENT" && ordersIDs.selectedAll === true){
            const count = await prisma.order.count({
                where:{
                    status:"REGISTERED",
                    printed:false,
                    client:{
                        id:loggedInUser.id
                    },
                },
            })
            if(count > 0){
                throw new AppError("تأكد من طباعه جميع الوصلات", 404);
            }
            await prisma.order.updateMany(
                {
                    data:{
                        status:"READY_TO_SEND"
                    },
                    where:{
                        status:"REGISTERED",
                        client:{
                            id:loggedInUser.id
                        }
                    }
                }
            )
            res.status(200).json({
                status: "success",
            });
        }else{
            const count = await prisma.order.count({
                where:{
                    status:"REGISTERED",
                    printed:false,
                    id:{
                        in:ordersIDs.ordersIDs
                    },
                    client:{
                        id:loggedInUser.id
                    },
                },
            })
            if(count > 0){
                throw new AppError("تأكد من طباعه جميع الوصلات", 404);
            }
            await prisma.order.updateMany(
                {
                    data:{
                        status:"READY_TO_SEND"
                    },
                    where:{
                        status:"REGISTERED",
                        client:{
                            id:loggedInUser.id
                        },
                        id:{
                            in:ordersIDs.ordersIDs
                        }
                    }
                }
            )
            res.status(200).json({
                status: "success",
            });
        }
    })
    
    addOrderToRepository=catchAsync(async(req,res)=>{
        const params = {
            orderReceiptNumber: req.params.orderID
        };
        const loggedInUser = res.locals.user as loggedInUserType;

        const orderData = OrderUpdateSchema.parse(req.body);

        const user=await prisma.employee.findUnique({
            where:{
                id:loggedInUser.id
            },
            select:{
                branch:{
                    select:{
                        id:true,
                        repositories:{
                            select:{
                                id:true,
                                type:true,
                                name:true,
                                mainRepository:true
                            }
                        }
                    }
                },
            }
        })

        const exportRepo=user?.branch?.repositories.find(repo => repo.type === "EXPORT")

        if(!user){
            throw new AppError("حسابك غير موجود", 404);
        }

        if(!exportRepo){
            throw new AppError("لا يوجد مخزن وارد لهذا الفرع!", 404);
        }

        const oldOrder = await ordersRepository.getOrderByReceiptNumber({
            orderReceiptNumber: params.orderReceiptNumber
        });

        if (!oldOrder) {
            throw new AppError("الطلب غير موجود", 404);
        }

        if(orderData.secondaryStatus === "IN_CAR"){
            if(exportRepo?.mainRepository){
                const repository = await prisma.repository.findFirst({
                    where:{
                        id:orderData.repositoryID
                    },
                    select:{
                        branchId:true
                    }
                })
                if(repository?.branchId !== oldOrder?.branch?.id){
                    throw new AppError("الطلب غير مرتبط بهذا الفرع", 400)
                }
                orderData.forwardedRepo=exportRepo?.id
            }else{
                const mainRepository=await prisma.repository.findFirst({
                    where:{
                        mainRepository:true,
                        type:"EXPORT"
                    },
                    select:{
                        id:true
                    }
                })
                orderData.repositoryID = mainRepository?.id
                orderData.forwardedRepo=exportRepo?.id
            }
        }else{
            orderData.repositoryID=exportRepo?.id
        }

        if(oldOrder?.status === "RETURNED" || oldOrder?.status === "REPLACED" || oldOrder?.status === "PARTIALLY_RETURNED"){
            throw new AppError("هذا الطلب مرتجع!", 400);
        }

        if(oldOrder?.repository && oldOrder.repository.id !== exportRepo?.id){
            throw new AppError("هذا الطلب لم يتم تحويله اليك!", 404);
        }

        if(orderData.forwardedToMainRepo){
            if(oldOrder?.repository?.id !== exportRepo?.id){
                throw new AppError("هذا الطلب غير موجود بالمخزن", 404);
            }
        }

        const order = await ordersService.updateOrder({
            params: {
                orderID:oldOrder?.id
            },
            orderData: orderData,
            loggedInUser: loggedInUser
        });

        res.status(200).json({
            status: "success",
            data: order
        });

    })

    addReturnedOrderToRepository=catchAsync(async(req,res)=>{
       const params = {
            orderReceiptNumber: req.params.orderID
        };
        const loggedInUser = res.locals.user as loggedInUserType;

        const orderData = OrderUpdateSchema.parse(req.body);


        const user=await prisma.employee.findUnique({
            where:{
                id:loggedInUser.id
            },
            select:{
                branch:{
                    select:{
                        id:true,
                        repositories:{
                            select:{
                                id:true,
                                type:true,
                                name:true,
                                mainRepository:true
                            }
                        }
                    }
                },
            }
        })

        const returnsRepo=user?.branch?.repositories.find(repo => repo.type === "RETURN")

        if(!user){
            throw new AppError("حسابك غير موجود", 404);
        }

        if(!returnsRepo){
            throw new AppError("لا يوجد مخزن راوجع لهذا الفرع!", 404);
        }

 
        const oldOrder = await ordersRepository.getOrderByReceiptNumber({
            orderReceiptNumber: params.orderReceiptNumber
        });

        if (!oldOrder) {
            throw new AppError("الطلب غير موجود", 404);
        }

        if(!orderData.repositoryID){
            orderData.repositoryID=returnsRepo?.id
        }

        if(oldOrder?.status !== "RETURNED" && oldOrder?.status !== "REPLACED" && oldOrder?.status !== "PARTIALLY_RETURNED"){
            throw new AppError("هذا الطلب غير مرتجع!", 400);
        }

        if(oldOrder.secondaryStatus === "IN_REPOSITORY" && oldOrder.repository?.id === returnsRepo?.id){
            throw new AppError("هذا الطلب موجود في مخزن!", 400);
        }

            // Remove the order from the repository report
        if (oldOrder.repositoryReport) {
            await ordersRepository.removeOrderFromRepositoryReport({
                orderID: oldOrder.id,
                repositoryReportID: oldOrder.repositoryReport.id,
                orderData: {
                    totalCost: oldOrder.totalCost,
                    paidAmount: oldOrder.paidAmount,
                    deliveryCost: oldOrder.deliveryCost,
                    clientNet: oldOrder.clientNet,
                    deliveryAgentNet: oldOrder.deliveryAgentNet,
                    companyNet: oldOrder.companyNet,
                    governorate: oldOrder.governorate
                }
            });
        }

        const order = await ordersService.updateOrder({
            params: {
                orderID:oldOrder.id
            },
            orderData: orderData,
            loggedInUser: loggedInUser
        });

        res.status(200).json({
            status: "success",
            data: order
        });
    })

    repositoryConfirmOrderByReceiptNumber = catchAsync(async (req, res) => {
        const params = {
            orderReceiptNumber:req.params.orderReceiptNumber
        };
        const loggedInUser = res.locals.user as loggedInUserType;
        const orderData = OrderRepositoryConfirmByReceiptNumberSchema.parse(req.body);

        const order = await ordersService.repositoryConfirmOrderByReceiptNumber({
            params: params,
            orderData: orderData,
            loggedInUser: loggedInUser
        });

        res.status(200).json({
            status: "success",
            data: order
        });
    });

    deleteOrder = catchAsync(async (req, res) => {
        const params = {
            orderID: req.params.orderID
        };

        await ordersService.deleteOrder({
            params: params
        });

        res.status(200).json({
            status: "success"
        });
    });

    createOrdersReceipts = catchAsync(async (req, res) => {
        const ordersIDs = OrdersReceiptsCreateSchema.parse(req.body);
        const loggedInUser = res.locals.user as loggedInUserType;

        
        const pdf = await ordersService.createOrdersReceipts({ ordersIDs,loggedInUser:loggedInUser });
        const pdfBuffer = Buffer.isBuffer(pdf) ? pdf : Buffer.from(pdf);
        // Set headers for a PDF response
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=generated.pdf');

        res.send(pdfBuffer);
    });

    getOrdersReportPDF = catchAsync(async (req, res) => {
        const ordersData = OrdersReportPDFCreateSchema.parse(req.body);

        const filters = OrdersFiltersSchema.parse({
            confirmed:req.query.confirmed,
            clientID: req.query.client_id,
            deliveryAgentID: req.query.delivery_agent_id,
            companyID: req.query.company_id,
            sort: "receiptNumber:asc",
            startDate: req.query.start_date,
            endDate: req.query.end_date,
            governorate: req.query.governorate,
            statuses: req.query.statuses,
            status: req.query.status,
            deliveryType: req.query.delivery_type,
            storeID: req.query.store_id,
            repositoryID: req.query.repository_id,
            branchID: req.query.branch_id,
            clientReport: req.query.client_report,
            repositoryReport: req.query.repository_report,
            branchReport: req.query.branch_report,
            deliveryAgentReport: req.query.delivery_agent_report,
            governorateReport: req.query.governorate_report,
            companyReport: req.query.company_report,
            minified: false
        });

        const pdf = await ordersService.getOrdersReportPDF({
            ordersData: ordersData,
            ordersFilters: filters
        });

        const pdfBuffer = Buffer.isBuffer(pdf) ? pdf : Buffer.from(pdf);
        // Set headers for a PDF response
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=generated.pdf');

        res.send(pdfBuffer);
    });

    getOrdersStatistics = catchAsync(async (req, res) => {
        const loggedInUser = res.locals.user as loggedInUserType;

        const filters = OrdersStatisticsFiltersSchema.parse({
            clientID: req.query.client_id,
            deliveryAgentID: req.query.delivery_agent_id,
            companyID: req.query.company_id,
            startDate: req.query.start_date,
            endDate: req.query.end_date,
            governorate: req.query.governorate,
            statuses: req.query.statuses,
            deliveryType: req.query.delivery_type,
            storeID: req.query.store_id,
            locationID: req.query.location_id,
            clientReport: req.query.client_report,
            repositoryReport: req.query.repository_report,
            branchReport: req.query.branch_report,
            deliveryAgentReport: req.query.delivery_agent_report,
            governorateReport: req.query.governorate_report,
            companyReport: req.query.company_report
        });

        const statistics = await ordersService.getOrdersStatistics({
            loggedInUser: loggedInUser,
            filters: filters
        });
        
        res.status(200).json({
            status: "success",
            data: statistics
        });
    });

    getCLientOrdersStatistics=catchAsync(async (req,res)=>{
        const loggedInUser = res.locals.user as loggedInUserType;
        const status=req.query.status;
        let inquiryClientsIDs: number[] | undefined = undefined;
        const inquiryEmployeeStuff = await employeesRepository.getInquiryEmployeeStuff({
            employeeID: loggedInUser.id
        });

        inquiryClientsIDs = inquiryEmployeeStuff.inquiryClients && inquiryEmployeeStuff.inquiryClients.length > 0
                            ? inquiryEmployeeStuff.inquiryClients : undefined

        const clients = await prisma.client.findMany({
            where: { id: { in: inquiryClientsIDs } },
            select: { 
                id: true, 
                user:{
                    select:{
                        name:true
                    }
                }
            }
        });

        const ordersStatisticsByStatus = await prisma.order.groupBy({
            by: ["clientId"],
            _count: {
                id: true
            },
            where:{
                status:status as OrderStatus,
                client:{
                    id:{
                        in:inquiryClientsIDs
                    }
                },
                OR:loggedInUser.role === "RECEIVING_AGENT"?
                    [
                        { clientReport: { is: null } },
                        { clientReport: { report: { deleted: true } } },
                        { clientReport: { report: { confirmed: false } } },
                    ]:undefined
            }
        })
        
        res.status(200).json({
            status: "success",
            data: ordersStatisticsByStatus.map(status => {
                return({
                    count:status._count.id,
                    clientId:status.clientId,
                    clientName:clients.find(client => +client.id === +status.clientId)?.user.name
                })
            })
        });
    })

    getOrderTimeline = catchAsync(async (req, res) => {
        const params = {
            orderID: req.params.orderID
        };

        const filters = OrderTimelineFiltersSchema.parse({
            type: req.query.type,
            types: req.query.types
        });

        const orderTimeline = await ordersService.getOrderTimeline({
            params: params,
            filters: filters
        });

        res.status(200).json({
            status: "success",
            data: orderTimeline
        });
    });

    getOrderChatMembers = catchAsync(async (req, res) => {
        const params = {
            orderID: req.params.orderID
        };

        const orderChatMembers = await ordersService.getOrderChatMembers({
            params: params
        });

        res.status(200).json({
            status: "success",
            data: orderChatMembers
        });
    });

    getOrderInquiryEmployees = catchAsync(async (req, res) => {
        const params = {
            orderID: req.params.orderID
        };

        const orderInquiryEmployees = await ordersService.getOrderInquiryEmployees({
            params: params
        });

        res.status(200).json({
            status: "success",
            data: orderInquiryEmployees
        });
    });

    deactivateOrder = catchAsync(async (req, res) => {
        const params = {
            orderID: req.params.orderID
        };
        const loggedInUser = res.locals.user as loggedInUserType;

        await ordersService.deactivateOrder({
            params: params,
            loggedInUser: loggedInUser
        });

        res.status(200).json({
            status: "success"
        });
    });

    reactivateOrder = catchAsync(async (req, res) => {
        const params = {
            orderID: req.params.orderID
        };

        await ordersService.reactivateOrder({
            params: params
        });

        res.status(200).json({
            status: "success"
        });
    });

    sendNotificationToOrderChatMembers = catchAsync(async (req, res) => {
        const params = {
            orderID: req.params.orderID
        };
        const loggedInUser = res.locals.user as loggedInUserType;
        const notificationData = OrderChatNotificationCreateSchema.parse(req.body);

        await ordersService.sendNotificationToOrderChatMembers({
            params: params,
            loggedInUser: loggedInUser,
            notificationData: notificationData
        });

        res.status(200).json({
            status: "success"
        });
    });
}
