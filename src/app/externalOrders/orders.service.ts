import {loggedInUserType} from "../../types/user";
import {OrderCreateType, ShipmentType} from "./orders.dto";
import {OrdersRepository} from "./orders.repository";
import {BranchesRepository} from "../branches/branches.repository";
import {prisma} from "../../database/db";
import {AppError} from "../../lib/AppError";
import {Governorate} from "@prisma/client";
import {OrdersFiltersType} from "../orders/orders.dto";
import {fromExternalCode} from "../../lib/governerates";

const ordersRepository = new OrdersRepository();
const branchesRepository = new BranchesRepository();

export class OrdersService {
  normalizeArabic(text: string): string {
    return text
      .normalize("NFKD") // decompose
      .replace(/[\u064B-\u065F\u0670]/g, "") // remove diacritics (tashkeel)
      .replace(/[\u0622\u0623\u0625\u0671]/g, "\u0627") // آأإٱ -> ا
      .replace(/\u0629/g, "\u0647") // ة -> ه
      .replace(/\u0649/g, "\u064A") // ى -> ي
      .replace(/\u0624/g, "\u0648") // ؤ -> و
      .replace(/\u0626/g, "\u064A") // ئ -> ي
      .replace(/\u0640/g, "") // remove tatweel ـ
      .replace(/\s+/g, " ") // collapse whitespace
      .trim();
  }
  createOrder = async (data: {
    loggedInUser: loggedInUserType;
    orderOrOrdersData: OrderCreateType | OrderCreateType[];
  }) => {
    if (Array.isArray(data.orderOrOrdersData)) {
      const createdOrders = [];
      const company = await prisma.company.findUnique({
        where: {
          id: data.loggedInUser.id,
        },
        select: {
          id: true,
          targetCompanyId: true,
          governoratesDeliveryCosts: true,
        },
      });

      for (const order of data.orderOrOrdersData) {
        let clientId: number = 0;
        let deliveryCost: number = 0;
        let storeId: number = 0;

        const checkClient = await prisma.client.findFirst({
          where: {
            companyId: data.loggedInUser.id,
            user: {
              name: order.clientName,
              phone: order.clientPhone,
            },
          },
        });

        if (!checkClient) {
          const createdUser = await prisma.user.create({
            data: {
              name: order.clientName,
              username: order.clientPhone,
              password: "00000000000",
              phone: order.clientPhone,
              fcm: "",
              avatar: "",
            },
            select: {
              id: true,
            },
          });

          const client = await prisma.client.create({
            data: {
              user: {
                connect: {
                  id: createdUser.id,
                },
              },
              company: {
                connect: {
                  id: data.loggedInUser.id,
                },
              },
              role: "CLIENT",
              token: "",
              showNumbers: false,
              showDeliveryNumber: false,
              isExternal: true,
              governoratesDeliveryCosts: [],
            },
          });
          clientId = client.id;
        } else {
          clientId = checkClient.id;
        }

        const checkStore = await prisma.store.findFirst({
          where: {
            name: order.storeName,
            clientId: clientId,
          },
        });

        if (!checkStore) {
          const createStore = await prisma.store.create({
            data: {
              name: order.storeName,
              clientId: clientId,
              companyId: data.loggedInUser.id,
            },
          });
          storeId = createStore.id;
        } else {
          storeId = checkStore.id;
        }

        let branchID = undefined;

        const branch = await branchesRepository.getBranchByLocation({
          locationID: order.locationID,
        });

        if (!branch) {
          throw new AppError("لا يوجد فرع مرتبط بالموقع", 500);
        }

        branchID = branch.id;

        const governoratesDeliveryCosts =
          company?.governoratesDeliveryCosts as {
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
                  governorateDeliveryCost.governorate === order.governorate
                );
              },
            )?.cost || 0;
        }

        const createdOrder = await ordersRepository.createOrder({
          clientID: clientId,
          branchID: branchID,
          deliveryCost,
          storeID: storeId,
          loggedInUser: data.loggedInUser,
          orderData: {...order},
        });

        if (!createdOrder) {
          throw new AppError("Failed to create order", 500);
        }
        createdOrders.push(createdOrder);
      }
      return createdOrders;
    }

    return {};
  };

  createOrderV2 = async (data: {
    loggedInUser: loggedInUserType;
    orderOrOrdersData: ShipmentType[];
  }) => {
    const acceptedShipments: any[] = [];
    const rejectedShipments: any[] = [];

    const company = await prisma.company.findUnique({
      where: {
        id: data.loggedInUser.id,
      },
      select: {
        id: true,
        targetCompanyId: true,
        governoratesDeliveryCosts: true,
      },
    });

    for (const order of data.orderOrOrdersData) {
      try {
        let clientId: number = 0;
        let deliveryCost: number = 0;
        let storeId: number = 0;

        const checkClient = await prisma.client.findFirst({
          where: {
            companyId: data.loggedInUser.id,
            user: {
              name: order.sender_name || "",
              phone: order.sender_phone,
            },
          },
        });

        if (!checkClient) {
          const createdUser = await prisma.user.create({
            data: {
              name: order.sender_name || "",
              username: order.sender_phone,
              password: "00000000000",
              phone: order.sender_phone,
              fcm: "",
              avatar: "",
            },
            select: {
              id: true,
            },
          });
          const client = await prisma.client.create({
            data: {
              user: {
                connect: {
                  id: createdUser.id,
                },
              },
              company: {
                connect: {
                  id: data.loggedInUser.id,
                },
              },
              role: "CLIENT",
              token: "",
              showNumbers: false,
              showDeliveryNumber: false,
              isExternal: true,
              governoratesDeliveryCosts: [],
            },
          });
          clientId = client.id;
        } else {
          clientId = checkClient.id;
        }

        const checkStore = await prisma.store.findFirst({
          where: {
            name: order.sender_name || "",
            clientId: clientId,
          },
        });
        if (!checkStore) {
          const createStore = await prisma.store.create({
            data: {
              name: order.sender_name || "",
              clientId: clientId,
              companyId: data.loggedInUser.id,
            },
          });
          storeId = createStore.id;
        } else {
          storeId = checkStore.id;
        }

        const governoratesDeliveryCosts =
          company?.governoratesDeliveryCosts as {
            governorate: Governorate;
            cost: number;
          }[];

        const governorate = fromExternalCode(order.governorate_code);
        if (!governorate) {
          throw new AppError(
            `كود المحافظة غير صالح: ${order.governorate_code}`,
            400,
          );
        }

        const target = this.normalizeArabic(order.city_name);
        const locations = await prisma.location.findMany({
          where: {governorate, companyId: data.loggedInUser.companyID},
        });
        let match = locations.find(
          (l) => this.normalizeArabic(l.name) === target,
        );
        if (!match) {
          match = locations[0];
        }

        let branchID = undefined;
        const branch = await branchesRepository.getBranchByLocation({
          locationID: match?.id,
        });
        if (!branch) {
          throw new AppError("لا يوجد فرع مرتبط بالموقع", 500);
        }
        branchID = branch.id;

        if (governoratesDeliveryCosts) {
          deliveryCost =
            governoratesDeliveryCosts.find(
              (governorateDeliveryCost: {
                governorate: Governorate;
                cost: number;
              }) => {
                return governorateDeliveryCost.governorate === governorate;
              },
            )?.cost || 0;
        }

        const createdOrder = await ordersRepository.createOrderv2({
          clientID: clientId,
          branchID: branchID,
          deliveryCost,
          storeID: storeId,
          loggedInUser: data.loggedInUser,
          orderData: {...order},
          locationID: 2,
        });

        acceptedShipments.push({
          shipment_number: order.shipment_number,
          shipment_id: order.shipment_id,
          external_id: createdOrder.id.toString(),
          airway_bill_number: (order as any).airway_bill_number || null,
        });
      } catch (error: any) {
        rejectedShipments.push({
          shipment_number: order.shipment_number,
          shipment_id: order.shipment_id || null,
          airway_bill_number: (order as any).airway_bill_number || null,
          reason: error?.message ?? "Processing error",
          error_code:
            error instanceof AppError ? "PROCESSING_ERROR" : "PROCESSING_ERROR",
          field: null,
        });
      }
    }

    return {acceptedShipments, rejectedShipments};
  };
  getAllOrders = async (data: {
    filters: OrdersFiltersType;
    loggedInUser: loggedInUserType;
  }) => {
    let governorate: Governorate | undefined = data.filters.governorate;
    let size = data.filters.size || 200;

    const {orders, pagesCount, count} =
      await ordersRepository.getAllOrdersPaginatedApiKey({
        filters: {
          ...data.filters,
          governorate,
          size,
        },
        loggedInUser: data.loggedInUser,
      });

    return {
      count,
      page: data.filters.page,
      pagesCount: pagesCount,
      orders: orders,
    };
  };

  getOrderByIdApiKey = async (data: {
    params: {
      orderID: string;
      forwardedFrom: number;
    };
  }) => {
    const order = await ordersRepository.getOrderByIdApiKey({
      orderID: data.params.orderID,
      forwardedFrom: data.params.forwardedFrom,
    });

    return order;
  };
}
