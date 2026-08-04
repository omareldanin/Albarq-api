import {Governorate, OrderStatus, Prisma} from "@prisma/client";
import {prisma} from "../../database/db";
import {catchAsync} from "../../lib/catchAsync";
import {loggedInUserType} from "../../types/user";
import {sendNotification} from "../notifications/helpers/sendNotification";
import {EmployeesRepository} from "../employees/employees.repository";
import _ from "lodash";
import {io} from "../../server";
import {AppError} from "../../lib/AppError";

const employeesRepository = new EmployeesRepository();
type InquiryScope = {
  orderType?: string;
  inquiryStatuses?: OrderStatus[];
  inquiryGovernorates?: Governorate[];
  inquiryLocationsIDs?: number[];
  inquiryBranchesIDs?: number[];
  inquiryStoresIDs?: number[];
};
export class MessagesController {
  private resolveInquiryScope = async (
    user: loggedInUserType,
  ): Promise<InquiryScope> => {
    if (user.role !== "INQUIRY_EMPLOYEE") return {};

    const stuff = await employeesRepository.getInquiryEmployeeStuff({
      employeeID: +user.id,
    });
    if (!stuff) return {};

    return {
      orderType: stuff.orderType || undefined,
      inquiryStatuses: stuff.inquiryStatuses?.length
        ? stuff.inquiryStatuses
        : undefined,
      inquiryGovernorates: stuff.inquiryGovernorates?.length
        ? stuff.inquiryGovernorates
        : undefined,
      inquiryLocationsIDs: stuff.inquiryLocations?.length
        ? stuff.inquiryLocations
        : undefined,
      inquiryBranchesIDs: stuff.inquiryBranches?.length
        ? stuff.inquiryBranches
        : undefined,
      inquiryStoresIDs: stuff.inquiryStores?.length
        ? stuff.inquiryStores
        : undefined,
    };
  };

  private buildInquiryBranchOR = (
    user: loggedInUserType,
    scope: InquiryScope,
  ): Prisma.OrderWhereInput[] => {
    const {orderType, inquiryBranchesIDs} = scope;
    const hasBranches = !!inquiryBranchesIDs?.length;

    if (!orderType && user.mainRepository && hasBranches) {
      return [
        {branchId: {in: inquiryBranchesIDs}},
        {client: {branchId: {in: inquiryBranchesIDs}}},
      ];
    }
    if (orderType === "receiving" && user.mainRepository && hasBranches) {
      return [{branchId: {in: inquiryBranchesIDs}}];
    }
    if (orderType === "forwarded" && user.mainRepository && hasBranches) {
      return [{client: {branchId: {in: inquiryBranchesIDs}}}];
    }
    return [{branchId: user.branchId}, {client: {branchId: user.branchId}}];
  };

  private buildOrderWhere = (params: {
    user: loggedInUserType;
    employee: {branchId?: number | null; orderStatus?: OrderStatus[]} | null;
    scope: InquiryScope;
    status: string | undefined;
    inquiryStoresIDs?: number[];
    includeStatusAndDeleted: boolean;
  }): Prisma.OrderWhereInput => {
    const {
      user,
      employee,
      scope,
      status,
      inquiryStoresIDs,
      includeStatusAndDeleted,
    } = params;

    const isClientAssistant =
      user.role === "CLIENT_ASSISTANT" ||
      user.role === "EMPLOYEE_CLIENT_ASSISTANT";

    if (user.role === "INQUIRY_EMPLOYEE") {
      return {
        AND: [
          {
            status:
              status && status !== "null"
                ? (status as OrderStatus)
                : scope.inquiryStatuses
                  ? {in: scope.inquiryStatuses}
                  : undefined,
          },
          {
            governorate: scope.inquiryGovernorates
              ? {in: scope.inquiryGovernorates}
              : undefined,
          },
          {OR: this.buildInquiryBranchOR(user, scope)},
          {storeId: inquiryStoresIDs ? {in: inquiryStoresIDs} : undefined},
          {
            OR: [
              {companyId: user.companyID},
              {forwardedFromId: user.companyID},
            ],
          },
          {
            locationId: scope.inquiryLocationsIDs
              ? {in: scope.inquiryLocationsIDs}
              : undefined,
          },
          ...(includeStatusAndDeleted ? [{deleted: false}] : []),
        ],
      };
    }

    // non-inquiry roles
    return {
      ...(includeStatusAndDeleted && {deleted: false}),
      ...(includeStatusAndDeleted && {
        status:
          status && status !== "null"
            ? (status as OrderStatus)
            : isClientAssistant
              ? {in: employee?.orderStatus}
              : undefined,
      }),
      clientId: user.role === "CLIENT" ? user.id : undefined,
      companyId: user?.companyID || undefined,
      branchId:
        user.role !== "COMPANY_MANAGER" &&
        !isClientAssistant &&
        !user.mainRepository &&
        user.role !== "DELIVERY_AGENT" &&
        user.role !== "BRANCH_MANAGER"
          ? employee?.branchId
          : undefined,
      deliveryAgentId: user.role === "DELIVERY_AGENT" ? user.id : undefined,
      storeId: isClientAssistant ? {in: inquiryStoresIDs} : undefined,
      OR:
        user.role === "BRANCH_MANAGER"
          ? [
              {branchId: employee?.branchId!!},
              {client: {branchId: employee?.branchId}},
            ]
          : undefined,
    };
  };

  private buildInquiryBranchORSql = (
    user: loggedInUserType,
    scope: InquiryScope,
  ): Prisma.Sql => {
    const {orderType, inquiryBranchesIDs} = scope;
    const hasBranches = !!inquiryBranchesIDs?.length;

    if (!orderType && user.mainRepository && hasBranches) {
      return Prisma.sql`(
      o."branchId" = ANY(${inquiryBranchesIDs}::int[])
      OR EXISTS (
        SELECT 1 FROM "Client" cl
        WHERE cl."id" = o."clientId"
          AND cl."branchId" = ANY(${inquiryBranchesIDs}::int[])
      )
    )`;
    }

    if (orderType === "receiving" && user.mainRepository && hasBranches) {
      return Prisma.sql`o."branchId" = ANY(${inquiryBranchesIDs}::int[])`;
    }

    if (orderType === "forwarded" && user.mainRepository && hasBranches) {
      return Prisma.sql`EXISTS (
      SELECT 1 FROM "Client" cl
      WHERE cl."id" = o."clientId"
        AND cl."branchId" = ANY(${inquiryBranchesIDs}::int[])
    )`;
    }

    return Prisma.sql`(
    o."branchId" = ${user.branchId}
    OR EXISTS (
      SELECT 1 FROM "Client" cl
      WHERE cl."id" = o."clientId" AND cl."branchId" = ${user.branchId}
    )
  )`;
  };

  private buildOrderScopeSql = (params: {
    user: loggedInUserType;
    employee: {branchId?: number | null; orderStatus?: OrderStatus[]} | null;
    scope: InquiryScope;
    status: string | undefined;
    inquiryStoresIDs?: number[];
    includeStatusAndDeleted: boolean;
  }): Prisma.Sql => {
    const {
      user,
      employee,
      scope,
      status,
      inquiryStoresIDs,
      includeStatusAndDeleted,
    } = params;

    const isClientAssistant =
      user.role === "CLIENT_ASSISTANT" ||
      user.role === "EMPLOYEE_CLIENT_ASSISTANT";

    const conditions: Prisma.Sql[] = [];

    // ---------- INQUIRY_EMPLOYEE ----------
    if (user.role === "INQUIRY_EMPLOYEE") {
      // status
      if (status && status !== "null") {
        conditions.push(Prisma.sql`o."status" = ${status}::"OrderStatus"`);
      } else if (scope.inquiryStatuses?.length) {
        conditions.push(
          Prisma.sql`o."status" = ANY(${scope.inquiryStatuses}::"OrderStatus"[])`,
        );
      }

      // governorate
      if (scope.inquiryGovernorates?.length) {
        conditions.push(
          Prisma.sql`o."governorate" = ANY(${scope.inquiryGovernorates}::"Governorate"[])`,
        );
      }

      // the branch OR (mirrors buildInquiryBranchOR)
      conditions.push(this.buildInquiryBranchORSql(user, scope));

      // stores
      if (inquiryStoresIDs?.length) {
        conditions.push(
          Prisma.sql`o."storeId" = ANY(${inquiryStoresIDs}::int[])`,
        );
      }

      // company OR forwardedFrom
      conditions.push(
        Prisma.sql`(o."companyId" = ${user.companyID} OR o."forwardedFromId" = ${user.companyID})`,
      );

      // locations
      if (scope.inquiryLocationsIDs?.length) {
        conditions.push(
          Prisma.sql`o."locationId" = ANY(${scope.inquiryLocationsIDs}::int[])`,
        );
      }

      if (includeStatusAndDeleted) {
        conditions.push(Prisma.sql`o."deleted" = false`);
      }

      return conditions.length
        ? Prisma.join(conditions, " AND ")
        : Prisma.sql`true`;
    }

    // ---------- non-inquiry roles ----------
    if (includeStatusAndDeleted) {
      conditions.push(Prisma.sql`o."deleted" = false`);

      if (status && status !== "null") {
        conditions.push(Prisma.sql`o."status" = ${status}::"OrderStatus"`);
      } else if (isClientAssistant && employee?.orderStatus?.length) {
        conditions.push(
          Prisma.sql`o."status" = ANY(${employee.orderStatus}::"OrderStatus"[])`,
        );
      }
    }

    if (user.role === "CLIENT") {
      conditions.push(Prisma.sql`o."clientId" = ${user.id}`);
    }

    if (user.companyID) {
      conditions.push(Prisma.sql`o."companyId" = ${user.companyID}`);
    }

    const usesBranchFilter =
      user.role !== "COMPANY_MANAGER" &&
      !isClientAssistant &&
      !user.mainRepository &&
      user.role !== "DELIVERY_AGENT" &&
      user.role !== "BRANCH_MANAGER";

    if (usesBranchFilter && employee?.branchId) {
      conditions.push(Prisma.sql`o."branchId" = ${employee.branchId}`);
    }

    if (user.role === "DELIVERY_AGENT") {
      conditions.push(Prisma.sql`o."deliveryAgentId" = ${user.id}`);
    }

    if (isClientAssistant && inquiryStoresIDs?.length) {
      conditions.push(
        Prisma.sql`o."storeId" = ANY(${inquiryStoresIDs}::int[])`,
      );
    }

    if (user.role === "BRANCH_MANAGER" && employee?.branchId) {
      conditions.push(Prisma.sql`(
      o."branchId" = ${employee.branchId}
      OR EXISTS (
        SELECT 1 FROM "Client" cl
        WHERE cl."id" = o."clientId" AND cl."branchId" = ${employee.branchId}
      )
    )`);
    }

    return conditions.length
      ? Prisma.join(conditions, " AND ")
      : Prisma.sql`true`;
  };

  private fetchChatsPage = (params: {
    orderWhere: Prisma.OrderWhereInput;
    unRead?: string;
    userId: number;
    page: number;
    size: number;
  }) => {
    const {orderWhere, unRead, userId, page, size} = params;
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const messagesFilter =
      unRead === "true"
        ? {
            some: {
              createdById: {not: userId},
              createdAt: {gt: since},
              NOT: {seenBy: {some: {userId}}},
            },
          }
        : {some: {}};

    return prisma.chat.findManyPaginated(
      {
        where: {messages: messagesFilter, Order: orderWhere},
        orderBy: {updatedAt: "desc"},
        select: {
          id: true,
          orderId: true,
          Order: {select: {receiptNumber: true}},
          messages: {
            orderBy: {createdAt: "desc"},
            take: 1,
            select: {
              image: true,
              content: true,
              createdAt: true,
              createdBy: {select: {id: true, name: true}},
            },
          },
        },
      },
      {page, size, withCount: unRead !== "true"},
    );
  };

  private fetchUnseenCounts = async (params: {
    pageChatIds: number[];
    userId: number;
    orderScope: Prisma.Sql;
  }) => {
    const {pageChatIds, userId, orderScope} = params;
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [perChat, totalRows] = await Promise.all([
      pageChatIds.length
        ? prisma.message.groupBy({
            by: ["chatId"],
            _count: {id: true},
            where: {
              chatId: {in: pageChatIds},
              createdById: {not: userId},
              createdAt: {gt: since},
              NOT: {seenBy: {some: {userId}}},
            },
          })
        : Promise.resolve(
            [] as {chatId: number | null; _count: {id: number}}[],
          ),

      prisma.$queryRaw<{count: bigint}[]>`
      SELECT COUNT(*) AS count FROM (
        SELECT 1
        FROM "Message" m
        JOIN "Chat" c ON c."id" = m."chatId"
        JOIN "Order" o ON o."id" = c."orderId"
        WHERE m."createdById" <> ${userId}
          AND m."createdAt" > ${since}
          AND ${orderScope}
          AND NOT EXISTS (
            SELECT 1 FROM "MessageSeen" ms
            WHERE ms."messageId" = m."id" AND ms."userId" = ${userId}
          )
        LIMIT 100
      ) sub;
    `,
    ]);

    return {perChat, total: Number(totalRows[0]?.count ?? 0)};
  };

  async getOrderInquiryEmployees(data: {orderID: string | undefined}) {
    const order = await prisma.order.findUnique({
      where: {
        id: data.orderID,
      },
      select: {
        branchId: true,
        storeId: true,
        companyId: true,
        locationId: true,
        status: true,
        governorate: true,
        client: {
          select: {
            branchId: true,
          },
        },
        deliveryAgent: {
          select: {
            id: true,
          },
        },
        location: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!order) {
      throw new AppError("الطلب غير موجود", 404);
    }

    const orderInquiryEmployees: {
      id: number;
      name: string;
      phone: string;
      avatar: string;
      role: string;
    }[] = [];

    (
      await prisma.employee.findMany({
        where: {
          AND: [
            {role: "INQUIRY_EMPLOYEE"},
            {
              OR: [
                {
                  branch: {
                    repositories: {
                      some: {
                        mainRepository: true,
                      },
                    },
                  },
                  orderType: null,
                  inquiryBranches: {
                    some: {
                      branchId: {
                        in: [order.branchId!!],
                      },
                    },
                  },
                },
                order.client.branchId
                  ? {
                      branch: {
                        repositories: {
                          some: {
                            mainRepository: true,
                          },
                        },
                      },
                      orderType: null,
                      inquiryBranches: {
                        some: {
                          branchId: {
                            in: [order.client.branchId],
                          },
                        },
                      },
                    }
                  : {},
                {
                  branch: {
                    repositories: {
                      some: {
                        mainRepository: true,
                      },
                    },
                  },
                  orderType: "receiving",
                  inquiryBranches: {
                    some: {
                      branchId: {
                        in: [order.branchId!!],
                      },
                    },
                  },
                },
                order.client.branchId
                  ? {
                      branch: {
                        repositories: {
                          some: {
                            mainRepository: true,
                          },
                        },
                      },
                      orderType: "forwarded",
                      inquiryBranches: {
                        some: {
                          branchId: {
                            in: [order.client.branchId!!],
                          },
                        },
                      },
                    }
                  : {},
                {
                  branch: {
                    repositories: {
                      some: {
                        mainRepository: true,
                      },
                    },
                  },
                  orderType: null,
                  inquiryBranches: {
                    none: {},
                  },
                },
              ],
            },
          ],
        },
        select: {
          user: {
            select: {
              id: true,
              name: true,
              phone: true,
              avatar: true,
            },
          },
          inquiryStatuses: true,
          inquiryGovernorates: true,
          inquiryLocations: true,
          inquiryStores: true,
          inquiryDeliveryAgents: true,
          role: true,
        },
      })
    ).forEach((inquiryEmployee) => {
      const inquiryLocation = inquiryEmployee.inquiryLocations.find(
        (e) => e.locationId === order.locationId,
      );
      const inquiryStore = inquiryEmployee.inquiryStores.find(
        (e) => e.storeId === order.storeId,
      );
      const inquiryDelivery = inquiryEmployee.inquiryDeliveryAgents.find(
        (e) => e.deliveryAgentId === order.deliveryAgent?.id,
      );
      if (
        inquiryEmployee.inquiryStatuses.length > 0 &&
        !inquiryEmployee.inquiryStatuses.includes(order?.status)
      ) {
        return;
      }
      if (
        inquiryEmployee.inquiryGovernorates.length > 0 &&
        !inquiryEmployee.inquiryGovernorates.includes(order?.governorate)
      ) {
        return;
      }
      if (inquiryEmployee.inquiryStores.length > 0 && !inquiryStore) {
        return;
      }
      if (inquiryEmployee.inquiryLocations.length > 0 && !inquiryLocation) {
        return;
      }
      if (
        inquiryEmployee.inquiryDeliveryAgents.length > 0 &&
        order.deliveryAgent &&
        !inquiryDelivery
      ) {
        return;
      }
      orderInquiryEmployees.push({
        id: inquiryEmployee.user?.id ?? null,
        name: inquiryEmployee.user?.name ?? null,
        phone: inquiryEmployee.user?.phone ?? null,
        avatar: inquiryEmployee.user?.avatar ?? null,
        role: inquiryEmployee.role,
      });
    }) ?? [];

    return orderInquiryEmployees;
  }

  getOrderChatMembers = async (orderId: string) => {
    let chatMembers: number[] = [];

    if (!orderId) {
      return chatMembers;
    }
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

    const inquiryEmployees = await this.getOrderInquiryEmployees({
      orderID: orderId,
    });

    const clientAssistant = await prisma.employee.findMany({
      where: {
        AND: [
          {role: {in: ["CLIENT_ASSISTANT", "EMPLOYEE_CLIENT_ASSISTANT"]}},
          {
            OR: [
              {
                clientId: order?.clientId,
              },
              {
                inquiryStores: {
                  some: {
                    storeId: order?.storeId,
                  },
                },
              },
            ],
          },
        ],
      },
      select: {
        id: true,
        orderStatus: true,
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
      if (order?.status && e.orderStatus.includes(order.status)) {
        chatMembers.push(e.id);
      }
    });
    order?.clientId && chatMembers.push(order?.clientId);
    order?.deliveryAgentId && chatMembers.push(order?.deliveryAgentId);

    return chatMembers;
  };

  getUserChats = async (
    user: loggedInUserType,
    size: number,
    page: number,
    status: string | undefined,
    unRead?: string,
  ) => {
    const employee = await prisma.employee.findUnique({
      where: {id: +user.id},
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
        mainEmergency: true,
      },
    });

    const isClientAssistant =
      user.role === "CLIENT_ASSISTANT" ||
      user.role === "EMPLOYEE_CLIENT_ASSISTANT";

    // permission gate
    if (isClientAssistant && !employee?.permissions.includes("MESSAGES")) {
      return {totalUnSeened: 0, pageCounts: 0, count: 0, page: 1, chats: []};
    }

    // scoping
    const scope = await this.resolveInquiryScope(user);
    const inquiryStoresIDs = isClientAssistant
      ? employee?.inquiryStores.map((s) => s.storeId)
      : scope.inquiryStoresIDs;

    // build the two Order where variants (with / without status+deleted)
    const orderWhereFull = this.buildOrderWhere({
      user,
      employee,
      scope,
      status,
      inquiryStoresIDs,
      includeStatusAndDeleted: true,
    });

    // const orderWhereBare = this.buildOrderWhere({
    //   user,
    //   employee,
    //   scope,
    //   status,
    //   inquiryStoresIDs,
    //   includeStatusAndDeleted: false,
    // });

    // page of chats
    const chats = await this.fetchChatsPage({
      orderWhere: orderWhereFull,
      unRead,
      userId: user.id,
      page,
      size,
    });

    // unseen counts
    const pageChatIds = chats.data.map((c) => c.id);

    const orderScopeSql = this.buildOrderScopeSql({
      user,
      employee,
      scope,
      status,
      inquiryStoresIDs,
      includeStatusAndDeleted: false, // matches orderWhereBare
    });

    const {perChat, total} = await this.fetchUnseenCounts({
      pageChatIds,
      userId: user.id,
      orderScope: orderScopeSql,
    });

    const chatsWithStats = chats.data.map((e) => ({
      id: e.id,
      unseenMessages: perChat.find((c) => c.chatId === e.id)?._count.id || 0,
      orderId: e.orderId,
      receiptNumber: e.Order?.receiptNumber,
      lastMessage: e.messages[0],
    }));

    return {
      totalUnSeened: total,
      pageCounts: chats.pagesCount,
      count: chats.dataCount,
      page: chats.currentPage,
      chats: chatsWithStats,
    };
  };

  getChatMessages = async (orderId: string, userId: number) => {
    const employee = await prisma.employee.findUnique({
      where: {id: +userId},
      select: {role: true, permissions: true},
    });

    // both assistant roles need the MESSAGES permission
    if (
      (employee?.role === "CLIENT_ASSISTANT" ||
        employee?.role === "EMPLOYEE_CLIENT_ASSISTANT") &&
      !employee?.permissions.includes("MESSAGES")
    ) {
      return [];
    }

    // resolve chat once via the unique orderId — no per-message join
    const chat = await prisma.chat.findUnique({
      where: {orderId},
      select: {id: true},
    });

    if (!chat) {
      return {data: []};
    }

    const messages = await prisma.message.findMany({
      where: {chatId: chat.id}, // hits idx_message_chat_created directly
      select: {
        id: true,
        content: true,
        image: true,
        createdAt: true,
        createdBy: {select: {id: true, name: true}},
      },
      orderBy: {createdAt: "desc"},
    });

    const messageIds = messages
      .filter((m) => m.createdBy?.id !== userId)
      .map((m) => m.id);

    if (messageIds.length) {
      await prisma.messageSeen.createMany({
        data: messageIds.map((messageId) => ({messageId, userId})),
        skipDuplicates: true,
      });
    }

    return {data: messages};
  };

  sendMessage = catchAsync(async (req, res) => {
    const {content, orderId} = req.body;
    const loggedInUser = res.locals.user as loggedInUserType;

    let image: string | undefined;

    const order = await prisma.order.findUnique({
      where: {
        id: orderId,
      },
      select: {
        id: true,
        receiptNumber: true,
      },
    });

    if (
      loggedInUser.role === "CLIENT_ASSISTANT" ||
      loggedInUser.role === "EMPLOYEE_CLIENT_ASSISTANT"
    ) {
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
        Order: {
          select: {
            receiptNumber: true,
          },
        },
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
          Order: {
            select: {
              receiptNumber: true,
            },
          },
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
        seenByClientAssistant:
          loggedInUser.role === "CLIENT_ASSISTANT" ||
          loggedInUser.role === "EMPLOYEE_CLIENT_ASSISTANT",
        seenByDelivery: loggedInUser.role === "DELIVERY_AGENT",
        seenByBranchManager: loggedInUser.role === "BRANCH_MANAGER",
        seenByCompanyManager: loggedInUser.role === "COMPANY_MANAGER",
        seenByCallCenter: loggedInUser.role === "INQUIRY_EMPLOYEE",
      },
      select: {
        id: true,
        content: true,
        image: true,
        seenByBranchManager: true,
        seenByCompanyManager: true,
        seenByClient: true,
        seenByDelivery: true,
        seenByCallCenter: true,
        seenByClientAssistant: true,
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

    io.to(`chat_${chat.orderId}`).emit("newChatMessage", {
      ...message,
      chatId: chat.id,
    });

    chatMembers.forEach((member) => {
      io.to(`${member}`).emit("newMessage", {
        ...message,
        chatId: chat.id,
        orderId: chat.orderId,
        receiptNumber: chat.Order?.receiptNumber,
      });
    });
    // const chats=await this.getUserChats(loggedInUser.id)

    chatMembers.forEach(async (e) => {
      await sendNotification({
        title: `رساله جديده "${content}"`,
        content: `هناك رساله جديده للطلب رقم ${orderId}`,
        userID: e,
        orderId: order?.id,
        chatId: chat.id,
        receiptNumber: order?.receiptNumber,
        forChat: true,
      });
    });

    res.status(201).json({message: "success"});
  });

  getUserChatStatics = catchAsync(async (req, res) => {
    const loggedInUser = res.locals.user as loggedInUserType;
    const {page, status, unRead} = req.query;

    const chats = await this.getUserChats(
      loggedInUser,
      25,
      page ? +page : 1,
      typeof status === "string" ? status : undefined,
      unRead + "",
    );

    res.status(201).json({...chats});
  });

  getUserChatMessages = catchAsync(async (req, res) => {
    const loggedInUser = res.locals.user as loggedInUserType;
    const {orderId} = req.query;

    if (!orderId) {
      return;
    }
    const chats = await this.getChatMessages(
      orderId?.toString(),
      loggedInUser.id,
    );

    res.status(201).json({...chats});
  });

  markAllSeen = catchAsync(async (_req, res) => {
    const user = res.locals.user as loggedInUserType;

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
    if (user.role === "CLIENT_ASSISTANT") {
      inquiryStoresIDs = employee?.managedStores.map((s) => s.id);
    }
    if (user.role === "EMPLOYEE_CLIENT_ASSISTANT") {
      inquiryStoresIDs = employee?.inquiryStores.map((s) => s.storeId);
    }

    const unseenMessages = await prisma.message.findMany({
      where: {
        Chat: {
          Order:
            user.role === "INQUIRY_EMPLOYEE"
              ? {
                  AND: [
                    {
                      status: inquiryStatuses
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
                      ? {in: inquiryStoresIDs}
                      : undefined,
                },
        },
        NOT: {
          seenBy: {
            some: {
              userId: user.id,
            },
          },
        },

        createdById: {
          not: user.id,
        },
      },
      select: {
        id: true,
      },
    });
    if (!unseenMessages.length) return;

    await prisma.messageSeen.createMany({
      data: unseenMessages.map((m) => ({
        messageId: m.id,
        userId: user.id,
      })),
      skipDuplicates: true,
    });
    res.status(200).json({message: "success"});
  });

  deleteMessages = catchAsync(async (req, res) => {
    const user = res.locals.user as loggedInUserType;
    const {ids} = req.body;
    if (!ids || ids.length === 0) {
      throw new AppError("ليس هناك رسائل", 400);
    }

    // Fetch messages to validate ownership
    const messages = await prisma.message.findMany({
      where: {id: {in: ids}},
      select: {
        id: true,
        createdById: true,
        chatId: true,
        Chat: {
          select: {
            orderId: true,
          },
        },
      },
    });

    io.to(`chat_${messages[0].Chat?.orderId}`).emit("newChatMessage", "");

    // Delete them
    await prisma.message.deleteMany({
      where: {
        id: {in: ids},
        createdById: user.id,
      },
    });

    res.status(200).json({message: "success"});
  });
}
