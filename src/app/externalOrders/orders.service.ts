import { loggedInUserType } from "../../types/user";
import { OrderCreateType } from "./orders.dto";
import { OrdersRepository } from "./orders.repository";
import { BranchesRepository } from "../branches/branches.repository";
import { prisma } from "../../database/db";
import { AppError } from "../../lib/AppError";
import { Governorate } from "@prisma/client";
import { OrdersFiltersType } from "../orders/orders.dto";

const ordersRepository = new OrdersRepository();
const branchesRepository = new BranchesRepository();

export class OrdersService {
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
          orderData: { ...order },
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

  getAllOrders = async (data: {
    filters: OrdersFiltersType;
    loggedInUser: loggedInUserType;
  }) => {
    let governorate: Governorate | undefined = data.filters.governorate;
    let size = data.filters.size || 200;

    const { orders, pagesCount, count } =
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
