import {
  Governorate,
  OrderStatus,
  ReportType,
  type Prisma,
  type SecondaryStatus,
} from "@prisma/client";
import {prisma} from "../../database/db";
import {AppError} from "../../lib/AppError";
import type {loggedInUserType} from "../../types/user";
import type {ReportCreateOrdersFiltersType} from "../reports/reports.dto";
import type {
  OrderCreateType,
  OrderTimelineFiltersType,
  OrderTimelinePieceType,
  OrderUpdateType,
  OrdersFiltersType,
  OrdersStatisticsFiltersType,
} from "./orders.dto";
import {
  minifiedOrderReform,
  minifiedOrderSelect,
  // mobileOrderReform,
  orderReform,
  orderReformApiKey,
  orderSelect,
  orderSelectApiKey,
  orderTimelineReform,
  orderTimelineSelect,
  statisticsReformed,
} from "./orders.responses";
import {io} from "../../server";
import {MessagesController} from "../messages/messages.controller";
import crypto from "crypto";
import {redis} from "../../lib/redis";

const messageController = new MessagesController();

let counter = 0;

type UpdatedOrderCosts = {
  id: string;
  deliveryCost?: number;
  clientNet?: number;
  branchNet?: number;
  branchDeliveryCost?: number;
  deliveryAgentNet?: number;
  companyNet?: number;
};

export class OrdersRepository {
  generateRandomId() {
    const now = new Date(
      new Date().toLocaleString("en-US", {timeZone: "Asia/Baghdad"}),
    );

    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const datePart = `${month}${day}`;

    // Use last 3 digits of timestamp → more space for counter
    const ts = Date.now().toString().slice(-3);

    // 2-digit counter (00–99)
    counter = (counter + 1) % 100;

    const ctr = String(counter).padStart(2, "0");

    // Final ID → same length as before
    return `${datePart}${ts}${ctr}`;
  }

  hashFilters(filters: OrdersStatisticsFiltersType) {
    return crypto
      .createHash("sha1")
      .update(JSON.stringify(filters))
      .digest("hex");
  }

  async generateUniqueOrderId() {
    while (true) {
      const id = this.generateRandomId();

      const exists = await prisma.order.findUnique({
        where: {id},
      });

      if (!exists) return id;
    }
  }

  async getDeliverCost(clientId: number, governorate: Governorate) {
    const client = await prisma.client.findUnique({
      where: {
        id: clientId,
      },
      select: {
        governoratesDeliveryCosts: true,
        branchId: true,
      },
    });
    if (!client) {
      throw new AppError("العميل غير موجود", 400);
    }

    const governoratesDeliveryCosts = client.governoratesDeliveryCosts as {
      governorate: Governorate;
      cost: number;
    }[];

    return (
      governoratesDeliveryCosts.find(
        (governorateDeliveryCost: {governorate: Governorate; cost: number}) => {
          return governorateDeliveryCost.governorate === governorate;
        },
      )?.cost || 0
    );
  }

  async createOrder(data: {
    companyID: number;
    clientID: number;
    loggedInUser: loggedInUserType;
    orderData: OrderCreateType;
  }) {
    let totalCost = 0;
    let weight = (data.orderData.weight as number) || 0;
    let status: OrderStatus = "REGISTERED";
    let secondaryStatus: SecondaryStatus = "WITH_CLIENT";
    let receivingBranchId: number | undefined = undefined;
    let forwardedBranchId: number | undefined = undefined;

    const client = await prisma.client.findUnique({
      where: {
        id: data.clientID,
      },
      select: {
        governoratesDeliveryCosts: true,
        branchId: true,
      },
    });

    if (!client) {
      throw new AppError("العميل غير موجود", 400);
    }

    if (
      data.loggedInUser.role !== "CLIENT" &&
      data.loggedInUser.role !== "CLIENT_ASSISTANT"
    ) {
      if (data.loggedInUser.mainRepository) {
        const repository = await prisma.repository.findFirst({
          where: {
            type: "EXPORT",
            branch: {
              id: data.orderData.branchID,
            },
          },
          select: {
            id: true,
          },
        });

        if (!repository) {
          throw new AppError("لا يوجد مخزن فرز مرتبط بالفرع", 404);
        }
        receivingBranchId = data.orderData.branchID;
        forwardedBranchId = client?.branchId || undefined;

        data.orderData.repositoryID = repository.id;
        secondaryStatus = "IN_CAR";
        status = "IN_GOV_REPOSITORY";
      } else {
        if (data.orderData.branchID === client.branchId) {
          const repository = await prisma.repository.findFirst({
            where: {
              type: "EXPORT",
              branch: {
                id: data.orderData.branchID,
              },
            },
            select: {
              id: true,
            },
          });
          data.orderData.repositoryID = repository?.id;
          secondaryStatus = "IN_REPOSITORY";
          status = "IN_GOV_REPOSITORY";
        } else {
          const repository = await prisma.repository.findFirst({
            where: {
              type: "EXPORT",
              mainRepository: true,
              companyId: data.companyID,
            },
            select: {
              id: true,
            },
          });
          receivingBranchId = data.orderData.branchID;
          forwardedBranchId = client?.branchId || undefined;

          data.orderData.repositoryID = repository?.id;
          secondaryStatus = "IN_CAR";
          status = "IN_MAIN_REPOSITORY";
        }
      }
    }

    // Calculate delivery cost
    let deliveryCost = 0;

    const governoratesDeliveryCosts = client.governoratesDeliveryCosts as {
      governorate: Governorate;
      cost: number;
    }[];

    if (governoratesDeliveryCosts) {
      deliveryCost =
        governoratesDeliveryCosts.find(
          (governorateDeliveryCost: {
            governorate: Governorate;
            cost: number;
          }) => {
            return (
              governorateDeliveryCost.governorate === data.orderData.governorate
            );
          },
        )?.cost || 0;
    }

    // Add Additional costs

    const companyAdditionalPrices = await prisma.company.findUnique({
      where: {
        id: data.companyID,
      },
      select: {
        additionalPriceForEvery500000IraqiDinar: true,
        additionalPriceForEveryKilogram: true,
        additionalPriceForRemoteAreas: true,
      },
    });

    deliveryCost +=
      companyAdditionalPrices?.additionalPriceForEvery500000IraqiDinar
        ? companyAdditionalPrices?.additionalPriceForEvery500000IraqiDinar *
          Math.ceil(totalCost / 500000)
        : 0;
    deliveryCost += companyAdditionalPrices?.additionalPriceForEveryKilogram
      ? weight * companyAdditionalPrices?.additionalPriceForEveryKilogram
      : 0;

    if (data.orderData.locationID) {
      const location = await prisma.location.findUnique({
        where: {
          id: data.orderData.locationID,
        },
        select: {
          remote: true,
        },
      });

      deliveryCost += location?.remote
        ? companyAdditionalPrices?.additionalPriceForRemoteAreas || 0
        : 0;
    }

    let randomId = await this.generateUniqueOrderId();

    // Create order
    const createdOrder = await prisma.order.create({
      data: {
        id: randomId,
        totalCost: data.orderData.totalCost,
        deliveryCost: deliveryCost,
        quantity: data.orderData.quantity,
        weight: weight,
        recipientName: data.orderData.recipientName,
        recipientPhones: data.orderData.recipientPhones
          ? data.orderData.recipientPhones
          : data.orderData.recipientPhone
            ? [data.orderData.recipientPhone]
            : undefined,
        receiptNumber: data.orderData.receiptNumber
          ? data.orderData.receiptNumber
          : randomId,
        recipientAddress: data.orderData.recipientAddress,
        clientNotes: data.orderData.notes,
        details: data.orderData.details,
        deliveryType: data.orderData.deliveryType,
        printed: data.orderData.clientOrderReceiptId ? true : false,
        receivedBranchId: receivingBranchId || undefined,
        forwardedBranchId: forwardedBranchId || undefined,
        clientOrderReceipt: data.orderData.clientOrderReceiptId
          ? {
              connect: {
                id: +data.orderData.clientOrderReceiptId,
              },
            }
          : undefined,
        governorate: data.orderData.governorate,
        branch: data.orderData.branchID
          ? {
              connect: {
                id: data.orderData.branchID,
              },
            }
          : undefined,
        repository: data.orderData.repositoryID
          ? {
              connect: {
                id: data.orderData.repositoryID,
              },
            }
          : undefined,
        location: {
          connect: {
            id: data.orderData.locationID,
          },
        },
        store: {
          connect: {
            id: data.orderData.storeID,
          },
        },
        company: {
          connect: {
            id: data.orderData.forwardedCompanyID
              ? data.orderData.forwardedCompanyID
              : data.companyID,
          },
        },
        forwarded: data.orderData.forwardedCompanyID ? true : undefined,
        forwardedBy: data.orderData.forwardedCompanyID
          ? {
              connect: {
                id: data.loggedInUser.id,
              },
            }
          : undefined,
        forwardedAt: data.orderData.forwardedCompanyID ? new Date() : undefined,
        forwardedFrom: data.orderData.forwardedCompanyID
          ? {
              connect: {
                id: data.companyID,
              },
            }
          : undefined,
        client: {
          connect: {
            id: data.clientID,
          },
        },
        ordersInquiryEmployees: data.orderData.inquiryEmployeesIDs
          ? {
              create: data.orderData.inquiryEmployeesIDs?.map((id) => {
                return {
                  inquiryEmployee: {
                    connect: {
                      id: id,
                    },
                  },
                };
              }),
            }
          : undefined,
        confirmed: data.orderData.confirmed,
        receivedAt: data.orderData.confirmed ? new Date() : undefined,
        status: status,
        secondaryStatus: secondaryStatus,
        deliveryAgent: undefined,
        orderProducts: undefined,
      },
      select: orderSelect,
    });

    await prisma.chat.create({
      data: {
        orderId: createdOrder.id,
        numberOfMessages: 0,
      },
    });

    return orderReform(createdOrder);
  }

  async createPaperOrder(data: {
    companyID: number;
    clientID: number;
    loggedInUser: loggedInUserType;
    orderData: {
      receiptNumber: string;
      governorate?: Governorate;
      branchID?: number;
      locationID: number;
      storeID: number;
    };
  }) {
    let randomId = await this.generateUniqueOrderId();

    const createdOrder = await prisma.order.create({
      data: {
        id: randomId,
        totalCost: 0,
        deliveryCost: 0,
        quantity: 0,
        weight: 0,
        recipientName: "افتراضي",
        recipientPhones: [],
        receiptNumber: data.orderData.receiptNumber,
        recipientAddress: "",
        clientNotes: "",
        details: "",
        deliveryType: "NORMAL",
        printed: true,
        governorate: data.orderData.governorate || "BAGHDAD",
        branch: data.orderData.branchID
          ? {
              connect: {
                id: data.orderData.branchID,
              },
            }
          : undefined,
        location: {
          connect: {
            id: data.orderData.locationID,
          },
        },
        store: {
          connect: {
            id: data.orderData.storeID,
          },
        },
        company: {
          connect: {
            id: data.companyID,
          },
        },
        client: {
          connect: {
            id: data.clientID,
          },
        },
        confirmed: false,
        receivedAt: undefined,
        status: "READY_TO_SEND",
        secondaryStatus: "WITH_CLIENT",
        deliveryAgent: undefined,
        orderProducts: undefined,
      },
      select: orderSelect,
    });

    await prisma.chat.create({
      data: {
        orderId: createdOrder.id,
        numberOfMessages: 0,
      },
    });

    return orderReform(createdOrder);
  }

  async getAllOrdersPaginated(data: {
    filters: OrdersFiltersType | ReportCreateOrdersFiltersType;
    loggedInUser: loggedInUserType | undefined;
  }) {
    let startDate = new Date();
    let endDate = new Date();
    let childBranchs: number[] = [];

    if (data.filters.startDate) {
      startDate = new Date(data.filters.startDate);
      startDate.setUTCDate(startDate.getUTCDate() - 1);
      startDate.setHours(21, 0, 0, 0);
    }
    if (data.filters.endDate) {
      endDate = new Date(data.filters.endDate);
      endDate.setHours(21, 0, 0, 0);
    }

    let deliveryStartDate = new Date();
    let deliveryEndDate = new Date();

    if (data.filters.startDeliveryDate) {
      deliveryStartDate = new Date(data.filters.startDeliveryDate);
    }
    if (data.filters.endDeliveryDate) {
      deliveryEndDate = new Date(data.filters.endDeliveryDate);
    }
    if (data.filters.branchID) {
      const branchs = await prisma.branch.findMany({
        where: {
          parentBranchId: data.filters.branchID,
        },
        select: {
          id: true,
        },
      });
      childBranchs = branchs.map((b) => b.id);
    }

    const where =
      data.loggedInUser?.role === "INQUIRY_EMPLOYEE"
        ? ({
            AND: [
              // Search by receiptNumber, recipientName, recipientPhone, recipientAddress
              {
                OR: [
                  {
                    receiptNumber: data.filters.search
                      ? data.filters.search
                      : undefined,
                  },
                  {
                    branchReportId: data.filters.search
                      ? Number.isNaN(+data.filters.search)
                        ? undefined
                        : data.filters.search.length > 9
                          ? undefined
                          : +data.filters.search
                      : undefined,
                  },
                  {
                    clientReport: data.filters.search
                      ? Number.isNaN(+data.filters.search)
                        ? undefined
                        : data.filters.search.length > 9
                          ? undefined
                          : {
                              some: {
                                id: +data.filters.search,
                              },
                            }
                      : undefined,
                  },
                  {
                    repositoryReport: data.filters.search
                      ? Number.isNaN(+data.filters.search)
                        ? undefined
                        : data.filters.search.length > 9
                          ? undefined
                          : {
                              some: {
                                id: +data.filters.search,
                              },
                            }
                      : undefined,
                  },
                  {
                    companyReport: data.filters.search
                      ? Number.isNaN(+data.filters.search)
                        ? undefined
                        : data.filters.search.length > 9
                          ? undefined
                          : {
                              some: {
                                id: +data.filters.search,
                              },
                            }
                      : undefined,
                  },
                  {
                    deliveryAgentReportId: data.filters.search
                      ? Number.isNaN(+data.filters.search)
                        ? undefined
                        : data.filters.search.length > 9
                          ? undefined
                          : +data.filters.search
                      : undefined,
                  },
                  {
                    governorateReportId: data.filters.search
                      ? Number.isNaN(+data.filters.search)
                        ? undefined
                        : data.filters.search.length > 9
                          ? undefined
                          : +data.filters.search
                      : undefined,
                  },
                  {
                    recipientName: {
                      contains: data.filters.search,
                      mode: "insensitive",
                    },
                  },
                  {
                    recipientPhones: data.filters.search
                      ? {
                          has: data.filters.search,
                        }
                      : undefined,
                  },
                  {
                    recipientAddress: {
                      contains: data.filters.search,
                      mode: "insensitive",
                    },
                  },
                ],
              },
              {
                deleted: data.filters.deleted,
              },
              // Filter by orderID
              {
                id: data.filters.orderID,
              },
              {
                confirmed: data.filters.confirmed,
              },
              {
                processed: data.filters.processed,
              },
              {
                processingStatus: data.filters.processingStatus,
              },
              {
                status: data.filters.statuses
                  ? {in: data.filters.statuses}
                  : undefined,
              },
              {
                status: data.filters.status,
              },
              {
                governorate: data.filters.inquiryGovernorates
                  ? {
                      in: data.filters.inquiryGovernorates,
                    }
                  : undefined,
              },
              {
                governorate: data.filters.governorate,
              },
              // Filter by notes
              {
                notes: data.filters.notes,
              },
              {
                branch: data.filters.orderType
                  ? undefined
                  : data.filters.inquiryBranchesIDs
                    ? {
                        id: {
                          in: data.filters.inquiryBranchesIDs,
                        },
                      }
                    : data.loggedInUser.mainRepository
                      ? undefined
                      : {
                          id: data.loggedInUser.branchId,
                        },
              },
              {
                branchId: data.filters.orderType
                  ? undefined
                  : data.filters.branchID,
              },
              {
                clientId: data.filters.clientID,
              },
              {
                deliveryAgentId: data.filters.deliveryAgentID,
              },
              {
                store: data.filters.inquiryStoresIDs
                  ? {
                      id: {
                        in: data.filters.inquiryStoresIDs,
                      },
                    }
                  : undefined,
              },
              {
                storeId: data.filters.storeID,
              },
              {
                locationId: data.filters.locationID,
              },
              {
                company: {
                  id: data.filters.companyID,
                },
              },
              // Filter by startDate
              {
                createdAt: data.filters.startDate
                  ? {
                      gt: startDate,
                    }
                  : undefined,
              },
              // Filter by endDate
              {
                createdAt: data.filters.endDate
                  ? {
                      lt: endDate,
                    }
                  : undefined,
              },
              {
                // gte deliveryDate day start time (00:00:00) and lte deliveryDate day end time (23:59:59)
                updatedAt: data.filters.deliveryDate
                  ? {
                      gte: new Date(
                        new Date(data.filters.deliveryDate).setHours(
                          0,
                          0,
                          0,
                          0,
                        ),
                      ),
                      lte: new Date(
                        new Date(data.filters.deliveryDate).setHours(
                          23,
                          59,
                          59,
                          999,
                        ),
                      ),
                    }
                  : undefined,
              },
              {
                location: data.filters.inquiryLocationsIDs
                  ? {
                      id: {
                        in: data.filters.inquiryLocationsIDs,
                      },
                    }
                  : undefined,
              },
              {
                deliveryAgent: data.filters.inquiryDeliveryAgentsIDs
                  ? {
                      id: {
                        in: data.filters.inquiryDeliveryAgentsIDs,
                      },
                    }
                  : undefined,
              },
              {
                AND: [
                  data.filters.clientReport === "true"
                    ? {
                        clientReport: {
                          some: {
                            report: {
                              deleted: false,
                            },
                          },
                        },
                      }
                    : {},
                  {
                    OR:
                      data.filters.clientReport === "false"
                        ? [
                            {
                              clientReport: {
                                none: {},
                              },
                            },
                            {
                              clientReport: {
                                some: {
                                  report: {
                                    deleted: true,
                                  },
                                },
                              },
                            },
                          ]
                        : undefined,
                  },
                ],
              },
              // Filter by repositoryReport
              {
                AND: [
                  data.filters.repositoryReport === "true"
                    ? {
                        repositoryReport: {
                          some: {
                            report: {
                              deleted: false,
                            },
                          },
                        },
                      }
                    : {},
                  {
                    OR:
                      data.filters.repositoryReport === "false"
                        ? [
                            {
                              repositoryReport: {
                                none: {},
                              },
                            },
                            {
                              repositoryReport: {
                                some: {
                                  report: {
                                    deleted: true,
                                  },
                                },
                              },
                            },
                          ]
                        : undefined,
                  },
                ],
              },
              // Filter by branchReport
              {
                AND: [
                  data.filters.branchReport === "true"
                    ? {
                        branchReport: {
                          some: {
                            report: {
                              deleted: false,
                            },
                          },
                        },
                      }
                    : {},
                  {
                    OR:
                      data.filters.branchReport === "false"
                        ? [
                            {
                              branchReport: {
                                none: {},
                              },
                            },
                            {
                              branchReport: {
                                some: {
                                  report: {
                                    deleted: true,
                                  },
                                },
                              },
                            },
                          ]
                        : undefined,
                  },
                ],
              },
              // Filter by deliveryAgentReport
              {
                AND: [
                  {
                    AND:
                      data.filters.deliveryAgentReport === "true"
                        ? [
                            {deliveryAgentReport: {isNot: null}},
                            {
                              deliveryAgentReport: {
                                report: {deleted: false},
                              },
                            },
                          ]
                        : undefined,
                  },
                  {
                    OR:
                      data.filters.deliveryAgentReport === "false"
                        ? [
                            {deliveryAgentReport: {is: null}},
                            {
                              deliveryAgentReport: {
                                report: {deleted: true},
                              },
                            },
                          ]
                        : undefined,
                  },
                ],
              },
              // Filter by governorateReport
              {
                AND: [
                  {
                    AND:
                      data.filters.governorateReport === "true"
                        ? [
                            {governorateReport: {isNot: null}},
                            {
                              governorateReport: {report: {deleted: false}},
                            },
                          ]
                        : undefined,
                  },
                  {
                    OR:
                      data.filters.governorateReport === "false"
                        ? [
                            {governorateReport: {is: null}},
                            {
                              governorateReport: {report: {deleted: true}},
                            },
                          ]
                        : undefined,
                  },
                ],
              },
              // Filter by companyReport
              {
                AND: [
                  data.filters.companyReport === "true"
                    ? {
                        companyReport: {
                          some: {
                            report: {
                              deleted: false,
                            },
                          },
                        },
                      }
                    : {},
                  {
                    OR:
                      data.filters.companyReport === "false"
                        ? [
                            {
                              companyReport: {
                                none: {},
                              },
                            },
                            {
                              companyReport: {
                                some: {
                                  report: {
                                    deleted: true,
                                  },
                                },
                              },
                            },
                          ]
                        : undefined,
                  },
                ],
              },
              {
                forwardedBranchId:
                  data.filters.orderType === "forwarded"
                    ? data.filters.branchID
                    : undefined,
              },
              {
                receivedBranchId:
                  data.filters.orderType === "received"
                    ? data.filters.branchID
                    : undefined,
              },
              {
                OR: [
                  {
                    branchId: data.filters.inquiryBranchesIDs
                      ? {in: data.filters.inquiryBranchesIDs}
                      : undefined,
                  },
                  {
                    forwardedBranchId:
                      data.filters.orderType === "forwarded" &&
                      data.filters.inquiryBranchesIDs
                        ? {in: data.filters.inquiryBranchesIDs}
                        : data.filters.orderType === "forwarded"
                          ? {not: null}
                          : undefined,
                  },
                  {
                    receivedBranchId:
                      data.filters.orderType === "receiving" &&
                      data.filters.inquiryBranchesIDs
                        ? {in: data.filters.inquiryBranchesIDs}
                        : data.filters.orderType === "receiving"
                          ? {not: null}
                          : undefined,
                  },
                ],
              },
            ],
          } satisfies Prisma.OrderWhereInput)
        : ({
            AND: [
              // Search by receiptNumber, recipientName, recipientPhone, recipientAddress
              {
                OR: [
                  {
                    receiptNumber: data.filters.search
                      ? data.filters.search
                      : undefined,
                  },
                  {
                    branchReportId: data.filters.search
                      ? Number.isNaN(+data.filters.search)
                        ? undefined
                        : data.filters.search.length > 9
                          ? undefined
                          : +data.filters.search
                      : undefined,
                  },
                  {
                    clientReport: data.filters.search
                      ? Number.isNaN(+data.filters.search)
                        ? undefined
                        : data.filters.search.length > 9
                          ? undefined
                          : {
                              some: {
                                id: +data.filters.search,
                              },
                            }
                      : undefined,
                  },
                  {
                    repositoryReport: data.filters.search
                      ? Number.isNaN(+data.filters.search)
                        ? undefined
                        : data.filters.search.length > 9
                          ? undefined
                          : {
                              some: {
                                id: +data.filters.search,
                              },
                            }
                      : undefined,
                  },
                  {
                    companyReport: data.filters.search
                      ? Number.isNaN(+data.filters.search)
                        ? undefined
                        : data.filters.search.length > 9
                          ? undefined
                          : {
                              some: {
                                id: +data.filters.search,
                              },
                            }
                      : undefined,
                  },
                  {
                    deliveryAgentReportId: data.filters.search
                      ? Number.isNaN(+data.filters.search)
                        ? undefined
                        : data.filters.search.length > 9
                          ? undefined
                          : +data.filters.search
                      : undefined,
                  },
                  {
                    governorateReportId: data.filters.search
                      ? Number.isNaN(+data.filters.search)
                        ? undefined
                        : data.filters.search.length > 9
                          ? undefined
                          : +data.filters.search
                      : undefined,
                  },
                  {
                    recipientName: {
                      contains: data.filters.search,
                      mode: "insensitive",
                    },
                  },
                  {
                    recipientPhones: data.filters.search
                      ? {
                          has: data.filters.search,
                        }
                      : undefined,
                  },
                  {
                    recipientAddress: {
                      contains: data.filters.search,
                      mode: "insensitive",
                    },
                  },
                ],
              },
              {
                OR: [
                  {
                    company: {
                      id: data.filters.companyID,
                    },
                  },
                  {
                    forwardedFrom: {
                      id: data.filters.inquiryCompaniesIDs
                        ? {
                            in: [
                              ...data.filters.inquiryCompaniesIDs,
                              //   data.filters.companyID as number
                            ],
                          }
                        : data.filters.forwarded &&
                            data.filters.forwardedFromID === undefined
                          ? undefined
                          : data.filters.governorate
                            ? undefined
                            : data.filters.companyID,
                    },
                  },
                ],
              },
              // Filter by companyID
              {
                confirmed: data.filters.confirmed,
              },
              {
                processed: data.filters.processed,
              },
              {
                processingStatus: data.filters.processingStatus,
              },
              // Filter by orderID
              {
                id: data.filters.orderID,
              },
              // Filter by status
              {
                status: data.filters.statuses
                  ? {in: data.filters.statuses}
                  : undefined,
              },
              {
                deliveryDate: data.filters.startDeliveryDate
                  ? {
                      gte: deliveryStartDate,
                    }
                  : undefined,
              },
              // Filter by endDate
              {
                deliveryDate: data.filters.endDeliveryDate
                  ? {
                      lt: deliveryEndDate,
                    }
                  : undefined,
              },
              {
                status:
                  data.filters.status === "RETURNED" &&
                  data.loggedInUser?.role === "RECEIVING_AGENT"
                    ? {in: ["RETURNED", "REPLACED", "PARTIALLY_RETURNED"]}
                    : data.filters.status,
              },
              // Filter by deliveryType
              {
                deliveryType: data.filters.deliveryType,
              },
              // Filter by deliveryDate
              {
                // gte deliveryDate day start time (00:00:00) and lte deliveryDate day end time (23:59:59)
                updatedAt: data.filters.deliveryDate
                  ? {
                      gte: new Date(
                        new Date(data.filters.deliveryDate).setHours(
                          0,
                          0,
                          0,
                          0,
                        ),
                      ),
                      lte: new Date(
                        new Date(data.filters.deliveryDate).setHours(
                          23,
                          59,
                          59,
                          999,
                        ),
                      ),
                    }
                  : undefined,
              },
              // Filter by deliveryAgentID
              {
                deliveryAgent: {
                  id: data.filters.deliveryAgentID,
                },
              },
              // Filter by clientID
              {
                client: {
                  id: data.filters.clientID,
                },
              },
              // Filter by storeID
              {
                store: {
                  id:
                    data.loggedInUser?.role === "CLIENT_ASSISTANT" ||
                    data.loggedInUser?.role === "EMPLOYEE_CLIENT_ASSISTANT"
                      ? {in: data.filters.inquiryStoresIDs}
                      : data.filters.storeID,
                },
              },
              // Filter by locationID
              {
                location: {
                  id: data.filters.locationID,
                },
              },
              {
                receiptNumber: data.filters.receiptNumber,
              },
              {
                printed: data.filters.printed,
              },
              {
                receiptNumber: data.filters.receiptNumbers
                  ? {in: data.filters.receiptNumbers}
                  : undefined,
              },
              // Filter by recipientName
              {
                recipientName: data.filters.recipientName,
              },
              // Filter by recipientPhone
              {
                recipientPhones: data.filters.recipientPhone
                  ? {
                      has: data.filters.recipientPhone,
                    }
                  : undefined,
              },
              // Filter by recipientAddress
              {
                recipientAddress: data.filters.recipientAddress,
              },
              // Filter by notes
              {
                notes: data.filters.notes,
              },
              // Filter by startDate
              {
                createdAt: data.filters.startDate
                  ? {
                      gt: startDate,
                    }
                  : undefined,
              },
              // Filter by endDate
              {
                createdAt: data.filters.endDate
                  ? {
                      lt: endDate,
                    }
                  : undefined,
              },
              // Filter by deleted
              {
                deleted: data.filters.deleted,
              },
              // Filter by clientReport
              {
                AND: [
                  data.filters.clientReport === "true"
                    ? {
                        clientReport: {
                          some: {
                            secondaryType:
                              data.filters.delivered &&
                              data.filters.orderType === "forwarded"
                                ? "DELIVERED"
                                : undefined,
                            report: {
                              deleted: false,
                            },
                          },
                        },
                      }
                    : {},
                  {
                    OR:
                      data.filters.clientReport === "false"
                        ? [
                            {
                              clientReport: {
                                none: {
                                  secondaryType: data.filters.delivered
                                    ? "DELIVERED"
                                    : undefined,
                                  report: {
                                    deleted: false,
                                  },
                                },
                              },
                            },
                          ]
                        : undefined,
                  },
                ],
              },
              // Filter by repositoryReport
              {
                AND: [
                  data.filters.repositoryReport === "true"
                    ? {
                        repositoryReport: {
                          some: {
                            report: {
                              deleted: false,
                            },
                          },
                        },
                      }
                    : {},
                  {
                    OR:
                      data.filters.repositoryReport === "false"
                        ? [
                            {
                              repositoryReport: {
                                none: {
                                  report: {
                                    deleted: true,
                                  },
                                },
                              },
                            },
                          ]
                        : undefined,
                  },
                ],
              },
              // Filter by branchReport
              {
                AND: [
                  data.filters.branchReport === "true"
                    ? {
                        branchReport: {
                          some: {
                            report: {
                              deleted: false,
                            },
                          },
                        },
                      }
                    : {},
                  data.filters.branchReport === "false"
                    ? {
                        branchReport: {
                          none: {
                            // branchId: data.filters.branchID,
                            forChildBranches: data.filters.forChilds
                              ? true
                              : false,
                            type: data.filters.orderType,
                            report: {
                              deleted: false,
                            },
                          },
                        },
                      }
                    : {},
                ],
              },
              // Filter by deliveryAgentReport
              {
                AND: [
                  {
                    AND:
                      data.filters.deliveryAgentReport === "true"
                        ? [
                            {deliveryAgentReport: {isNot: null}},
                            {
                              deliveryAgentReport: {
                                report: {deleted: false},
                              },
                            },
                          ]
                        : undefined,
                  },
                  {
                    OR:
                      data.filters.deliveryAgentReport === "false"
                        ? [
                            {deliveryAgentReport: {is: null}},
                            {
                              deliveryAgentReport: {
                                report: {deleted: true},
                              },
                            },
                          ]
                        : undefined,
                  },
                ],
              },
              // Filter by governorateReport
              {
                AND: [
                  {
                    AND:
                      data.filters.governorateReport === "true"
                        ? [
                            {governorateReport: {isNot: null}},
                            {
                              governorateReport: {report: {deleted: false}},
                            },
                          ]
                        : undefined,
                  },
                  {
                    OR:
                      data.filters.governorateReport === "false"
                        ? [
                            {governorateReport: {is: null}},
                            {
                              governorateReport: {report: {deleted: true}},
                            },
                          ]
                        : undefined,
                  },
                ],
              },
              // Filter by companyReport
              {
                AND: [
                  data.filters.companyReport === "true"
                    ? {
                        companyReport: {
                          some: {
                            report: {
                              deleted: false,
                            },
                          },
                        },
                      }
                    : {},
                  {
                    OR:
                      data.filters.companyReport === "false"
                        ? [
                            {
                              companyReport: {
                                none: {},
                              },
                            },
                            {
                              companyReport: {
                                some: {
                                  report: {
                                    deleted: true,
                                  },
                                },
                              },
                            },
                          ]
                        : undefined,
                  },
                ],
              },
              // Filter by automaticUpdateID
              {
                automaticUpdate: {
                  id: data.filters.automaticUpdateID,
                },
              },
              {
                forwarded: data.filters.forwarded,
              },
              {
                OR:
                  data.filters.orderType && data.filters.orderType !== "inside"
                    ? []
                    : data.filters.governorate &&
                        data.filters.governorateReport === "false"
                      ? [
                          {
                            branch: {
                              governorate: data.filters.governorate,
                            },
                          },
                        ]
                      : data.loggedInUser?.role !== "DELIVERY_AGENT"
                        ? [
                            {
                              branch: data.filters.inquiryBranchesIDs
                                ? {
                                    id: {
                                      in: data.filters.inquiryBranchesIDs,
                                    },
                                  }
                                : {
                                    id: data.filters.branchID,
                                  },
                            },
                            {
                              branch: data.filters.inquiryBranchesIDs
                                ? {
                                    parentBranchId: {
                                      in: data.filters.inquiryBranchesIDs,
                                    },
                                  }
                                : {
                                    parentBranchId: data.filters.branchID,
                                  },
                            },
                            {
                              client:
                                data.loggedInUser?.role !== "COMPANY_MANAGER" &&
                                !data.loggedInUser?.mainRepository
                                  ? {
                                      branchId: data.loggedInUser?.branchId,
                                    }
                                  : undefined,
                            },
                            {
                              client:
                                data.loggedInUser?.role !== "COMPANY_MANAGER" &&
                                !data.loggedInUser?.mainRepository
                                  ? {
                                      branch: {
                                        parentBranchId:
                                          data.loggedInUser?.branchId,
                                      },
                                    }
                                  : undefined,
                            },
                          ]
                        : undefined,
              },
              {
                governorate:
                  data.filters.governorate &&
                  data.filters.governorateReport === "false"
                    ? undefined
                    : data.filters.governorate,
              },
              {
                repository:
                  data.filters.secondaryStatus === "IN_REPOSITORY"
                    ? {
                        mainRepository: false,
                        branchId: data.filters.branchID,
                      }
                    : data.filters.secondaryStatus === "IN_CAR"
                      ? {
                          mainRepository: true,
                        }
                      : {
                          id: data.filters.repositoryID,
                        },
              },
              {
                secondaryStatus:
                  data.filters.secondaryStatus === "WITH_AGENT"
                    ? "WITH_AGENT"
                    : data.filters.secondaryStatus === "IN_REPOSITORY" ||
                        data.filters.secondaryStatus === "IN_CAR"
                      ? "IN_REPOSITORY"
                      : data.filters.secondaryStatus,
              },
              {
                timeline: {
                  some: data.filters.updateBy
                    ? {
                        by: {
                          path: ["id"],
                          equals: data.filters.updateBy, // number: 295
                        },
                      }
                    : data.filters.createdBy
                      ? {
                          type: "ORDER_CREATION",
                          by: {
                            path: ["id"],
                            equals: data.filters.createdBy, // number: 295
                          },
                        }
                      : undefined,
                },
              },
              {
                OR: [
                  {
                    AND:
                      data.filters.orderType === "forwarded"
                        ? [
                            {
                              OR: [
                                {
                                  client: {
                                    branchId: data.filters.branchID,
                                  },
                                },
                                {
                                  client: {
                                    branch: {
                                      parentBranchId: data.filters.branchID,
                                    },
                                  },
                                },
                              ],
                            },

                            {
                              branch: {
                                id: {not: data.filters.branchID},
                              },
                            },
                            {
                              branch: {
                                id: {notIn: childBranchs},
                              },
                            },
                          ]
                        : data.filters.orderType === "received"
                          ? [
                              {
                                client: {
                                  branchId: {not: data.filters.branchID},
                                },
                              },
                              {
                                client: {
                                  branchId: {notIn: childBranchs},
                                },
                              },
                              {
                                OR: [
                                  {
                                    branchId: data.filters.branchID,
                                  },
                                  {
                                    branchId: {in: childBranchs},
                                  },
                                ],
                              },
                            ]
                          : [],
                  },
                  data.filters.orderType === "forwarded" ||
                  data.filters.orderType === "received"
                    ? {
                        AND: [
                          {
                            branch: {
                              id: data.filters.branchID,
                              governorate: "BAGHDAD",
                              // parentBranchId: {equals: null},
                            },
                          },
                          {
                            client: {
                              branchId: data.filters.branchID,
                            },
                          },
                        ],
                      }
                    : {},
                ],
              },
              {
                AND:
                  data.filters.orderType === "forwardedAll" &&
                  (data.loggedInUser?.role === "COMPANY_MANAGER" ||
                    data.loggedInUser?.mainRepository) &&
                  data.filters.branchID
                    ? [
                        {
                          client: {
                            branchId: data.filters.branchID,
                          },
                        },
                        {
                          branchId: {not: data.filters.branchID},
                        },
                      ]
                    : data.filters.orderType === "forwardedAll" &&
                        (data.loggedInUser?.role === "COMPANY_MANAGER" ||
                          data.loggedInUser?.mainRepository)
                      ? [
                          {
                            client: {
                              branchId: {not: data.loggedInUser.branchId},
                            },
                          },
                        ]
                      : data.filters.orderType === "forwardedAll"
                        ? [
                            {
                              client: {
                                branchId: data.loggedInUser?.branchId,
                              },
                            },
                            {
                              branchId: {not: data.loggedInUser?.branchId},
                            },
                          ]
                        : data.filters.orderType === "receivedAll" &&
                            data.filters.branchID &&
                            data.loggedInUser?.role !== "COMPANY_MANAGER" &&
                            !data.loggedInUser?.mainCompany
                          ? [
                              {
                                client: {
                                  branchId: data.filters.branchID,
                                },
                              },
                              {
                                branchId: {not: data.filters.branchID},
                              },
                            ]
                          : data.filters.orderType === "inside"
                            ? [
                                {
                                  client: {
                                    branchId: data.loggedInUser?.branchId,
                                  },
                                },
                                {
                                  branchId: data.loggedInUser?.branchId,
                                },
                              ]
                            : [],
              },
              {
                AND:
                  data.filters.orderType === "receivedAll" &&
                  (data.loggedInUser?.role === "COMPANY_MANAGER" ||
                    data.loggedInUser?.mainRepository) &&
                  data.filters.branchID
                    ? [
                        {
                          branchId: data.filters.branchID,
                        },
                        {
                          client: {
                            branchId: {not: data.filters.branchID},
                          },
                        },
                      ]
                    : data.filters.orderType === "receivedAll" &&
                        (data.loggedInUser?.role === "COMPANY_MANAGER" ||
                          data.loggedInUser?.mainRepository)
                      ? [
                          {
                            branchId: {not: data.loggedInUser.branchId},
                          },
                        ]
                      : data.filters.orderType === "forwardedAll" &&
                          data.filters.branchID &&
                          data.loggedInUser?.role !== "COMPANY_MANAGER" &&
                          !data.loggedInUser?.mainCompany
                        ? [
                            {
                              branchId: data.filters.branchID,
                            },
                            {
                              client: {
                                branchId: {not: data.filters.branchID},
                              },
                            },
                          ]
                        : data.filters.orderType === "receivedAll"
                          ? [
                              {
                                branchId: data.loggedInUser?.branchId,
                              },
                            ]
                          : [],
              },
            ],
          } satisfies Prisma.OrderWhereInput);

    if (data.filters.minified === true || data.filters.forMobile === true) {
      const paginatedOrders = await prisma.order.findManyPaginated(
        {
          where:
            data.loggedInUser?.role === "RECEIVING_AGENT" &&
            data.filters.status === "RETURNED"
              ? {
                  AND: [
                    {
                      status: {
                        in: ["RETURNED", "REPLACED", "PARTIALLY_RETURNED"],
                      },
                    },
                    {
                      clientReport: {
                        some: {
                          receivingAgentId: data.loggedInUser.id,
                          report: {
                            deleted: false,
                          },
                        },
                      },
                    },
                    {
                      client: {
                        id: data.filters.clientID,
                      },
                    },
                  ],
                }
              : {
                  ...where,
                  OR:
                    (data.loggedInUser?.role === "CLIENT" ||
                      data.loggedInUser?.role === "INQUIRY_EMPLOYEE" ||
                      data.loggedInUser?.role === "EMPLOYEE_CLIENT_ASSISTANT" ||
                      data.loggedInUser?.role === "CLIENT_ASSISTANT") &&
                    !data.filters.receiptNumber &&
                    !data.filters.search
                      ? [
                          {
                            clientReport: {
                              none: {
                                secondaryType: "DELIVERED",
                                report: {
                                  deleted: false,
                                },
                              },
                            },
                            status: {
                              not: "RETURNED",
                            },
                          },
                          {
                            clientReport: {
                              none: {
                                secondaryType: "RETURNED",
                                report: {
                                  deleted: false,
                                },
                              },
                            },
                            status: {
                              in: [
                                "RETURNED",
                                "REPLACED",
                                "PARTIALLY_RETURNED",
                              ],
                            },
                          },
                        ]
                      : data.loggedInUser?.role === "DELIVERY_AGENT" &&
                          !data.filters.receiptNumber
                        ? [
                            {
                              OR: [
                                {
                                  deliveryAgentReport: {
                                    is: null,
                                  },
                                },
                                {
                                  deliveryAgentReport: {
                                    report: {
                                      deleted: true,
                                    },
                                  },
                                },
                              ],
                              status: {
                                notIn: ["RETURNED"],
                              },
                            },
                            {
                              secondaryStatus: "WITH_AGENT",
                              status: {
                                in: [
                                  "RETURNED",
                                  "REPLACED",
                                  "PARTIALLY_RETURNED",
                                ],
                              },
                            },
                          ]
                        : data.loggedInUser?.role === "REPOSITORIY_EMPLOYEE" ||
                            data.loggedInUser?.role === "BRANCH_MANAGER"
                          ? [
                              {
                                branch: {
                                  id: data.loggedInUser.branchId,
                                },
                                status: {not: "WITH_RECEIVING_AGENT"},
                              },
                              {
                                client: {
                                  branchId: data.loggedInUser?.branchId,
                                },
                                status: {not: "WITH_RECEIVING_AGENT"},
                              },
                              {
                                status: "WITH_RECEIVING_AGENT",
                                deliveryAgent: {
                                  branchId: data.loggedInUser.branchId,
                                },
                              },
                            ]
                          : data.loggedInUser?.role !== "COMPANY_MANAGER" &&
                              data.loggedInUser?.role !== "CLIENT" &&
                              data.loggedInUser?.role !== "RECEIVING_AGENT" &&
                              data.loggedInUser?.role !== "CLIENT_ASSISTANT" &&
                              data.loggedInUser?.role !== "INQUIRY_EMPLOYEE" &&
                              data.loggedInUser?.role !==
                                "EMPLOYEE_CLIENT_ASSISTANT" &&
                              data.loggedInUser?.role !== "DELIVERY_AGENT"
                            ? [
                                {
                                  branch: {
                                    id: data.loggedInUser?.branchId,
                                  },
                                },
                              ]
                            : undefined,
                },
          select: data.filters.forMobile ? minifiedOrderSelect : orderSelect,
          orderBy: {
            createdAt: "desc",
          },
        },
        {
          page: data.filters.page,
          size: data.filters.size,
        },
      );

      const ordersReformed = paginatedOrders.data.map(minifiedOrderReform);

      const ordersMetaDataReformed = {
        count: paginatedOrders.dataCount,
        totalCost: 0,
        paidAmount: 0,
        clientNet: 0,
        deliveryAgentNet: 0,
        companyNet: 0,
        deliveryCost: 0,
        // countByStatus: ordersMetaDataGroupByStatusReformed,
      };

      return {
        orders: ordersReformed,
        ordersMetaData: ordersMetaDataReformed,
        pagesCount: paginatedOrders.pagesCount,
      };
    }

    const [paginatedOrders, ordersMetaDataAggregate] = await Promise.all([
      prisma.order.findManyPaginated(
        {
          where: {
            ...where,
          },
          orderBy: {
            createdAt: "desc",
          },
          select: orderSelect,
        },
        {
          page: data.filters.page,
          size: data.filters.size,
        },
      ),
      prisma.order.aggregate({
        where: where,
        _count: {
          id: true,
        },
        _sum: {
          totalCost: true,
          paidAmount: true,
          clientNet: true,
          deliveryAgentNet: true,
          companyNet: true,
          deliveryCost: true,
        },
      }),
    ]);

    const ordersReformed = paginatedOrders.data.map(orderReform);

    const ordersMetaDataReformed = {
      count: ordersMetaDataAggregate._count.id,
      totalCost: ordersMetaDataAggregate._sum.totalCost || 0,
      paidAmount: ordersMetaDataAggregate._sum.paidAmount || 0,
      clientNet: ordersMetaDataAggregate._sum.clientNet || 0,
      deliveryAgentNet: ordersMetaDataAggregate._sum.deliveryAgentNet || 0,
      companyNet: ordersMetaDataAggregate._sum.companyNet || 0,
      deliveryCost: ordersMetaDataAggregate._sum.deliveryCost || 0,
    };

    return {
      where,
      orders: ordersReformed,
      ordersMetaData: ordersMetaDataReformed,
      pagesCount: paginatedOrders.pagesCount,
    };
  }

  async getAllOrdersPaginatedApiKey(data: {
    filters: OrdersFiltersType | ReportCreateOrdersFiltersType;
    loggedInUser: loggedInUserType | undefined;
  }) {
    let startDate = new Date();
    let endDate = new Date();

    if (data.filters.startDate) {
      startDate = new Date(data.filters.startDate);
      startDate.setUTCDate(startDate.getUTCDate() - 1);
      startDate.setHours(21, 0, 0, 0);
    }
    if (data.filters.endDate) {
      endDate = new Date(data.filters.endDate);
      endDate.setHours(21, 0, 0, 0);
    }

    const where = {
      AND: [
        {
          OR: [
            {
              receiptNumber: data.filters.search
                ? data.filters.search
                : undefined,
            },
            {
              branchReportId: data.filters.search
                ? Number.isNaN(+data.filters.search)
                  ? undefined
                  : data.filters.search.length > 9
                    ? undefined
                    : +data.filters.search
                : undefined,
            },
            {
              clientReport: data.filters.search
                ? Number.isNaN(+data.filters.search)
                  ? undefined
                  : data.filters.search.length > 9
                    ? undefined
                    : {
                        some: {
                          id: +data.filters.search,
                        },
                      }
                : undefined,
            },
            {
              repositoryReport: data.filters.search
                ? Number.isNaN(+data.filters.search)
                  ? undefined
                  : data.filters.search.length > 9
                    ? undefined
                    : {
                        some: {
                          id: +data.filters.search,
                        },
                      }
                : undefined,
            },
            {
              companyReport: data.filters.search
                ? Number.isNaN(+data.filters.search)
                  ? undefined
                  : data.filters.search.length > 9
                    ? undefined
                    : {
                        some: {
                          id: +data.filters.search,
                        },
                      }
                : undefined,
            },
            {
              deliveryAgentReportId: data.filters.search
                ? Number.isNaN(+data.filters.search)
                  ? undefined
                  : data.filters.search.length > 9
                    ? undefined
                    : +data.filters.search
                : undefined,
            },
            {
              governorateReportId: data.filters.search
                ? Number.isNaN(+data.filters.search)
                  ? undefined
                  : data.filters.search.length > 9
                    ? undefined
                    : +data.filters.search
                : undefined,
            },
            {
              recipientName: {
                contains: data.filters.search,
                mode: "insensitive",
              },
            },
            {
              recipientPhones: data.filters.search
                ? {
                    has: data.filters.search,
                  }
                : undefined,
            },
            {
              recipientAddress: {
                contains: data.filters.search,
                mode: "insensitive",
              },
            },
          ],
        },
        {
          confirmed: data.filters.confirmed,
        },
        // Filter by orderID
        {
          id: data.filters.orderID,
        },
        // Filter by status
        {
          status: data.filters.statuses
            ? {in: data.filters.statuses}
            : undefined,
        },

        {
          status: data.filters.status,
        },
        // Filter by deliveryType
        {
          deliveryType: data.filters.deliveryType,
        },
        // Filter by deliveryDate
        {
          // gte deliveryDate day start time (00:00:00) and lte deliveryDate day end time (23:59:59)
          updatedAt: data.filters.deliveryDate
            ? {
                gte: new Date(
                  new Date(data.filters.deliveryDate).setHours(0, 0, 0, 0),
                ),
                lte: new Date(
                  new Date(data.filters.deliveryDate).setHours(23, 59, 59, 999),
                ),
              }
            : undefined,
        },
        // Filter by clientID
        {
          client: {
            id: data.filters.clientID,
          },
        },
        // Filter by storeID
        {
          store: {
            id: data.filters.storeID,
          },
        },
        // Filter by locationID
        {
          location: {
            id: data.filters.locationID,
          },
        },
        {
          receiptNumber: data.filters.receiptNumber,
        },
        {
          printed: data.filters.printed,
        },
        {
          receiptNumber: data.filters.receiptNumbers
            ? {in: data.filters.receiptNumbers}
            : undefined,
        },
        // Filter by recipientName
        {
          recipientName: data.filters.recipientName,
        },
        // Filter by recipientPhone
        {
          recipientPhones: data.filters.recipientPhone
            ? {
                has: data.filters.recipientPhone,
              }
            : undefined,
        },
        // Filter by recipientAddress
        {
          recipientAddress: data.filters.recipientAddress,
        },
        // Filter by notes
        {
          notes: data.filters.notes,
        },
        // Filter by startDate
        {
          createdAt: data.filters.startDate
            ? {
                gt: startDate,
              }
            : undefined,
        },
        // Filter by endDate
        {
          createdAt: data.filters.endDate
            ? {
                lt: endDate,
              }
            : undefined,
        },
        // Filter by deleted
        {
          deleted: data.filters.deleted,
        },
        // Filter by clientReport
        {
          AND: [
            data.filters.clientReport === "true"
              ? {
                  clientReport: {
                    some: {
                      secondaryType:
                        data.filters.delivered &&
                        data.filters.orderType === "forwarded"
                          ? "DELIVERED"
                          : undefined,
                      report: {
                        deleted: false,
                      },
                    },
                  },
                }
              : {},
            {
              OR:
                data.filters.clientReport === "false"
                  ? [
                      {
                        clientReport: {
                          none: {
                            secondaryType: data.filters.delivered
                              ? "DELIVERED"
                              : undefined,
                          },
                        },
                      },
                      {
                        clientReport: {
                          some: {
                            report: {
                              deleted: true,
                            },
                          },
                        },
                      },
                    ]
                  : undefined,
            },
          ],
        },

        {
          governorate: data.filters.governorate,
        },

        {
          secondaryStatus: data.filters.secondaryStatus,
        },
      ],
    } satisfies Prisma.OrderWhereInput;

    const paginatedOrders = await prisma.order.findManyPaginated(
      {
        where: {
          ...where,
        },
        orderBy: {
          createdAt: "desc",
        },
        select: orderSelectApiKey,
      },
      {
        page: data.filters.page,
        size: data.filters.size,
      },
    );

    const ordersReformed = paginatedOrders.data.map(orderReformApiKey);

    const ordersMetaDataAggregate = await prisma.order.aggregate({
      where: where,
      _count: {
        id: true,
      },
      _sum: {
        totalCost: true,
        paidAmount: true,
        clientNet: true,
        deliveryAgentNet: true,
        companyNet: true,
        deliveryCost: true,
      },
    });

    const ordersMetaDataReformed = {
      count: ordersMetaDataAggregate._count.id,
      totalCost: ordersMetaDataAggregate._sum.totalCost || 0,
      paidAmount: ordersMetaDataAggregate._sum.paidAmount || 0,
      clientNet: ordersMetaDataAggregate._sum.clientNet || 0,
    };

    return {
      orders: ordersReformed,
      ordersMetaData: ordersMetaDataReformed,
      pagesCount: paginatedOrders.pagesCount,
    };
  }

  async getOrdersByIDs(data: {ordersIDs: string[]}) {
    const orders = await prisma.order.findMany({
      where: {
        id: {
          in: data.ordersIDs,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {...orderSelect},
    });
    return orders.map(orderReform);
  }

  async getOrder(data: {orderID: string}) {
    const order = await prisma.order.findFirst({
      where: {
        receiptNumber: data.orderID,
        deleted: false,
      },
      select: orderSelect,
    });
    // const inquiryEmployees =
    //     (
    //         await prisma.employee.findMany({
    //             where: {
    //                 AND: [
    //                     { role: "INQUIRY_EMPLOYEE" },
    //                     {
    //                         OR: [
    //                             {
    //                                 inquiryBranches: order?.branch?.id
    //                                     ? {
    //                                           some: {
    //                                               branchId: order.branch.id
    //                                           }
    //                                       }
    //                                     : undefined
    //                             },
    //                             {
    //                                 inquiryStores: order?.store.id
    //                                     ? {
    //                                           some: {
    //                                               storeId: order.store.id
    //                                           }
    //                                       }
    //                                     : undefined
    //                             },
    //                             {
    //                                 inquiryCompanies: order?.company.id
    //                                     ? {
    //                                           some: {
    //                                               companyId: order.company.id
    //                                           }
    //                                       }
    //                                     : undefined
    //                             },
    //                             {
    //                                 inquiryLocations: order?.location?.id
    //                                     ? {
    //                                           some: {
    //                                               locationId: order.location.id
    //                                           }
    //                                       }
    //                                     : undefined
    //                             }
    //                         ]
    //                     }
    //                 ]
    //             },
    //             select: {
    //                 user: {
    //                     select: {
    //                         id: true,
    //                         name: true,
    //                         phone: true,
    //                         avatar: true
    //                     }
    //                 },
    //                 role: true
    //             }
    //         })
    //     ).map((inquiryEmployee) => {
    //         return {
    //             id: inquiryEmployee.user?.id ?? null,
    //             name: inquiryEmployee.user?.name ?? null,
    //             phone: inquiryEmployee.user?.phone ?? null,
    //             avatar: inquiryEmployee.user?.avatar ?? null,
    //             role: inquiryEmployee.role
    //         };
    //     }) ?? [];
    const reformedOrder = orderReform(order);
    return reformedOrder;
    // return {
    //     ...reformedOrder,
    //     inquiryEmployees: [...(reformedOrder?.inquiryEmployees || []), ...inquiryEmployees]
    // };
  }

  async getOrderById(data: {orderID: string}) {
    const order = await prisma.order.findUnique({
      where: {
        id: data.orderID,
        deleted: false,
      },
      select: orderSelect,
    });

    const reformedOrder = orderReform(order);
    return reformedOrder;
  }

  async getOrderByIdApiKey(data: {orderID: string}) {
    const order = await prisma.order.findUnique({
      where: {
        id: data.orderID,
        deleted: false,
      },
      select: orderSelectApiKey,
    });

    const reformedOrder = orderReformApiKey(order);
    return reformedOrder;
  }

  async getOrderByReceiptNumber(data: {orderReceiptNumber: string}) {
    const order = await prisma.order.findFirst({
      where: {
        receiptNumber: data.orderReceiptNumber,
        deleted: false,
      },
      orderBy: {
        id: "desc",
      },
      select: orderSelect,
    });
    return orderReform(order);
  }

  async updateOrdersCosts(data: {
    ordersIDs: string[];
    clientId?: number;
    costs: {
      baghdadDeliveryCost?: number;
      governoratesDeliveryCost?: number;
      deliveryAgentDeliveryCost?: number;
      reportType?: ReportType;
    };
  }) {
    if (data.costs.reportType === ReportType.CLIENT) {
      // Get Baghdad orders
      const baghdadOrders = await prisma.order.findMany({
        where: {
          id: {
            in: data.ordersIDs,
          },
          governorate: Governorate.BAGHDAD,
        },
        select: {
          id: true,
          paidAmount: true,
          weight: true,
          deliveryCost: true,
          company: {
            select: {
              additionalPriceForEvery500000IraqiDinar: true,
              additionalPriceForEveryKilogram: true,
              additionalPriceForRemoteAreas: true,
            },
          },
        },
      });

      // Update Baghdad orders costs
      for (const order of baghdadOrders) {
        const deliveryCost =
          data.costs.baghdadDeliveryCost || order.deliveryCost;

        const clientNet = (order.paidAmount || 0) - deliveryCost;

        await prisma.order.update({
          where: {
            id: order.id,
          },
          data: {
            deliveryCost: deliveryCost,
            clientNet: clientNet,
          },
        });
      }
    }

    if (data.costs.reportType === ReportType.CLIENT) {
      // get governorates orders
      const governoratesOrders = await prisma.order.findMany({
        where: {
          id: {
            in: data.ordersIDs,
          },
          governorate: {
            not: Governorate.BAGHDAD,
          },
        },
        select: {
          id: true,
          paidAmount: true,
          deliveryCost: true,
          weight: true,
          company: {
            select: {
              additionalPriceForEvery500000IraqiDinar: true,
              additionalPriceForEveryKilogram: true,
              additionalPriceForRemoteAreas: true,
            },
          },
        },
      });

      // Update governorates orders costs
      for (const order of governoratesOrders) {
        const deliveryCost =
          data.costs.governoratesDeliveryCost || order.deliveryCost;

        const clientNet = (order.paidAmount || 0) - deliveryCost;
        await prisma.order.update({
          where: {
            id: order.id,
          },
          data: {
            deliveryCost: deliveryCost,
            clientNet: clientNet,
          },
        });
      }
    }

    if (
      data.costs.baghdadDeliveryCost &&
      data.costs.reportType === ReportType.BRANCH
    ) {
      // Get Baghdad orders
      const baghdadOrders = await prisma.order.findMany({
        where: {
          id: {
            in: data.ordersIDs,
          },
          governorate: Governorate.BAGHDAD,
        },
        select: {
          id: true,
          paidAmount: true,
          weight: true,
        },
      });

      // Update Baghdad orders costs
      for (const order of baghdadOrders) {
        await prisma.order.update({
          where: {
            id: order.id,
          },
          data: {
            branchNet: order.paidAmount - data.costs.baghdadDeliveryCost,
          },
        });
      }
    }
    if (
      data.costs.governoratesDeliveryCost &&
      data.costs.reportType === ReportType.BRANCH
    ) {
      // get governorates orders
      const governoratesOrders = await prisma.order.findMany({
        where: {
          id: {
            in: data.ordersIDs,
          },
          governorate: {
            not: Governorate.BAGHDAD,
          },
        },
        select: {
          id: true,
          paidAmount: true,
          weight: true,
        },
      });

      // Update governorates orders costs
      for (const order of governoratesOrders) {
        await prisma.order.update({
          where: {
            id: order.id,
          },
          data: {
            branchNet: order.paidAmount - data.costs.governoratesDeliveryCost,
          },
        });
      }
    }

    if (
      !data.costs.baghdadDeliveryCost &&
      !data.costs.governoratesDeliveryCost &&
      data.costs.reportType === ReportType.BRANCH
    ) {
      // Get Baghdad orders
      const orders = await prisma.order.findMany({
        where: {
          id: {
            in: data.ordersIDs,
          },
        },
        select: {
          id: true,
          paidAmount: true,
          governorate: true,
          weight: true,
          client: {
            select: {
              governoratesDeliveryCosts: true,
            },
          },
        },
      });

      // Update Baghdad orders costs
      for (const order of orders) {
        const governoratesDeliveryCosts = order.client
          .governoratesDeliveryCosts as {
          governorate: Governorate;
          cost: number;
        }[];

        let deliveryCost: number | undefined = 0;

        if (governoratesDeliveryCosts) {
          deliveryCost =
            governoratesDeliveryCosts.find(
              (governorateDeliveryCost: {
                governorate: Governorate;
                cost: number;
              }) => {
                return (
                  governorateDeliveryCost.governorate === order.governorate
                );
              },
            )?.cost || 0;
        }

        await prisma.order.update({
          where: {
            id: order.id,
          },
          data: {
            branchNet: order.paidAmount - deliveryCost,
            branchDeliveryCost: deliveryCost,
          },
        });
      }
    }

    // Update delivery agent delivery cost
    if (data.costs.deliveryAgentDeliveryCost) {
      // get orders
      const orders = await prisma.order.findMany({
        where: {
          id: {
            in: data.ordersIDs,
          },
        },
        select: {
          id: true,
          paidAmount: true,
          weight: true,
        },
      });

      // Update orders costs
      for (const order of orders) {
        const weight = order.weight || 0;
        const deliveryAgentNet =
          data.costs.deliveryAgentDeliveryCost + weight * 250;
        const companyNet = (order.paidAmount || 0) - deliveryAgentNet;
        await prisma.order.update({
          where: {
            id: order.id,
          },
          data: {
            deliveryAgentNet: deliveryAgentNet,
            companyNet: companyNet,
          },
        });
      }
    }
  }

  async updateOrdersCosts2(data: {
    ordersIDs: string[];
    orders: ReturnType<typeof orderReform>[];
    clientId?: number;
    costs: {
      baghdadDeliveryCost?: number;
      governoratesDeliveryCost?: number;
      deliveryAgentDeliveryCost?: number;
      reportType?: ReportType;
    };
  }): Promise<UpdatedOrderCosts[]> {
    const updatedOrders: UpdatedOrderCosts[] = [];

    /* ===============================
       CLIENT REPORT
    =============================== */
    if (data.costs.reportType === ReportType.CLIENT) {
      for (const order of data.orders) {
        const deliveryCost =
          order?.governorate === Governorate.BAGHDAD
            ? (data.costs.baghdadDeliveryCost ?? order.deliveryCost)
            : (data.costs.governoratesDeliveryCost ?? order?.deliveryCost);

        const clientNet = (order?.paidAmount || 0) - deliveryCost!!;

        updatedOrders.push({
          id: order?.id!!,
          deliveryCost,
          clientNet,
        });
      }

      await prisma.$executeRaw`
  UPDATE "Order"
  SET
    "deliveryCost" =
      CASE
        WHEN "governorate" = 'BAGHDAD'
          THEN COALESCE(${data.costs.baghdadDeliveryCost}, "deliveryCost")::double precision
        ELSE COALESCE(${data.costs.governoratesDeliveryCost}, "deliveryCost")::double precision
      END,
    "clientNet" =
      "paidAmount" -
      (
        CASE
          WHEN "governorate" = 'BAGHDAD'
            THEN COALESCE(${data.costs.baghdadDeliveryCost}, "deliveryCost")::double precision
          ELSE COALESCE(${data.costs.governoratesDeliveryCost}, "deliveryCost")::double precision
        END
      )
  WHERE id = ANY(${data.ordersIDs});
`;
    }

    /* ===============================
       BRANCH REPORT
    =============================== */

    if (
      data.costs.reportType === ReportType.BRANCH &&
      (data.costs.baghdadDeliveryCost || data.costs.governoratesDeliveryCost)
    ) {
      // const orders = await prisma.order.findMany({
      //   where: {id: {in: data.ordersIDs}},
      //   select: {
      //     id: true,
      //     paidAmount: true,
      //     governorate: true,
      //   },
      // });

      // build response
      for (const order of data.orders) {
        const cost =
          order?.governorate === Governorate.BAGHDAD
            ? data.costs.baghdadDeliveryCost
            : data.costs.governoratesDeliveryCost;

        if (!cost) continue;

        updatedOrders.push({
          id: order?.id!!,
          branchNet: order?.paidAmount!! - cost,
        });
      }

      // single DB update
      await prisma.$executeRaw`
    UPDATE "Order"
    SET
      "branchNet" =
        "paidAmount" -
        CASE
          WHEN "governorate" = 'BAGHDAD'
            THEN ${data.costs.baghdadDeliveryCost}
          ELSE ${data.costs.governoratesDeliveryCost}
        END
    WHERE id = ANY(${data.ordersIDs});
  `;
    }

    if (data.costs.reportType === ReportType.BRANCH) {
      if (
        !data.costs.baghdadDeliveryCost &&
        !data.costs.governoratesDeliveryCost
      ) {
        // const orders = await prisma.order.findMany({
        //   where: {id: {in: data.ordersIDs}},
        //   select: {
        //     id: true,
        //     paidAmount: true,
        //     governorate: true,
        //     client: {
        //       select: {
        //         governoratesDeliveryCosts: true,
        //       },
        //     },
        //   },
        // });

        await prisma.$executeRaw`
  UPDATE "Order"
  SET
    "branchNet" = "paidAmount" - "deliveryCost"
  WHERE id = ANY(${data.ordersIDs});
`;
      }
    }

    /* ===============================
       DELIVERY AGENT REPORT
    =============================== */
    if (data.costs.deliveryAgentDeliveryCost) {
      const orders = await prisma.order.findMany({
        where: {id: {in: data.ordersIDs}},
        select: {
          id: true,
          paidAmount: true,
          weight: true,
        },
      });

      // build response
      for (const order of orders) {
        const deliveryAgentNet =
          data.costs.deliveryAgentDeliveryCost + (order.weight || 0) * 250;

        const companyNet = (order.paidAmount || 0) - deliveryAgentNet;

        updatedOrders.push({
          id: order.id,
          deliveryAgentNet,
          companyNet,
        });
      }

      // single DB update
      await prisma.$executeRaw`
    UPDATE "Order"
    SET
      "deliveryAgentNet" =
        ${data.costs.deliveryAgentDeliveryCost}
        + COALESCE("weight", 0) * 250,
      "companyNet" =
        "paidAmount" -
        (${data.costs.deliveryAgentDeliveryCost}
         + COALESCE("weight", 0) * 250)
    WHERE id = ANY(${data.ordersIDs});
  `;
    }

    return updatedOrders;
  }

  async updateOrder(
    data: {
      orderID: string;
      orderData: OrderUpdateType;
      loggedInUser: loggedInUserType;
    },
    orderData: any,
  ) {
    // Calculate order costs
    let deliveryAgentCost = orderData?.deliveryAgentNet;
    let companyNet = orderData?.companyNet;
    let clientNet = orderData?.clientNet;
    let newDeliveryCost = orderData?.deliveryCost
      ? orderData?.deliveryCost
      : orderData?.oldDeliveryCost;
    let oldDeliveryCost = orderData?.deliveryCost
      ? orderData?.deliveryCost
      : orderData?.oldDeliveryCost;
    let weight = (data.orderData.weight as number) || orderData?.weight || 0;

    if (
      data.orderData.governorate ||
      data.orderData.status === "DELIVERED" ||
      data.orderData.status === "REPLACED" ||
      data.orderData.status === "PARTIALLY_RETURNED"
    ) {
      newDeliveryCost = await this.getDeliverCost(
        orderData?.client.id!!,
        data.orderData.governorate || orderData.governorate,
      );
    }
    // if (weight) {
    //   const companyAdditionalPrices = await prisma.company.findUnique({
    //     where: {
    //       id: orderData?.company?.id,
    //     },
    //     select: {
    //       additionalPriceForEveryKilogram: true,
    //     },
    //   });

    //   const oldWeight = orderData?.weight as number;

    //   if (weight > oldWeight) {
    //     newDeliveryCost = (orderData?.deliveryCost || 0) as number;
    //     newDeliveryCost +=
    //       companyAdditionalPrices?.additionalPriceForEveryKilogram
    //         ? (weight - oldWeight) *
    //           companyAdditionalPrices.additionalPriceForEveryKilogram
    //         : 0;
    //   } else if (weight < oldWeight) {
    //     newDeliveryCost = (orderData?.deliveryCost || 0) as number;
    //     newDeliveryCost -=
    //       companyAdditionalPrices?.additionalPriceForEveryKilogram
    //         ? (oldWeight - weight) *
    //           companyAdditionalPrices.additionalPriceForEveryKilogram
    //         : 0;
    //   }
    // }
    if (data.orderData.paidAmount) {
      // calculate client net
      const deliveryCost = newDeliveryCost
        ? newDeliveryCost
        : ((orderData?.deliveryCost || 0) as number);
      clientNet = data.orderData.paidAmount - deliveryCost;
    } else {
      const deliveryCost = newDeliveryCost
        ? newDeliveryCost
        : ((orderData?.deliveryCost || 0) as number);
      clientNet = orderData
        ? +orderData?.paidAmount - deliveryCost
        : -deliveryCost;
    }

    if (data.orderData.status === "RETURNED") {
      newDeliveryCost = 0;
      clientNet = 0;
    }

    const order = await prisma.order.update({
      where: {
        id: data.orderID,
      },
      data: {
        quantity: data.orderData.quantity,
        totalCost: data.orderData.totalCost,
        paidAmount: data.orderData.paidAmount,
        receiptNumber: data.orderData.receiptNumber,
        processingStatus: data.orderData.processingStatus,
        governorate: data.orderData.governorate
          ? data.orderData.governorate
          : undefined,
        location: data.orderData.locationID
          ? {
              connect: {
                id: data.orderData.locationID,
              },
            }
          : undefined,
        clientNet: clientNet,
        deliveryCost: newDeliveryCost,
        oldDeliveryCost: oldDeliveryCost,
        deliveryAgentNet: deliveryAgentCost,
        weight: weight,
        companyNet: companyNet,
        discount: data.orderData.discount,
        recipientName: data.orderData.recipientName,
        recipientPhones: data.orderData.recipientPhones
          ? data.orderData.recipientPhones
          : data.orderData.recipientPhone
            ? [data.orderData.recipientPhone]
            : undefined,
        recipientAddress: data.orderData.recipientAddress,
        notes: data.orderData.notes,
        currentLocation: data.orderData.currentLocation,
        status: data.orderData.status,
        secondaryStatus:
          data.orderData.status === "DELIVERED"
            ? null
            : data.orderData.secondaryStatus,
        confirmed: data.orderData.forwardedCompanyID
          ? false
          : data.orderData.confirmed,
        details: data.orderData.details,
        receivedAt:
          data.orderData.confirmed && !orderData?.receivedAt
            ? new Date()
            : undefined,
        deliveryDate: data.orderData.deliveryAgentID
          ? new Date()
          : data.orderData.deliveryDate,
        forwardedToMainRepo:
          data.orderData.status === "IN_MAIN_REPOSITORY"
            ? false
            : data.orderData.forwardedToMainRepo,
        forwardedToGov: data.orderData.forwardedToGov,
        forwardedBranchId:
          data.orderData.forwardedBranchId === -1
            ? null
            : data.orderData.forwardedBranchId,
        receivedBranchId:
          data.orderData.receivedBranchId === -1
            ? null
            : data.orderData.receivedBranchId,
        forwardedRepo:
          data.orderData.secondaryStatus === "IN_REPOSITORY"
            ? null
            : data.orderData.forwardedRepo,
        company: {
          connect: {
            id: data.orderData.forwardedCompanyID
              ? data.orderData.forwardedCompanyID
              : (data.loggedInUser.companyID as number),
          },
        },
        forwarded: data.orderData.forwardedCompanyID ? true : undefined,
        forwardedBy: data.orderData.forwardedCompanyID
          ? {
              connect: {
                id: data.loggedInUser.id,
              },
            }
          : undefined,
        forwardedAt: data.orderData.forwardedCompanyID ? new Date() : undefined,
        forwardedFrom: data.orderData.forwardedCompanyID
          ? {
              connect: {
                id: data.loggedInUser.companyID as number,
              },
            }
          : undefined,
        processed: data.orderData.processed,
        processedAt: data.orderData.processed ? new Date() : undefined,
        processedBy: data.orderData.processed
          ? {connect: {id: data.loggedInUser.id}}
          : undefined,
        deliveryAgent:
          // unlink delivery agent if null
          data.orderData.deliveryAgentID === null
            ? {
                disconnect: true,
              }
            : data.orderData.deliveryAgentID !== undefined
              ? {
                  connect: {
                    id: data.orderData.deliveryAgentID,
                  },
                }
              : undefined,

        repository: data.orderData.repositoryID
          ? {
              connect: {
                id: data.orderData.repositoryID,
              },
            }
          : undefined,
        branch: data.orderData.branchID
          ? {
              connect: {
                id: data.orderData.branchID,
              },
            }
          : undefined,
        client: data.orderData.clientID
          ? {
              connect: {
                id: data.orderData.clientID,
              },
            }
          : undefined,
        store: data.orderData.storeID
          ? {
              connect: {
                id: data.orderData.storeID,
              },
            }
          : undefined,
        ordersInquiryEmployees: data.orderData.inquiryEmployeesIDs
          ? {
              deleteMany: {
                orderId: data.orderID,
              },
              create: data.orderData.inquiryEmployeesIDs?.map((id) => {
                return {
                  inquiryEmployee: {
                    connect: {
                      id: id,
                    },
                  },
                };
              }),
            }
          : undefined,
      },
      select: orderSelect,
    });

    let chatMembers = await messageController.getOrderChatMembers(order.id);

    // const initialMessages=await this.getChatMessages(orderId,userId)

    chatMembers.forEach((member) => {
      io.to(`${member}`).emit("newUpdate", {id: order.id});
    });

    const RECEIVING_AGENT = await prisma.employee.findMany({
      where: {
        role: "RECEIVING_AGENT",
        inquiryClients: {
          some: {
            clientId: order.client.user.id,
          },
        },
      },
      select: {
        id: true,
      },
    });

    RECEIVING_AGENT.map((e) => {
      io.to(`${e.id}`).emit("newUpdate", {id: order.id});
    });

    return orderReform(order);
  }

  async deleteOrder(data: {orderID: string}) {
    const deletedOrder = await prisma.order.delete({
      where: {
        id: data.orderID,
      },
    });
    return deletedOrder;
  }

  async deactivateOrder(data: {orderID: string; deletedByID: number}) {
    const deletedOrder = await prisma.order.update({
      where: {
        id: data.orderID,
      },
      data: {
        deleted: true,
        deletedAt: new Date(),
        deletedBy: {
          connect: {
            id: data.deletedByID,
          },
        },
      },
    });
    return deletedOrder;
  }

  async reactivateOrder(data: {orderID: string}) {
    const deletedOrder = await prisma.order.update({
      where: {
        id: data.orderID,
      },
      data: {
        deleted: false,
      },
    });
    return deletedOrder;
  }

  async getOrdersStatistics(data: {
    filters: OrdersStatisticsFiltersType;
    loggedInUser: loggedInUserType;
  }) {
    const cacheKey = `orders:stats:u:${data.loggedInUser.id}:r:${data.loggedInUser.role}:f:${this.hashFilters(data.filters)}`;

    const cached = await redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached) as {
        ordersStatisticsByStatus: {
          status:
            | "REGISTERED"
            | "READY_TO_SEND"
            | "WITH_DELIVERY_AGENT"
            | "DELIVERED"
            | "REPLACED"
            | "PARTIALLY_RETURNED"
            | "RETURNED"
            | "POSTPONED"
            | "CHANGE_ADDRESS"
            | "RESEND"
            | "WITH_RECEIVING_AGENT"
            | "PROCESSING"
            | "IN_MAIN_REPOSITORY"
            | "IN_GOV_REPOSITORY";
          totalCost: number;
          count: number;
          name: string;
          icon: string;
          inside: boolean;
        }[];
        ordersStatisticsByGovernorate: {
          governorate:
            | "AL_ANBAR"
            | "BABIL"
            | "BABIL_COMPANIES"
            | "BAGHDAD"
            | "BASRA"
            | "DHI_QAR"
            | "AL_QADISIYYAH"
            | "DIYALA"
            | "DUHOK"
            | "ERBIL"
            | "KARBALA"
            | "KIRKUK"
            | "MAYSAN"
            | "MUTHANNA"
            | "NAJAF"
            | "NINAWA"
            | "SALAH_AL_DIN"
            | "SULAYMANIYAH"
            | "WASIT";
          totalCost: number;
          count: number;
        }[];
        allOrdersStatistics: {
          totalCost: number;
          count: number;
        };
        allOrdersStatisticsWithoutClientReport: {
          totalCost: number;
          deliveryCost: number;
          count: number;
        };
        allOrdersStatisticsWithoutDeliveryReport: {
          totalCost: number;
          deliveryCost: number;
          count: number;
        };
        allOrdersStatisticsWithoutBranchReport: {
          totalCost: number;
          count: number;
        };
        allOrdersStatisticsWithoutCompanyReport: {
          totalCost: number;
          count: number;
        };
        todayOrdersStatistics: {
          totalCost: number;
          count: number;
        };
      };
    }

    const filtersReformed =
      data.loggedInUser.role === "INQUIRY_EMPLOYEE"
        ? {
            AND: [
              {
                status: data.filters.inquiryStatuses
                  ? {
                      in: data.filters.inquiryStatuses,
                    }
                  : undefined,
              },
              {
                deleted: false,
              },
              {
                governorate: data.filters.inquiryGovernorates
                  ? {
                      in: data.filters.inquiryGovernorates,
                    }
                  : undefined,
              },
              {
                branch: data.filters.orderType
                  ? undefined
                  : data.filters.inquiryBranchesIDs
                    ? {
                        id: {
                          in: data.filters.inquiryBranchesIDs,
                        },
                      }
                    : data.loggedInUser.mainRepository
                      ? undefined
                      : {
                          id: data.loggedInUser.branchId,
                        },
              },
              {
                deliveryAgent: data.filters.inquiryDeliveryAgentsIDs
                  ? {
                      id: {
                        in: data.filters.inquiryDeliveryAgentsIDs,
                      },
                    }
                  : undefined,
              },
              {
                store: data.filters.inquiryStoresIDs
                  ? {
                      id: {
                        in: data.filters.inquiryStoresIDs,
                      },
                    }
                  : undefined,
              },
              {
                company: {
                  id: data.filters.companyID,
                },
              },
              {
                location: data.filters.inquiryLocationsIDs
                  ? {
                      id: {
                        in: data.filters.inquiryLocationsIDs,
                      },
                    }
                  : undefined,
              },
              {
                OR: [
                  {
                    branchId: data.filters.inquiryBranchesIDs
                      ? {in: data.filters.inquiryBranchesIDs}
                      : undefined,
                  },
                  {
                    forwardedBranchId:
                      data.filters.orderType === "forwarded" &&
                      data.filters.inquiryBranchesIDs
                        ? {in: data.filters.inquiryBranchesIDs}
                        : data.filters.orderType === "forwarded"
                          ? {not: null}
                          : undefined,
                  },
                  {
                    receivedBranchId:
                      data.filters.orderType === "receiving" &&
                      data.filters.inquiryBranchesIDs
                        ? {in: data.filters.inquiryBranchesIDs}
                        : data.filters.orderType === "receiving"
                          ? {not: null}
                          : undefined,
                  },
                ],
              },
            ],
          }
        : ({
            AND: [
              {
                OR: [
                  {
                    company: {
                      id: data.filters.companyID,
                    },
                  },
                  {
                    forwardedFrom: {
                      id: data.filters.inquiryCompaniesIDs
                        ? {
                            in: [
                              ...data.filters.inquiryCompaniesIDs,
                              //   data.filters.companyID as number
                            ],
                          }
                        : data.filters.companyID,
                    },
                  },
                ],
              },
              {
                branch: data.filters.inquiryBranchesIDs
                  ? {
                      id: {
                        in: data.filters.inquiryBranchesIDs,
                      },
                    }
                  : undefined,
              },
              {
                storeId:
                  data.loggedInUser.role === "CLIENT_ASSISTANT" ||
                  data.loggedInUser.role === "EMPLOYEE_CLIENT_ASSISTANT"
                    ? {in: data.filters.inquiryStoresIDs}
                    : data.filters.storeID,
              },
              {
                governorateReport: data.filters.governorateReport
                  ? {isNot: null}
                  : data.filters.governorateReport
                    ? {is: null}
                    : undefined,
              },
              {
                deliveryAgentReport: data.filters.deliveryAgentReport
                  ? {isNot: null}
                  : data.filters.deliveryAgentReport
                    ? {is: null}
                    : undefined,
              },
              {
                governorate: data.filters.governorate,
              },
              {
                createdAt: {
                  gte: data.filters.startDate,
                },
              },
              {
                createdAt: {
                  lte: data.filters.endDate,
                },
              },
              {
                client: {
                  id: data.filters.inquiryClientsIDs
                    ? {
                        in: [
                          ...data.filters.inquiryClientsIDs,
                          //   data.filters.companyID as number
                        ],
                      }
                    : data.filters.clientID,
                },
              },
              {
                deliveryType: data.filters.deliveryType,
              },
              {
                location: {
                  id: data.filters.locationID,
                },
              },
              {
                deliveryAgent: {
                  id: data.filters.deliveryAgentID,
                },
              },
              {
                deleted: false,
              },
              {
                forwardedBranchId:
                  data.filters.orderType === "forwardedAll" &&
                  (data.loggedInUser?.role === "COMPANY_MANAGER" ||
                    data.loggedInUser?.mainRepository) &&
                  data.filters.branchID
                    ? data.filters.branchID
                    : data.filters.orderType === "forwardedAll" &&
                        (data.loggedInUser?.role === "COMPANY_MANAGER" ||
                          data.loggedInUser?.mainRepository)
                      ? {
                          not: null,
                        }
                      : data.filters.orderType === "forwardedAll"
                        ? data.loggedInUser?.branchId
                        : data.filters.orderType === "receivedAll" &&
                            data.filters.branchID &&
                            data.loggedInUser?.role !== "COMPANY_MANAGER" &&
                            !data.loggedInUser?.mainCompany
                          ? data.filters.branchID
                          : undefined,
              },
              {
                receivedBranchId:
                  data.filters.orderType === "receivedAll" &&
                  (data.loggedInUser?.role === "COMPANY_MANAGER" ||
                    data.loggedInUser?.mainRepository) &&
                  data.filters.branchID
                    ? data.filters.branchID
                    : data.filters.orderType === "receivedAll" &&
                        (data.loggedInUser?.role === "COMPANY_MANAGER" ||
                          data.loggedInUser?.mainRepository)
                      ? {
                          not: null,
                        }
                      : data.filters.orderType === "forwardedAll" &&
                          data.filters.branchID &&
                          data.loggedInUser?.role !== "COMPANY_MANAGER" &&
                          !data.loggedInUser?.mainCompany
                        ? data.filters.branchID
                        : data.filters.orderType === "receivedAll"
                          ? data.loggedInUser?.branchId
                          : undefined,
              },
            ],
          } satisfies Prisma.OrderWhereInput);

    const [
      ordersStatisticsByStatus,
      ordersStatisticsByGovernorate,
      allOrdersStatisticsWithoutClientReport,
      allOrdersStatisticsWithoutDeliveryReport,
      todayOrdersStatistics,
    ] = await Promise.all([
      prisma.order.groupBy({
        by: ["status"],
        _sum: {
          totalCost: true,
        },
        _count: {
          id: true,
        },
        where: {
          ...filtersReformed,
          OR:
            data.loggedInUser.role === "CLIENT" ||
            data.loggedInUser.role === "INQUIRY_EMPLOYEE" ||
            data.loggedInUser.role === "EMPLOYEE_CLIENT_ASSISTANT" ||
            data.loggedInUser.role === "CLIENT_ASSISTANT"
              ? [
                  {
                    clientReport: {
                      none: {
                        secondaryType: "DELIVERED",
                        report: {
                          deleted: false,
                        },
                      },
                    },
                    status: {
                      not: "RETURNED",
                    },
                  },
                  {
                    clientReport: {
                      none: {
                        secondaryType: "RETURNED",
                        report: {
                          deleted: false,
                        },
                      },
                    },
                    status: {
                      in: ["RETURNED", "REPLACED", "PARTIALLY_RETURNED"],
                    },
                  },
                ]
              : data.loggedInUser.role === "DELIVERY_AGENT"
                ? [
                    {
                      OR: [
                        {
                          deliveryAgentReport: {
                            is: null,
                          },
                        },
                        {
                          deliveryAgentReport: {
                            report: {
                              deleted: true,
                            },
                          },
                        },
                      ],

                      status: {
                        notIn: ["RETURNED"],
                      },
                    },
                    {
                      secondaryStatus: "WITH_AGENT",
                      status: {
                        in: ["RETURNED", "REPLACED", "PARTIALLY_RETURNED"],
                      },
                    },
                  ]
                : data.loggedInUser.role === "REPOSITORIY_EMPLOYEE" ||
                    data.loggedInUser.role === "BRANCH_MANAGER"
                  ? [
                      {
                        branch: {
                          id: data.loggedInUser.branchId,
                        },
                        status: {not: "WITH_RECEIVING_AGENT"},
                      },
                      {
                        client: {
                          branchId: data.loggedInUser?.branchId,
                        },
                        status: {not: "WITH_RECEIVING_AGENT"},
                      },
                      {
                        status: "WITH_RECEIVING_AGENT",
                        deliveryAgent: {
                          branchId: data.loggedInUser.branchId,
                        },
                      },
                    ]
                  : data.loggedInUser?.role !== "COMPANY_MANAGER" &&
                      data.loggedInUser?.role !== "RECEIVING_AGENT"
                    ? [
                        {
                          branch: {
                            id: data.loggedInUser?.branchId,
                          },
                        },
                      ]
                    : undefined,
        },
      }),
      prisma.order.groupBy({
        by: ["governorate"],
        _sum: {
          totalCost: true,
        },
        _count: {
          id: true,
        },
        where: {
          ...filtersReformed,
        },
      }),
      prisma.order.aggregate({
        _sum: {
          paidAmount: true,
          deliveryCost: true,
        },
        _count: {
          id: true,
        },
        where: {
          ...filtersReformed,
          OR: [
            {
              clientReport: {
                none: {
                  secondaryType: "DELIVERED",
                  report: {
                    deleted: false,
                  },
                },
              },
              status: {
                in: ["DELIVERED", "REPLACED", "PARTIALLY_RETURNED"],
              },
            },
          ],
          status: {
            in: ["DELIVERED", "PARTIALLY_RETURNED", "REPLACED"],
          },
        },
      }),
      prisma.order.aggregate({
        _sum: {
          paidAmount: true,
          deliveryAgentNet: true,
        },
        _count: {
          id: true,
        },
        where: {
          ...filtersReformed,
          OR: [
            {deliveryAgentReport: {is: null}},
            {deliveryAgentReport: {report: {deleted: true}}},
          ],
          status: {
            in: ["DELIVERED", "PARTIALLY_RETURNED", "REPLACED"],
          },
        },
      }),
      prisma.order.aggregate({
        _sum: {totalCost: true},
        _count: {id: true},
        where: {
          ...filtersReformed,
          deleted: false,
          deliveryDate:
            data.loggedInUser.role === "DELIVERY_AGENT"
              ? {gte: new Date(Date.now() - 22 * 60 * 60 * 1000)}
              : undefined,
          receivedAt:
            data.loggedInUser.role !== "DELIVERY_AGENT"
              ? {gte: new Date(Date.now() - 22 * 60 * 60 * 1000)}
              : undefined,
        },
      }),
    ]);

    const result = statisticsReformed({
      ordersStatisticsByStatus,
      ordersStatisticsByGovernorate,
      todayOrdersStatistics,
      allOrdersStatisticsWithoutDeliveryReport,
      allOrdersStatisticsWithoutClientReport,
    });

    await redis.set(cacheKey, JSON.stringify(result), "EX", 120);

    return {
      ...result,
      todayOrdersStatistics:
        !data.filters.orderType && data.loggedInUser.role === "BRANCH_MANAGER"
          ? {
              totalCost: 0,
              count: 0,
            }
          : result.todayOrdersStatistics,
    };
  }

  async getOrderTimeline(data: {
    params: {orderID: string | undefined};
    filters: OrderTimelineFiltersType;
  }) {
    const orderTimeline = await prisma.orderTimeline.findMany({
      where: {
        order: {
          id: data.params.orderID,
        },
        type: data.filters.types ? {in: data.filters.types} : data.filters.type,
      },
      select: orderTimelineSelect,
      orderBy: {
        createdAt: "asc",
      },
    });
    return orderTimeline.map(orderTimelineReform);
  }

  async getOrderTimelineApiKey(data: {params: {orderID: string | undefined}}) {
    const orderTimeline = await prisma.orderTimeline.findMany({
      where: {
        order: {
          id: data.params.orderID,
        },
      },
      select: orderTimelineSelect,
      orderBy: {
        createdAt: "asc",
      },
    });

    return orderTimeline.map(orderTimelineReform);
  }

  async updateOrderTimeline(data: {
    orderID: string;
    data: OrderTimelinePieceType;
  }) {
    await prisma.orderTimeline.create({
      data: {
        order: {
          connect: {
            id: data.orderID,
          },
        },
        type: data.data.type,
        by: data.data.by,
        old: JSON.stringify(data.data.old),
        new: JSON.stringify(data.data.new),
        message: data.data.message,
        createdAt: data.data.date,
      },
    });
  }

  async getOrderChatMembers(data: {orderID: string}) {
    const order = await prisma.order.findUnique({
      where: {
        id: data.orderID,
      },
      select: {
        id: true,
        status: true,
        governorate: true,
        branchId: true,
        storeId: true,
        companyId: true,
        locationId: true,
        client: {
          select: {
            role: true,
            user: {
              select: {
                id: true,
                name: true,
                phone: true,
                avatar: true,
              },
            },
          },
        },
        deliveryAgent: {
          select: {
            role: true,
            user: {
              select: {
                id: true,
                name: true,
                phone: true,
                avatar: true,
              },
            },
          },
        },
        ordersInquiryEmployees: {
          select: {
            inquiryEmployee: {
              select: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    phone: true,
                    avatar: true,
                  },
                },
                role: true,
              },
            },
          },
        },
      },
    });

    const inquiryEmployees = await this.getOrderInquiryEmployees({
      orderID: order?.id,
    });

    // array of chat members with no nulls

    if (!order) {
      throw new AppError("الطلب غير موجود", 404);
    }

    const chatMembers = [
      order?.client && {
        id: order?.client?.user?.id,
        name: order?.client?.user?.name,
        phone: order?.client?.user?.phone,
        avatar: order?.client?.user?.avatar,
        role: order?.client?.role,
      },
      order?.deliveryAgent && {
        id: order?.deliveryAgent?.user?.id,
        name: order?.deliveryAgent?.user?.name,
        phone: order?.deliveryAgent?.user?.phone,
        avatar: order?.deliveryAgent?.user?.avatar,
        role: order?.deliveryAgent?.role,
      },
      ...(order?.ordersInquiryEmployees?.map((orderInquiryEmployee) => {
        return {
          id: orderInquiryEmployee.inquiryEmployee.user?.id ?? null,
          name: orderInquiryEmployee.inquiryEmployee.user?.name ?? null,
          phone: orderInquiryEmployee.inquiryEmployee?.user?.phone ?? null,
          avatar: orderInquiryEmployee.inquiryEmployee.user?.avatar ?? null,
          role: orderInquiryEmployee.inquiryEmployee.role,
        };
      }) ?? []),
      ...(inquiryEmployees ?? []),
    ].filter((chatMember) => {
      return chatMember !== null;
    });

    return chatMembers;
  }

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
            {deleted: false},
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
                        in: [order.client.branchId!!],
                      },
                    },
                  },
                },
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
                {
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
                },
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
            {
              mainEmergency: false,
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
      // return {
      //   id: inquiryEmployee.user?.id ?? null,
      //   name: inquiryEmployee.user?.name ?? null,
      //   phone: inquiryEmployee.user?.phone ?? null,
      //   avatar: inquiryEmployee.user?.avatar ?? null,
      //   role: inquiryEmployee.role,
      // };
    }) ?? [];

    return orderInquiryEmployees;
  }

  async getOrderInquiryEmployeesForNotifications(data: {
    orderID: string | undefined;
  }) {
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
            {deleted: false},
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
                        in: [order.client.branchId!!],
                      },
                    },
                  },
                },
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
                {
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
                },
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
      // return {
      //   id: inquiryEmployee.user?.id ?? null,
      //   name: inquiryEmployee.user?.name ?? null,
      //   phone: inquiryEmployee.user?.phone ?? null,
      //   avatar: inquiryEmployee.user?.avatar ?? null,
      //   role: inquiryEmployee.role,
      // };
    }) ?? [];

    return orderInquiryEmployees;
  }

  async getOrderStatus(data: {orderID: string}) {
    const order = await prisma.order.findUnique({
      where: {
        id: data.orderID,
      },
      select: {
        status: true,
      },
    });
    return order;
  }

  async updateOrdersSecondaryStatus(data: {
    ordersIDs: string[];
    secondaryStatus: SecondaryStatus;
  }) {
    const updatedOrders = await prisma.order.updateMany({
      where: {
        id: {
          in: data.ordersIDs,
        },
      },
      data: {
        secondaryStatus: data.secondaryStatus,
      },
    });
    return updatedOrders;
  }

  async removeOrderFromRepositoryReport(data: {
    orderID: string;
    repositoryReportID: number;
    orderData: {
      totalCost: number;
      paidAmount: number;
      deliveryCost: number;
      clientNet: number;
      deliveryAgentNet: number;
      companyNet: number;
      governorate: Governorate;
    };
  }) {
    await prisma.$transaction([
      prisma.order.update({
        where: {
          id: data.orderID,
        },
        data: {
          repositoryReport: data.repositoryReportID
            ? {
                disconnect: {
                  id: data.repositoryReportID,
                },
              }
            : undefined,
        },
      }),
      prisma.report.update({
        where: {
          id: data.repositoryReportID,
        },
        data: {
          baghdadOrdersCount: {
            decrement:
              data.orderData.governorate === Governorate.BAGHDAD ? 1 : 0,
          },
          governoratesOrdersCount: {
            decrement:
              data.orderData.governorate !== Governorate.BAGHDAD ? 1 : 0,
          },
          totalCost: {
            decrement: data.orderData.totalCost,
          },
          paidAmount: {
            decrement: data.orderData.paidAmount,
          },
          deliveryCost: {
            decrement: data.orderData.deliveryCost,
          },
          clientNet: {
            decrement: data.orderData.clientNet,
          },
          deliveryAgentNet: {
            decrement: data.orderData.deliveryAgentNet,
          },
          companyNet: {
            decrement: data.orderData.companyNet,
          },
        },
      }),
    ]);
  }
}
