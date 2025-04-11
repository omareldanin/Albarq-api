import { Governorate, OrderStatus } from "@prisma/client";
import { prisma } from "../../database/db";
import { AppError } from "../../lib/AppError";
import { catchAsync } from "../../lib/catchAsync";
import { loggedInUserType } from "../../types/user";
import { EmployeesRepository } from "../employees/employees.repository";
// import { orderSelect } from "../orders/orders.responses";
const ticketSelect={
    id:true,
    clientId:true,
    companyId:true,
    closed:true,
    forwarded:true,
    Department:{
        select:{
            id:true,
            name:true
        }
    },
    Order:{
        select:{
            status:true,
            receiptNumber:true,
            client:{
                select:{
                    user:{
                        select:{
                            name:true,
                        }
                    }
                }
            }
        }
    },
    createdBy:{
        select:{
            id:true,
            name:true
        }
    },
    ticketResponse:{
        select:{
            id:true,
            content:true,
            createdBy:{
                select:{
                    id:true,
                    name:true
                }
            }
        }
    },
    Client:{
        select:{
            user:{
                select:{
                    id:true,
                    name:true,
                }
            }
        }
    }
}
const employeesRepository=new EmployeesRepository()
export class TicketController{
    createTicket=catchAsync(async(req,res)=>{
        const {content,orderId}=req.body
        const loggedInUser=res.locals.user as loggedInUserType
        const order=await prisma.order.findUnique({
            where:{
                id:orderId
            },
            select:{
                id:true,
                clientId:true,
                status:true
            }
        })
        if(!order){
            throw new AppError("لا يوجد طلب",404)
        }
        const ticket=await prisma.ticket.create({
            data:{
                content:content,
                orderId:orderId,
                clientId:order.clientId,
                createdById:loggedInUser.id,
                companyId:loggedInUser.companyID,
            },
            select:{
                id:true,
            }
        })
        res.status(200).json({
            status: "success",
            data: ticket
        });
    })

    getAllTicket=catchAsync(async(req,res)=>{
        const loggedInUser=res.locals.user as loggedInUserType
        const {forwarded,closed,status,page,size}=req.query
        // Inquiry Employee Filters
        let inquiryGovernorates: Governorate[] | undefined = undefined;
        let inquiryLocationsIDs: number[] | undefined = undefined;
        let inquiryBranchesIDs: number[] | undefined = undefined;
        let inquiryStoresIDs: number[] | undefined = undefined;

        if (loggedInUser.role === "INQUIRY_EMPLOYEE") {
            const inquiryEmployeeStuff = await employeesRepository.getInquiryEmployeeStuff({
                employeeID: loggedInUser.id
            });
            if (inquiryEmployeeStuff) {
                // if all filters are empty, that means he shouldnt see any orders
                inquiryGovernorates =
                    inquiryEmployeeStuff.inquiryGovernorates &&
                    inquiryEmployeeStuff.inquiryGovernorates.length > 0
                        ? inquiryEmployeeStuff.inquiryGovernorates
                        : undefined;
                inquiryLocationsIDs =
                    inquiryEmployeeStuff.inquiryLocations && inquiryEmployeeStuff.inquiryLocations.length > 0
                        ? inquiryEmployeeStuff.inquiryLocations
                        : undefined;
                inquiryBranchesIDs =
                    inquiryEmployeeStuff.inquiryBranches && inquiryEmployeeStuff.inquiryBranches.length > 0
                        ? inquiryEmployeeStuff.inquiryBranches
                        : undefined;
                inquiryStoresIDs =
                    inquiryEmployeeStuff.inquiryStores && inquiryEmployeeStuff.inquiryStores.length > 0
                        ? inquiryEmployeeStuff.inquiryStores
                        : undefined;
            }
        }

        const employee=await prisma.employee.findUnique({
            where:{
                id:loggedInUser.id
            },
            select:{
                departmentId:true,
                inquiryBranches:true,
                inquiryLocations:true,
                inquiryStatuses:true,
                inquiryGovernorates:true,
                inquiryStores:true,
            }
        })
        
        let forward:boolean | undefined
        let close:boolean | undefined

        if(forwarded && forwarded === "true"){
            if(!employee?.departmentId){
                throw new AppError("لا يوجد قسم خاص بك",404)
            }
            forward=true
        }else if(forwarded && forwarded === "false"){
            forward=false
        }else forward = undefined

        if(closed && closed === "true"){
            close=true
        }else if(closed && closed === "false"){
            close=false
        }else close = undefined

        const tickets=await prisma.ticket.findManyPaginated({
                where:{
                    AND:[
                        {companyId:loggedInUser.companyID},
                        {clientId:loggedInUser.role === "CLIENT" ? loggedInUser.id :undefined},
                        {forwarded:forward},
                        {departmentId:forward ? employee?.departmentId :undefined},
                        {closed:close},
                        {
                            Order:{
                                status:status ? status as OrderStatus :undefined,
                                deliveryAgentId:loggedInUser.role === "DELIVERY_AGENT"? loggedInUser.id:undefined,
                                governorate:inquiryGovernorates
                                ?   {
                                        in: inquiryGovernorates
                                    }
                                : undefined,
                                branch: inquiryBranchesIDs
                                ? {
                                        id: {
                                            in: inquiryBranchesIDs
                                        }
                                    }
                                : undefined,
                                store: inquiryStoresIDs
                                ? {
                                        id: {
                                            in: inquiryStoresIDs
                                        }
                                    }
                                : undefined,
                                location: inquiryLocationsIDs
                                ? {
                                        id: {
                                            in: inquiryLocationsIDs
                                        }
                                    }
                                : undefined
                            }
                        },
                    ]
                },
                select:ticketSelect,
                orderBy:{
                    id:"desc",
                }
            },
            {
                page:page ? +page : 1,
                size:size ? +size : 10,
            }
        )
        res.status(200).json({
            status: "success",
            page: page,
            pagesCount: tickets.pagesCount,
            data: tickets
        }); 
    })

    closeTicket=catchAsync(async(req,res)=>{
        const {id}=req.params;
        const loggedInUser=res.locals.user as loggedInUserType
        const {content}=req.body
        const ticket= await prisma.ticket.update({
            where:{
                id:+id
            },
            data:{
                closed:true
            }
        })
        await prisma.ticketResponse.create({
            data:{
                ticketId:+id,
                content:content,
                createdById:loggedInUser.id
            }
        })
        res.status(200).json({
            status: "success",
            data: ticket
        })
    })

    takeTicket=catchAsync(async(req,res)=>{
        const {id}=req.params;
        const loggedInUser=res.locals.user as loggedInUserType

        const ticket =await prisma.ticket.findUnique({
            where:{
                id:+id
            },
            select:{
                id:true,
                employeeId:true
            }
        })

        if(ticket?.employeeId){
            throw new AppError("لا يمكنك استلام هذه التذكره",404)
        }

        const updatedticket= await prisma.ticket.update({
            where:{
                id:+id
            },
            data:{
                employeeId:loggedInUser.id
            }
        })

        res.status(200).json({
            status: "success",
            data: updatedticket
        })
    })

    forwardTicket=catchAsync(async(req,res)=>{
        const {id}=req.params;
        const loggedInUser=res.locals.user as loggedInUserType

        const ticket =await prisma.ticket.findUnique({
            where:{
                id:+id
            },
            select:{
                id:true,
                employeeId:true
            }
        })

        if(ticket?.employeeId !== loggedInUser.id){
            throw new AppError("لا يمكنك تحويل هذه التذكره",404)
        }

        const updatedTicket= await prisma.ticket.update({
            where:{
                id:+id
            },
            data:{
                departmentId:req.body.departmentId,
                employeeId:null,
                forwarded:true
            }
        })

        res.status(200).json({
            status: "success",
            data: updatedTicket
        })
    })

    getOne=catchAsync(async(req,res)=>{
        const {id}=req.params;
        const ticket=await prisma.ticket.findUnique({
            where:{
                id:+id
            },
            select:ticketSelect
        })
        res.status(200).json({
            status: "success",
            data: ticket
        })
    })

    createResponse=catchAsync(async(req,res)=>{
        const loggedInUser=res.locals.user as loggedInUserType
        const {ticketId,content}=req.body

        const ticket =await prisma.ticket.findUnique({
            where:{
                id:+ticketId
            },
            select:{
                id:true,
                employeeId:true
            }
        })

        if(ticket?.employeeId !== loggedInUser.id){
            throw new AppError("لا يمكنك الرد علي هذه التذكره",404)
        }

        const ticketResponse=await prisma.ticketResponse.create({
            data:{
                ticketId:+ticketId,
                content:content,
                createdById:loggedInUser.id
            }
        })

        res.status(201).json({
            status: "success",
            data: ticketResponse
        })
    })
}