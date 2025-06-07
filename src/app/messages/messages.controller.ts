import { Governorate, OrderStatus } from "@prisma/client";
import { prisma } from "../../database/db";
import { catchAsync } from "../../lib/catchAsync";
import { loggedInUserType } from "../../types/user";
import { sendNotification } from "../notifications/helpers/sendNotification";
import { EmployeesRepository } from "../employees/employees.repository";
import _ from "lodash";
import { io } from "../../server";
import { AppError } from "../../lib/AppError";

const employeesRepository = new EmployeesRepository();

export class MessagesController {
  getOrderChatMembers = async (orderId: string) => {
    let chatMembers: number[] = [];

    const order = await prisma.order.findUnique({
      where: {
        id: orderId,
      },
      select: {
        id: true,
        status: true,
        storeId: true,
        locationId: true,
        governorate: true,
        clientId: true,
        deliveryAgentId: true,
        branchId: true,
        companyId: true,
      },
    });
    const companyManagers = await prisma.employee.findMany({
      where: {
        role: "COMPANY_MANAGER",
        companyId: order?.companyId,
      },
      select: {
        id: true,
      },
    });
    const branchManagers = await prisma.employee.findMany({
      where: {
        role: "BRANCH_MANAGER",
        branchId: order?.branchId,
      },
      select: {
        id: true,
      },
    });

    const inquiryEmployees = await prisma.employee.findMany({
      where: {
        AND: [
          { role: "INQUIRY_EMPLOYEE" },
          {
            inquiryStatuses: order?.status ? { has: order.status } : undefined,
          },
          {
            inquiryBranches: order?.branchId
              ? {
                  some: {
                    branchId: order.branchId,
                  },
                }
              : undefined,
          },
          {
            inquiryCompanies: order?.companyId
              ? {
                  some: {
                    companyId: order.companyId,
                  },
                }
              : undefined,
          },
          {
            inquiryStores: order?.storeId
              ? {
                  some: {
                    storeId: order.storeId,
                  },
                }
              : undefined,
          },
          {
            inquiryLocations: order?.locationId
              ? {
                  some: {
                    locationId: order.locationId,
                  },
                }
              : undefined,
          },
          // TODO
          {
            inquiryGovernorates: order?.governorate
              ? { has: order.governorate }
              : undefined,
          },
        ],
      },
      select: {
        id: true,
      },
    });

    const clientAssistant = await prisma.employee.findMany({
      where: {
        AND: [
          { role: "CLIENT_ASSISTANT" },
          { clientId: order?.clientId },
          {
            managedStores: {
              some: {
                id: order?.storeId,
              },
            },
          },
          {
            orderStatus: { has: order?.status },
          },
          {
            permissions: { has: "MESSAGES" },
          },
        ],
      },
      select: {
        id: true,
      },
    });
    inquiryEmployees.forEach((e) => {
      chatMembers.push(e.id);
    });
    companyManagers.forEach((e) => {
      chatMembers.push(e.id);
    });
    branchManagers.forEach((e) => {
      chatMembers.push(e.id);
    });
    clientAssistant.forEach((e) => {
      chatMembers.push(e.id);
    });
    order?.clientId && chatMembers.push(order?.clientId);
    order?.deliveryAgentId && chatMembers.push(order?.deliveryAgentId);

    return chatMembers;
  };

  getUserChats = async (
    user: loggedInUserType,
    size: number,
    page: number,
    status: string | undefined
  ) => {
    const employee = await prisma.employee.findUnique({
      where: {
        id: +user.id,
      },
      select: {
        id: true,
        role: true,
        branchId: true,
        managedStores: true,
        inquiryBranches: true,
        inquiryGovernorates: true,
        inquiryStatuses: true,
        inquiryLocations: true,
        inquiryStores: true,
        permissions: true,
        orderStatus: true,
      },
    });

    let inquiryStatuses: OrderStatus[] | undefined = undefined;
    let inquiryGovernorates: Governorate[] | undefined = undefined;
    let inquiryLocationsIDs: number[] | undefined = undefined;
    let inquiryBranchesIDs: number[] | undefined = undefined;
    let inquiryStoresIDs: number[] | undefined = undefined;

    if (user.role === "INQUIRY_EMPLOYEE") {
      const inquiryEmployeeStuff =
        await employeesRepository.getInquiryEmployeeStuff({
          employeeID: +user.id,
        });
      if (inquiryEmployeeStuff) {
        inquiryStatuses =
          inquiryEmployeeStuff.inquiryStatuses &&
          inquiryEmployeeStuff.inquiryStatuses.length > 0
            ? inquiryEmployeeStuff.inquiryStatuses
            : undefined;
        inquiryGovernorates =
          inquiryEmployeeStuff.inquiryGovernorates &&
          inquiryEmployeeStuff.inquiryGovernorates.length > 0
            ? inquiryEmployeeStuff.inquiryGovernorates
            : undefined;
        inquiryLocationsIDs =
          inquiryEmployeeStuff.inquiryLocations &&
          inquiryEmployeeStuff.inquiryLocations.length > 0
            ? inquiryEmployeeStuff.inquiryLocations
            : undefined;
        inquiryBranchesIDs =
          inquiryEmployeeStuff.inquiryBranches &&
          inquiryEmployeeStuff.inquiryBranches.length > 0
            ? inquiryEmployeeStuff.inquiryBranches
            : undefined;
        inquiryStoresIDs =
          inquiryEmployeeStuff.inquiryStores &&
          inquiryEmployeeStuff.inquiryStores.length > 0
            ? inquiryEmployeeStuff.inquiryStores
            : undefined;
      }
    }

    if (
      user.role === "CLIENT_ASSISTANT" &&
      !employee?.permissions.includes("MESSAGES")
    ) {
      return {
        totalUnSeened: 0,
        pageCounts: 0,
        count: 0,
        page: 1,
        chats: [],
      };
    }
    if (user.role === "CLIENT_ASSISTANT") {
      inquiryStoresIDs = employee?.managedStores.map((s) => s.id);
    }
    const chats = await prisma.chat.findManyPaginated(
      {
        where: {
          messages: {
            some: {}, // Only include chats that have at least one message
          },
          Order:
            user.role === "INQUIRY_EMPLOYEE"
              ? {
                  AND: [
                    {
                      status:
                        status && status !== "null"
                          ? (status as OrderStatus)
                          : inquiryStatuses
                          ? {
                              in: inquiryStatuses,
                            }
                          : undefined,
                    },
                    {
                      governorate: inquiryGovernorates
                        ? {
                            in: inquiryGovernorates,
                          }
                        : undefined,
                    },
                    {
                      branch: inquiryBranchesIDs
                        ? {
                            id: {
                              in: inquiryBranchesIDs,
                            },
                          }
                        : undefined,
                    },
                    {
                      store: inquiryStoresIDs
                        ? {
                            id: {
                              in: inquiryStoresIDs,
                            },
                          }
                        : undefined,
                    },
                    {
                      company: {
                        id: user.companyID,
                      },
                    },
                    {
                      location: inquiryLocationsIDs
                        ? {
                            id: {
                              in: inquiryLocationsIDs,
                            },
                          }
                        : undefined,
                    },
                  ],
                }
              : {
                  status:
                    status && status !== "null"
                      ? (status as OrderStatus)
                      : user.role === "CLIENT_ASSISTANT"
                      ? { in: employee?.orderStatus }
                      : undefined,
                  clientId: user.role === "CLIENT" ? user.id : undefined,
                  companyId: user?.companyID || undefined,
                  branchId:
                    user.role === "BRANCH_MANAGER"
                      ? employee?.branchId
                      : undefined,
                  deliveryAgentId:
                    user.role === "DELIVERY_AGENT" ? user.id : undefined,
                  storeId:
                    user.role === "CLIENT_ASSISTANT"
                      ? { in: inquiryStoresIDs }
                      : undefined,
                },
        },
        orderBy: {
          updatedAt: "desc",
        },
        select: {
          id: true,
          orderId: true,
          Order: {
            select: {
              receiptNumber: true,
            },
          },
          messages: {
            orderBy: {
              createdAt: "desc", // Order messages descending
            },
            take: 1,
            select: {
              image: true,
              content: true,
              createdAt: true,
              createdBy: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      },
      {
        page,
        size,
      }
    );

    const unSeenChats = await prisma.message.groupBy({
      by: ["chatId"],
      _count: {
        id: true,
      },
      where: {
        seenByClient:
          user.role === "CLIENT" || user.role === "CLIENT_ASSISTANT"
            ? false
            : undefined,
        seenByDelivery: user.role === "DELIVERY_AGENT" ? false : undefined,
        seenByBranchManager: user.role === "BRANCH_MANAGER" ? false : undefined,
        seenByCompanyManager:
          user.role === "COMPANY_MANAGER" ? false : undefined,
        seenByCallCenter: user.role === "INQUIRY_EMPLOYEE" ? false : undefined,
      },
    });

    let totalUnSeened = 0;

    const allStatistics = chats.data.map((e) => {
      totalUnSeened +=
        unSeenChats.find((c) => c.chatId === e.id)?._count.id || 0;
      return {
        id: e.id,
        unseenMessages:
          unSeenChats.find((c) => c.chatId === e.id)?._count.id || 0,
        orderId: e.orderId,
        lastMessage: e.messages[0],
      };
    });
    return {
      totalUnSeened,
      pageCounts: chats.pagesCount,
      count: chats.dataCount,
      page: chats.currentPage,
      chats: allStatistics,
    };
  };

  getChatMessages = async (orderId: string, userId: number) => {
    const employee = await prisma.employee.findUnique({
      where: {
        id: +userId,
      },
      select: {
        role: true,
        permissions: true,
      },
    });

    if (employee?.role === "CLIENT_ASSISTANT") {
      if (!employee?.permissions.includes("MESSAGES")) {
        return [];
      }
    }

    await prisma.message.updateMany({
      where: {
        Chat: {
          orderId: orderId,
        },
      },
      data: {
        seenByClient: employee ? undefined : true,
        seenByDelivery: employee?.role === "DELIVERY_AGENT" ? true : undefined,
        seenByBranchManager:
          employee?.role === "BRANCH_MANAGER" ? true : undefined,
        seenByCompanyManager:
          employee?.role === "COMPANY_MANAGER" ? true : undefined,
        seenByCallCenter:
          employee?.role === "INQUIRY_EMPLOYEE" ? true : undefined,
      },
    });

    let chatMembers = await this.getOrderChatMembers(orderId);

    // const initialMessages=await this.getChatMessages(orderId,userId)

    chatMembers.forEach((member) => {
      io.to(`${member}`).emit("newMessage", "");
    });
    // io.to(`chat_${orderId}`).emit("chatMessages", initialMessages);

    const messages = await prisma.message.findMany({
      where: {
        Chat: {
          orderId: orderId,
        },
      },
      select: {
        id: true,
        content: true,
        image: true,
        createdAt: true,
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });
    return {
      data: messages,
    };
  };

  sendMessage = catchAsync(async (req, res) => {
    const { content, orderId } = req.body;
    const loggedInUser = res.locals.user as loggedInUserType;

    let image: string | undefined;

    const order = await prisma.order.findUnique({
      where: {
        id: orderId,
      },
      select: {
        receiptNumber: true,
      },
    });

    if (loggedInUser.role === "CLIENT_ASSISTANT") {
      const clientAssistant = await prisma.employee.findUnique({
        where: {
          id: loggedInUser.id,
        },
        select: {
          permissions: true,
        },
      });
      if (!clientAssistant?.permissions.includes("MESSAGES")) {
        throw new AppError("ليس لديك صلاحيه", 400);
      }
    }
    if (req.file) {
      const file = req.file as Express.MulterS3.File;
      image = file.location;
    }

    let chat = await prisma.chat.findFirst({
      where: {
        orderId: orderId,
      },
      select: {
        id: true,
        orderId: true,
        numberOfMessages: true,
      },
    });

    if (!chat) {
      chat = await prisma.chat.create({
        data: {
          orderId: orderId,
          numberOfMessages: 0,
        },
        select: {
          id: true,
          orderId: true,
          numberOfMessages: true,
        },
      });
    }

    await prisma.chat.update({
      where: {
        id: chat.id,
      },
      data: {
        numberOfMessages: chat.numberOfMessages + 1,
      },
    });

    const message = await prisma.message.create({
      data: {
        content: content ? content : "",
        image: image,
        Chat: {
          connect: {
            id: chat.id,
          },
        },
        createdBy: {
          connect: {
            id: loggedInUser.id,
          },
        },
        seenByClient: loggedInUser.role === "CLIENT",
        seenByDelivery: loggedInUser.role === "DELIVERY_AGENT",
        seenByBranchManager: loggedInUser.role === "BRANCH_MANAGER",
        seenByCompanyManager: loggedInUser.role === "COMPANY_MANAGER",
        seenByCallCenter: loggedInUser.role === "INQUIRY_EMPLOYEE",
      },
      select: {
        id: true,
        content: true,
        seenByBranchManager: true,
        seenByCompanyManager: true,
        seenByClient: true,
        seenByDelivery: true,
        seenByCallCenter: true,
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    let chatMembers = await this.getOrderChatMembers(orderId);
    chatMembers = chatMembers.filter((e) => +e !== +loggedInUser.id);

    const initialMessages = await this.getChatMessages(
      orderId,
      loggedInUser.id
    );

    io.to(`chat_${chat.orderId}`).emit("chatMessages", initialMessages);

    chatMembers.forEach((member) => {
      io.to(`${member}`).emit("newMessage", message);
    });
    // const chats=await this.getUserChats(loggedInUser.id)

    chatMembers.forEach(async (e) => {
      await sendNotification({
        title: `رساله جديده "${content}"`,
        content: `هناك رساله جديده للطلب رقم ${orderId}`,
        userID: e,
        orderId: order?.receiptNumber,
      });
    });

    res.status(201).json({ message: "success" });
  });

  getUserChatStatics = catchAsync(async (req, res) => {
    const loggedInUser = res.locals.user as loggedInUserType;
    const { size, page, status } = req.query;
    const chats = await this.getUserChats(
      loggedInUser,
      size ? +size : 20,
      page ? +page : 1,
      typeof status === "string" ? status : undefined
    );

    res.status(201).json({ ...chats });
  });
}
