import { OrderStatus } from "@prisma/client";
import { prisma } from "../../database/db";
import { AppError } from "../../lib/AppError";
import { catchAsync } from "../../lib/catchAsync";
import { loggedInUserType } from "../../types/user";
import { orderSelect } from "../orders/orders.responses";

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
        
        const employee=await prisma.employee.findUnique({
            where:{
                id:loggedInUser.id
            },
            select:{
                departmentId:true
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
                        { companyId:loggedInUser.companyID},
                        {clientId:loggedInUser.role === "CLIENT" ? loggedInUser.id :undefined},
                        {forwarded:forward},
                        {departmentId:forward ? employee?.departmentId :undefined},
                        {closed:close},
                        {
                            Order:{
                                status:status ? status as OrderStatus :undefined,
                                deliveryAgentId:loggedInUser.role === "DELIVERY_AGENT"? loggedInUser.id:undefined
                            }
                        },
                    ]
                },
                select:{
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
                },
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

    forwardTicket=catchAsync(async(req,res)=>{
        const {id}=req.params;
        const ticket= await prisma.ticket.update({
            where:{
                id:+id
            },
            data:{
                departmentId:req.body.departmentId,
                forwarded:true
            }
        })

        res.status(200).json({
            status: "success",
            data: ticket
        })
    })

    getOne=catchAsync(async(req,res)=>{
        const {id}=req.params;
        const ticket=await prisma.ticket.findUnique({
            where:{
                id:+id
            },
            select:{
                id:true,
                clientId:true,
                companyId:true,
                closed:true,
                createdBy:{
                    select:{
                        id:true,
                        name:true
                    }
                },
                Order:{
                    select:orderSelect
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
        })
        res.status(200).json({
            status: "success",
            data: ticket
        })
    })
    createResponse=catchAsync(async(req,res)=>{
        const loggedInUser=res.locals.user as loggedInUserType
        const {ticketId,content}=req.body
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