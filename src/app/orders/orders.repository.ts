import { Governorate, OrderStatus, type Prisma, type SecondaryStatus } from "@prisma/client";
import { prisma } from "../../database/db";
import { AppError } from "../../lib/AppError";
import type { loggedInUserType } from "../../types/user";
import type { ReportCreateOrdersFiltersType } from "../reports/reports.dto";
import type {
    OrderCreateType,
    OrderTimelineFiltersType,
    OrderTimelinePieceType,
    OrderUpdateType,
    OrdersFiltersType,
    OrdersStatisticsFiltersType
} from "./orders.dto";
import {
    orderReform,
    orderSelect,
    orderTimelineReform,
    orderTimelineSelect,
    statisticsReformed
} from "./orders.responses";

export class OrdersRepository {
    async createOrder(data: {
        companyID: number;
        clientID: number;
        deliveryAgentID?: number;
        loggedInUser: loggedInUserType;
        orderData: OrderCreateType;
    }) {
        let totalCost = 0;
        let quantity = 0;
        let weight = 0;

        if (data.orderData.withProducts === true) {
            for (const product of data.orderData.products) {
                const productData = await prisma.product.findUnique({
                    where: {
                        id: product.productID
                    },
                    select: {
                        price: true,
                        weight: true
                    }
                });
                if (!productData) {
                    throw new Error("منتج غير موجود");
                }
                totalCost += +productData.price * product.quantity;
                quantity += product.quantity;
                weight += productData.weight * product.quantity;
            }
        }

        // Check if products are available for the specific color and size
        if (data.orderData.withProducts === true) {
            for (const product of data.orderData.products) {
                const productData = await prisma.product.findUnique({
                    where: {
                        id: product.productID
                    },
                    select: {
                        title: true
                    }
                });

                if (!productData) {
                    throw new AppError("منتج غير موجود", 400);
                }

                const productTitle = productData?.title;

                if (product.colorID) {
                    const productColor = await prisma.productColors.findUnique({
                        where: {
                            productId_colorId: {
                                productId: product.productID,
                                colorId: product.colorID
                            }
                        },
                        select: {
                            quantity: true,
                            color: {
                                select: {
                                    title: true
                                }
                            }
                        }
                    });

                    if (!productColor) {
                        throw new AppError(`المنتج (${productTitle}) غير متوفر بهذا اللون`, 400);
                    }

                    if (productColor.quantity < product.quantity) {
                        throw new AppError(
                            `الكمية المتاحة من المنتج (${productTitle}) باللون (${productColor.color.title}) هي (${productColor.quantity})`,
                            400
                        );
                    }
                }

                if (product.sizeID) {
                    const productSize = await prisma.productSizes.findUnique({
                        where: {
                            productId_sizeId: {
                                productId: product.productID,
                                sizeId: product.sizeID
                            }
                        },
                        select: {
                            quantity: true,
                            size: {
                                select: {
                                    title: true
                                }
                            }
                        }
                    });

                    if (!productSize) {
                        throw new AppError(`المنتج (${productTitle}) غير متوفر بهذا المقاس`, 400);
                    }

                    if (productSize.quantity < product.quantity) {
                        throw new AppError(
                            `الكمية المتاحة من المنتج (${productTitle}) بالمقاس (${productSize.size.title}) هي (${productSize.quantity})`,
                            400
                        );
                    }
                }

                if (product.quantity) {
                    const productQuantity = await prisma.product.findUnique({
                        where: {
                            id: product.productID
                        },
                        select: {
                            stock: true
                        }
                    });

                    if (!productQuantity) {
                        throw new AppError(`المنتج (${productTitle}) غير متوفر`, 400);
                    }

                    if (productQuantity.stock < product.quantity) {
                        throw new AppError(
                            `الكمية المتاحة من المنتج (${productTitle}) هي (${productQuantity.stock})`,
                            400
                        );
                    }
                }
            }
        }

        // Calculate delivery cost

        let deliveryCost = 0;

        const client = await prisma.client.findUnique({
            where: {
                id: data.clientID
            },
            select: {
                governoratesDeliveryCosts: true
            }
        });

        if (!client) {
            throw new AppError("العميل غير موجود", 400);
        }

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
                        return governorateDeliveryCost.governorate === data.orderData.governorate;
                    }
                )?.cost || 0;
        }

        // Add Additional costs

        const companyAdditionalPrices = await prisma.company.findUnique({
            where: {
                id: data.companyID
            },
            select: {
                additionalPriceForEvery500000IraqiDinar: true,
                additionalPriceForEveryKilogram: true,
                additionalPriceForRemoteAreas: true
            }
        });

        totalCost += companyAdditionalPrices?.additionalPriceForEvery500000IraqiDinar
            ? companyAdditionalPrices?.additionalPriceForEvery500000IraqiDinar * Math.ceil(totalCost / 500000)
            : 0;
        totalCost += companyAdditionalPrices?.additionalPriceForEveryKilogram
            ? weight * companyAdditionalPrices?.additionalPriceForEveryKilogram
            : 0;

        if (data.orderData.locationID) {
            const location = await prisma.location.findUnique({
                where: {
                    id: data.orderData.locationID
                },
                select: {
                    remote: true
                }
            });

            totalCost += location?.remote ? companyAdditionalPrices?.additionalPriceForRemoteAreas || 0 : 0;
        }

        // Create order

        const createdOrder = await prisma.order.create({
            data: {
                totalCost: data.orderData.withProducts === false ? data.orderData.totalCost : totalCost,
                deliveryCost: deliveryCost,
                quantity: data.orderData.withProducts === false ? data.orderData.quantity : quantity,
                weight: data.orderData.withProducts === false ? data.orderData.weight : weight,
                recipientName: data.orderData.recipientName,
                recipientPhones: data.orderData.recipientPhones
                    ? data.orderData.recipientPhones
                    : data.orderData.recipientPhone
                      ? [data.orderData.recipientPhone]
                      : undefined,
                receiptNumber: data.orderData.receiptNumber,
                recipientAddress: data.orderData.recipientAddress,
                notes: data.orderData.notes,
                details: data.orderData.details,
                deliveryType: data.orderData.deliveryType,
                governorate: data.orderData.governorate,
                branch: data.orderData.branchID
                    ? {
                          connect: {
                              id: data.orderData.branchID
                          }
                      }
                    : undefined,
                repository: data.orderData.repositoryID
                    ? {
                          connect: {
                              id: data.orderData.repositoryID
                          }
                      }
                    : undefined,
                location: {
                    connect: {
                        id: data.orderData.locationID
                    }
                },
                store: {
                    connect: {
                        id: data.orderData.storeID
                    }
                },
                company: {
                    connect: {
                        id: data.orderData.forwardedCompanyID
                            ? data.orderData.forwardedCompanyID
                            : data.companyID
                    }
                },
                forwarded: data.orderData.forwardedCompanyID ? true : undefined,
                forwardedBy: data.orderData.forwardedCompanyID
                    ? {
                          connect: {
                              id: data.loggedInUser.id
                          }
                      }
                    : undefined,
                forwardedAt: data.orderData.forwardedCompanyID ? new Date() : undefined,
                forwardedFrom: data.orderData.forwardedCompanyID
                    ? {
                          connect: {
                              id: data.companyID
                          }
                      }
                    : undefined,
                client: {
                    connect: {
                        id: data.clientID
                    }
                },
                ordersInquiryEmployees: data.orderData.inquiryEmployeesIDs
                    ? {
                          create: data.orderData.inquiryEmployeesIDs?.map((id) => {
                              return {
                                  inquiryEmployee: {
                                      connect: {
                                          id: id
                                      }
                                  }
                              };
                          })
                      }
                    : undefined,
                confirmed: data.orderData.forwardedCompanyID ? false : data.orderData.confirmed,
                status: data.orderData.status,
                deliveryAgent: data.deliveryAgentID ? { connect: { id: data.deliveryAgentID } } : undefined,
                orderProducts:
                    data.orderData.withProducts === false
                        ? undefined
                        : {
                              create: data.orderData.products.map((product) => {
                                  return {
                                      quantity: product.quantity,
                                      size: product.sizeID
                                          ? {
                                                connect: {
                                                    id: product.sizeID
                                                }
                                            }
                                          : undefined,
                                      color: product.colorID
                                          ? {
                                                connect: {
                                                    id: product.colorID
                                                }
                                            }
                                          : undefined,
                                      product: {
                                          connect: {
                                              id: product.productID
                                          }
                                      }
                                  };
                              })
                          }
            },
            select: orderSelect
        });

        // TODO: Reduce products quantity and color and size quantity
        if (data.orderData.withProducts === true) {
            for (const product of data.orderData.products) {
                if (product.colorID) {
                    await prisma.productColors.update({
                        where: {
                            productId_colorId: {
                                productId: product.productID,
                                colorId: product.colorID
                            }
                        },
                        data: {
                            quantity: {
                                decrement: product.quantity
                            }
                        }
                    });
                }

                if (product.sizeID) {
                    await prisma.productSizes.update({
                        where: {
                            productId_sizeId: {
                                productId: product.productID,
                                sizeId: product.sizeID
                            }
                        },
                        data: {
                            quantity: {
                                decrement: product.quantity
                            }
                        }
                    });
                }

                if (product.quantity) {
                    await prisma.product.update({
                        where: {
                            id: product.productID
                        },
                        data: {
                            stock: {
                                decrement: product.quantity
                            }
                        }
                    });
                }
            }
        }

        return orderReform(createdOrder);
    }

    async getAllOrdersPaginated(data: {
        filters: OrdersFiltersType | ReportCreateOrdersFiltersType;
    }) {
        const where = {
            AND: [
                // Search by receiptNumber, recipientName, recipientPhone, recipientAddress
                {
                    OR: [
                        {
                            receiptNumber: data.filters.search
                                ? Number.isNaN(+data.filters.search)
                                    ? undefined
                                    : data.filters.search.length > 9
                                      ? undefined
                                      : +data.filters.search
                                : undefined
                        },
                        {
                            repositoryReportId: data.filters.search
                                ? Number.isNaN(+data.filters.search)
                                    ? undefined
                                    : data.filters.search.length > 9
                                      ? undefined
                                      : +data.filters.search
                                : undefined
                        },
                        {
                            branchReportId: data.filters.search
                                ? Number.isNaN(+data.filters.search)
                                    ? undefined
                                    : data.filters.search.length > 9
                                      ? undefined
                                      : +data.filters.search
                                : undefined
                        },
                        {
                            deliveryAgentReportId: data.filters.search
                                ? Number.isNaN(+data.filters.search)
                                    ? undefined
                                    : data.filters.search.length > 9
                                      ? undefined
                                      : +data.filters.search
                                : undefined
                        },
                        {
                            governorateReportId: data.filters.search
                                ? Number.isNaN(+data.filters.search)
                                    ? undefined
                                    : data.filters.search.length > 9
                                      ? undefined
                                      : +data.filters.search
                                : undefined
                        },
                        {
                            companyReportId: data.filters.search
                                ? Number.isNaN(+data.filters.search)
                                    ? undefined
                                    : data.filters.search.length > 9
                                      ? undefined
                                      : +data.filters.search
                                : undefined
                        },
                        {
                            clientReportId: data.filters.search
                                ? Number.isNaN(+data.filters.search)
                                    ? undefined
                                    : data.filters.search.length > 9
                                      ? undefined
                                      : +data.filters.search
                                : undefined
                        },
                        {
                            recipientName: {
                                contains: data.filters.search,
                                mode: "insensitive"
                            }
                        },
                        {
                            recipientPhones: data.filters.search
                                ? {
                                      has: data.filters.search
                                  }
                                : undefined
                        },
                        {
                            recipientAddress: {
                                contains: data.filters.search,
                                mode: "insensitive"
                            }
                        }
                    ]
                },
                // Filter by companyID
                {
                    company: {
                        id: data.filters.forwardedFromID
                            ? undefined
                            : data.filters.inquiryCompaniesIDs
                              ? {
                                    in: [
                                        ...data.filters.inquiryCompaniesIDs
                                        //   data.filters.companyID as number
                                    ]
                                }
                              : data.filters.companyID
                    }
                },
                {
                    confirmed: data.filters.confirmed
                },
                // Filter by orderID
                {
                    id: data.filters.orderID
                },
                // Filter by status
                {
                    status: data.filters.statuses ? { in: data.filters.statuses } : undefined
                },
                {
                    status: data.filters.status
                },
                // Filter by deliveryType
                {
                    deliveryType: data.filters.deliveryType
                },
                // Filter by deliveryDate
                {
                    // gte deliveryDate day start time (00:00:00) and lte deliveryDate day end time (23:59:59)
                    deliveryDate: data.filters.deliveryDate
                        ? {
                              gte: new Date(new Date(data.filters.deliveryDate).setHours(0, 0, 0, 0)),
                              lte: new Date(new Date(data.filters.deliveryDate).setHours(23, 59, 59, 999))
                          }
                        : undefined
                },
                // Filter by governorate
                {
                    governorate: data.filters.governorate
                },
                // Filter by deliveryAgentID
                {
                    deliveryAgent: {
                        id: data.filters.deliveryAgentID
                    }
                },
                // Filter by clientID
                {
                    client: {
                        id: data.filters.clientID
                    }
                },
                // Filter by storeID
                {
                    store: {
                        id: data.filters.storeID
                    }
                },
                // Filter by repositoryID
                {
                    repository: {
                        id: data.filters.repositoryID
                    }
                },
                // {
                //     OrderProducts: {
                //         some: {
                //             product: {
                //                 repository: {
                //                     id: data.filters.repositoryID
                //                 }
                //             }
                //         }
                //     }
                // },
                // Filter by productID
                {
                    orderProducts: data.filters.productID
                        ? {
                              some: {
                                  product: {
                                      id: data.filters.productID
                                  }
                              }
                          }
                        : undefined
                },
                // Filter by locationID
                {
                    location: {
                        id: data.filters.locationID
                    }
                },
                // Filter by receiptNumber
                {
                    receiptNumber: data.filters.receiptNumber
                },
                {
                    receiptNumber: data.filters.receiptNumbers
                        ? { in: data.filters.receiptNumbers }
                        : undefined
                },
                // Filter by recipientName
                {
                    recipientName: data.filters.recipientName
                },
                // Filter by recipientPhone
                {
                    recipientPhones: data.filters.recipientPhone
                        ? {
                              has: data.filters.recipientPhone
                          }
                        : undefined
                },
                // Filter by recipientAddress
                {
                    recipientAddress: data.filters.recipientAddress
                },
                // Filter by notes
                {
                    notes: data.filters.notes
                },
                // Filter by startDate
                {
                    createdAt: {
                        gte: data.filters.startDate
                    }
                },
                // Filter by endDate
                {
                    createdAt: {
                        lte: data.filters.endDate
                    }
                },
                // Filter by deleted
                {
                    deleted: data.filters.deleted
                },
                // Filter by clientReport
                {
                    AND: [
                        {
                            AND:
                                data.filters.clientReport === "true"
                                    ? [
                                          { clientReport: { isNot: null } },
                                          { clientReport: { report: { deleted: false } } }
                                      ]
                                    : undefined
                        },
                        {
                            OR:
                                data.filters.clientReport === "false"
                                    ? [
                                          { clientReport: { is: null } },
                                          { clientReport: { report: { deleted: true } } }
                                      ]
                                    : undefined
                        }
                    ]
                },
                // Filter by repositoryReport
                {
                    AND: [
                        {
                            AND:
                                data.filters.repositoryReport === "true"
                                    ? [
                                          { repositoryReport: { isNot: null } },
                                          { repositoryReport: { report: { deleted: false } } }
                                      ]
                                    : undefined
                        },
                        {
                            OR:
                                data.filters.repositoryReport === "false"
                                    ? [
                                          { repositoryReport: { is: null } },
                                          { repositoryReport: { report: { deleted: true } } }
                                      ]
                                    : undefined
                        }
                    ]
                },
                // Filter by branchReport
                {
                    AND: [
                        {
                            AND:
                                data.filters.branchReport === "true"
                                    ? [
                                          { branchReport: { isNot: null } },
                                          { branchReport: { report: { deleted: false } } }
                                      ]
                                    : undefined
                        },
                        {
                            OR:
                                data.filters.branchReport === "false"
                                    ? [
                                          { branchReport: { is: null } },
                                          { branchReport: { report: { deleted: true } } }
                                      ]
                                    : undefined
                        }
                    ]
                },
                // Filter by deliveryAgentReport
                {
                    AND: [
                        {
                            AND:
                                data.filters.deliveryAgentReport === "true"
                                    ? [
                                          { deliveryAgentReport: { isNot: null } },
                                          { deliveryAgentReport: { report: { deleted: false } } }
                                      ]
                                    : undefined
                        },
                        {
                            OR:
                                data.filters.deliveryAgentReport === "false"
                                    ? [
                                          { deliveryAgentReport: { is: null } },
                                          { deliveryAgentReport: { report: { deleted: true } } }
                                      ]
                                    : undefined
                        }
                    ]
                },
                // Filter by governorateReport
                {
                    AND: [
                        {
                            AND:
                                data.filters.governorateReport === "true"
                                    ? [
                                          { governorateReport: { isNot: null } },
                                          { governorateReport: { report: { deleted: false } } }
                                      ]
                                    : undefined
                        },
                        {
                            OR:
                                data.filters.governorateReport === "false"
                                    ? [
                                          { governorateReport: { is: null } },
                                          { governorateReport: { report: { deleted: true } } }
                                      ]
                                    : undefined
                        }
                    ]
                },
                // Filter by companyReport
                {
                    AND: [
                        {
                            AND:
                                data.filters.companyReport === "true"
                                    ? [
                                          { companyReport: { isNot: null } },
                                          { companyReport: { report: { deleted: false } } }
                                      ]
                                    : undefined
                        },
                        {
                            OR:
                                data.filters.companyReport === "false"
                                    ? [
                                          { companyReport: { is: null } },
                                          { companyReport: { report: { deleted: true } } }
                                      ]
                                    : undefined
                        }
                    ]
                },
                // Filter by automaticUpdateID
                {
                    automaticUpdate: {
                        id: data.filters.automaticUpdateID
                    }
                },
                {
                    branch: {
                        id: data.filters.branchID
                    }
                },
                {
                    repository: {
                        id: data.filters.repositoryID
                    }
                },
                {
                    forwarded: data.filters.forwarded
                },
                {
                    processed: data.filters.processed
                },
                {
                    forwardedBy: {
                        id: data.filters.forwardedByID
                    }
                },
                {
                    forwardedFrom: {
                        id: data.filters.forwardedFromID
                    }
                },
                // inquiry filters
                {
                    AND: [
                        {
                            status: data.filters.inquiryStatuses
                                ? {
                                      in: data.filters.inquiryStatuses
                                  }
                                : undefined
                        },
                        {
                            governorate: data.filters.inquiryGovernorates
                                ? {
                                      in: data.filters.inquiryGovernorates
                                  }
                                : undefined
                        },
                        {
                            branch: data.filters.inquiryBranchesIDs
                                ? {
                                      id: {
                                          in: data.filters.inquiryBranchesIDs
                                      }
                                  }
                                : undefined
                        },
                        {
                            store: data.filters.inquiryStoresIDs
                                ? {
                                      id: {
                                          in: data.filters.inquiryStoresIDs
                                      }
                                  }
                                : undefined
                        },
                        {
                            company: data.filters.inquiryCompaniesIDs
                                ? {
                                      id: {
                                          in: data.filters.inquiryCompaniesIDs
                                      }
                                  }
                                : undefined
                        },
                        {
                            location: data.filters.inquiryLocationsIDs
                                ? {
                                      id: {
                                          in: data.filters.inquiryLocationsIDs
                                      }
                                  }
                                : undefined
                        }
                    ]
                }
            ]
        } satisfies Prisma.OrderWhereInput;

        if (data.filters.minified === true) {
            const paginatedOrders = await prisma.order.findManyPaginated(
                {
                    where: where,
                    select: {
                        id: true
                    }
                },
                {
                    page: data.filters.page,
                    size: data.filters.size
                }
            );
            return { orders: paginatedOrders.data, pagesCount: paginatedOrders.pagesCount };
        }

        const paginatedOrders = await prisma.order.findManyPaginated(
            {
                where: where,
                orderBy: {
                    [data.filters.sort.split(":")[0]]:
                        data.filters.sort.split(":")[1] === "desc" ? "desc" : "asc"
                },
                select: orderSelect
            },
            {
                page: data.filters.page,
                size: data.filters.size
            }
        );

        const ordersReformed = paginatedOrders.data.map(orderReform);

        //TODO: MUST BE DELETED AND ONLY USED IN GET ONE ORDER
        // const ordersReformed: Array<ReturnType<typeof orderReform>> = [];
        // for (const order of paginatedOrders.data) {
        //     const inquiryEmployees =
        //         (
        //             await prisma.employee.findMany({
        //                 where: {
        //                     AND: [
        //                         { role: "INQUIRY_EMPLOYEE" },
        //                         {
        //                             OR: [
        //                                 {
        //                                     inquiryBranches: order?.branch?.id
        //                                         ? {
        //                                               some: {
        //                                                   branchId: order.branch.id
        //                                               }
        //                                           }
        //                                         : undefined
        //                                 },
        //                                 {
        //                                     inquiryStores: order?.store.id
        //                                         ? {
        //                                               some: {
        //                                                   storeId: order.store.id
        //                                               }
        //                                           }
        //                                         : undefined
        //                                 },
        //                                 {
        //                                     inquiryCompanies: order?.company.id
        //                                         ? {
        //                                               some: {
        //                                                   companyId: order.company.id
        //                                               }
        //                                           }
        //                                         : undefined
        //                                 },
        //                                 {
        //                                     inquiryLocations: order?.location?.id
        //                                         ? {
        //                                               some: {
        //                                                   locationId: order.location.id
        //                                               }
        //                                           }
        //                                         : undefined
        //                                 }
        //                             ]
        //                         }
        //                     ]
        //                 },
        //                 select: {
        //                     user: {
        //                         select: {
        //                             id: true,
        //                             name: true,
        //                             phone: true,
        //                             avatar: true
        //                         }
        //                     },
        //                     role: true
        //                 }
        //             })
        //         ).map((inquiryEmployee) => {
        //             return {
        //                 id: inquiryEmployee.user?.id ?? null,
        //                 name: inquiryEmployee.user?.name ?? null,
        //                 phone: inquiryEmployee.user?.phone ?? null,
        //                 avatar: inquiryEmployee.user?.avatar ?? null,
        //                 role: inquiryEmployee.role
        //             };
        //         }) ?? [];

        //     // @ts-expect-error Fix later
        //     ordersReformed.push({
        //         ...orderReform(order),
        //         inquiryEmployees: [...(orderReform(order)?.inquiryEmployees || []), ...inquiryEmployees]
        //     });
        // }

        // const reformedOrder = orderReform(order);
        // return {
        //     ...reformedOrder,
        //     inquiryEmployees: [...(reformedOrder?.inquiryEmployees || []), ...inquiryEmployees]
        // };

        const ordersMetaDataAggregate = await prisma.order.aggregate({
            where: where,
            _count: {
                id: true
            },
            _sum: {
                totalCost: true,
                paidAmount: true,
                clientNet: true,
                deliveryAgentNet: true,
                companyNet: true,
                deliveryCost: true
            }
        });

        const ordersMetaDataGroupByStatus = await prisma.order.groupBy({
            where: where,
            by: ["status"],
            _count: {
                status: true
            }
        });

        const ordersMetaDataGroupByStatusReformed = (
            Object.keys(OrderStatus) as Array<keyof typeof OrderStatus>
        ).map((status) => {
            const statusCount = ordersMetaDataGroupByStatus.find((orderStatus: { status: string }) => {
                return orderStatus.status === status;
            });

            return {
                status: status,
                count: statusCount?._count?.status || 0
            };
        });

        const ordersMetaDataReformed = {
            count: ordersMetaDataAggregate._count.id,
            totalCost: ordersMetaDataAggregate._sum.totalCost || 0,
            paidAmount: ordersMetaDataAggregate._sum.paidAmount || 0,
            clientNet: ordersMetaDataAggregate._sum.clientNet || 0,
            deliveryAgentNet: ordersMetaDataAggregate._sum.deliveryAgentNet || 0,
            companyNet: ordersMetaDataAggregate._sum.companyNet || 0,
            deliveryCost: ordersMetaDataAggregate._sum.deliveryCost || 0,
            countByStatus: ordersMetaDataGroupByStatusReformed
        };

        return {
            orders: ordersReformed,
            ordersMetaData: ordersMetaDataReformed,
            pagesCount: paginatedOrders.pagesCount
        };
    }

    async getOrdersByIDs(data: { ordersIDs: number[] }) {
        const orders = await prisma.order.findMany({
            where: {
                id: {
                    in: data.ordersIDs
                }
            },
            orderBy: {
                id: "asc"
            },
            select: orderSelect
        });
        return orders.map(orderReform);
    }

    async getOrder(data: { orderID: number }) {
        const order = await prisma.order.findUnique({
            where: {
                id: data.orderID
            },
            select: orderSelect
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

    async getOrderByReceiptNumber(data: { orderReceiptNumber: number }) {
        const order = await prisma.order.findFirst({
            where: {
                receiptNumber: data.orderReceiptNumber
            },
            orderBy: {
                id: "desc"
            },
            select: orderSelect
        });
        return orderReform(order);
    }

    async updateOrdersCosts(data: {
        ordersIDs: number[];
        costs: {
            baghdadDeliveryCost?: number;
            governoratesDeliveryCost?: number;
            deliveryAgentDeliveryCost?: number;
        };
    }) {
        if (data.costs.baghdadDeliveryCost) {
            // Get Baghdad orders
            const baghdadOrders = await prisma.order.findMany({
                where: {
                    id: {
                        in: data.ordersIDs
                    },
                    governorate: Governorate.BAGHDAD
                },
                select: {
                    id: true,
                    paidAmount: true,
                    weight: true
                }
            });

            // Update Baghdad orders costs
            for (const order of baghdadOrders) {
                const weight = order.weight || 0;
                const deliveryCost = data.costs.baghdadDeliveryCost || 0;
                const weightedDeliveryCost = weight > 1 ? deliveryCost * weight : deliveryCost;
                const clientNet = (order.paidAmount || 0) - weightedDeliveryCost;
                await prisma.order.update({
                    where: {
                        id: order.id
                    },
                    data: {
                        deliveryCost: weightedDeliveryCost,
                        clientNet: clientNet
                    }
                });
            }
        }

        if (data.costs.governoratesDeliveryCost) {
            // get governorates orders
            const governoratesOrders = await prisma.order.findMany({
                where: {
                    id: {
                        in: data.ordersIDs
                    },
                    governorate: {
                        not: Governorate.BAGHDAD
                    }
                },
                select: {
                    id: true,
                    paidAmount: true,
                    weight: true
                }
            });

            // Update governorates orders costs
            for (const order of governoratesOrders) {
                const weight = order.weight || 0;
                const deliveryCost = data.costs.governoratesDeliveryCost || 0;
                const weightedDeliveryCost = weight > 1 ? deliveryCost * weight : deliveryCost;
                const clientNet = (order.paidAmount || 0) - weightedDeliveryCost;
                await prisma.order.update({
                    where: {
                        id: order.id
                    },
                    data: {
                        deliveryCost: weightedDeliveryCost,
                        clientNet: clientNet
                    }
                });
            }
        }

        // Update delivery agent delivery cost
        if (data.costs.deliveryAgentDeliveryCost) {
            // get orders
            const orders = await prisma.order.findMany({
                where: {
                    id: {
                        in: data.ordersIDs
                    }
                },
                select: {
                    id: true,
                    paidAmount: true,
                    weight: true
                }
            });

            // Update orders costs
            for (const order of orders) {
                const weight = order.weight || 0;
                const deliveryCost = data.costs.deliveryAgentDeliveryCost || 0;
                const weightedDeliveryCost = weight > 1 ? deliveryCost * weight : deliveryCost;
                const deliveryAgentNet = weightedDeliveryCost;
                const companyNet = (order.paidAmount || 0) - weightedDeliveryCost;
                await prisma.order.update({
                    where: {
                        id: order.id
                    },
                    data: {
                        deliveryCost: weightedDeliveryCost,
                        deliveryAgentNet: deliveryAgentNet,
                        companyNet: companyNet
                    }
                });
            }
        }
    }

    async updateOrder(data: { orderID: number; orderData: OrderUpdateType; loggedInUser: loggedInUserType }) {
        // Calculate order costs
        let deliveryAgentCost = 0;
        let companyNet = 0;
        let clientNet = 0;
        if (data.orderData.paidAmount) {
            const orderData = await prisma.order.findUnique({
                where: {
                    id: data.orderID
                },
                select: {
                    deliveryCost: true,
                    deliveryAgent: {
                        select: {
                            deliveryCost: true
                        }
                    }
                }
            });

            // calculate client net
            const deliveryCost = (orderData?.deliveryCost || 0) as number;
            clientNet = data.orderData.paidAmount - deliveryCost;

            // calculate company net
            if (data.orderData.deliveryAgentID) {
                const orderDeliveryAgent = await prisma.employee.findUnique({
                    where: {
                        id: data.orderData.deliveryAgentID
                    },
                    select: {
                        deliveryCost: true
                    }
                });
                deliveryAgentCost = (orderDeliveryAgent?.deliveryCost || 0) as number;
                companyNet = data.orderData.paidAmount - deliveryAgentCost;
            } else if (orderData?.deliveryAgent) {
                deliveryAgentCost = (orderData?.deliveryAgent?.deliveryCost || 0) as number;
                companyNet = data.orderData.paidAmount - deliveryAgentCost;
            }
        }

        const order = await prisma.order.update({
            where: {
                id: data.orderID
            },
            data: {
                quantity: data.orderData.quantity,
                totalCost: data.orderData.totalCost,
                paidAmount: data.orderData.paidAmount,
                receiptNumber: data.orderData.receiptNumber,
                clientNet: clientNet,
                deliveryAgentNet: deliveryAgentCost,
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
                secondaryStatus: data.orderData.secondaryStatus,
                confirmed: data.orderData.forwardedCompanyID ? false : data.orderData.confirmed,
                details: data.orderData.details,
                deliveryDate: data.orderData.deliveryDate,
                company: {
                    connect: {
                        id: data.orderData.forwardedCompanyID
                            ? data.orderData.forwardedCompanyID
                            : (data.loggedInUser.companyID as number)
                    }
                },
                forwarded: data.orderData.forwardedCompanyID ? true : undefined,
                forwardedBy: data.orderData.forwardedCompanyID
                    ? {
                          connect: {
                              id: data.loggedInUser.id
                          }
                      }
                    : undefined,
                forwardedAt: data.orderData.forwardedCompanyID ? new Date() : undefined,
                forwardedFrom: data.orderData.forwardedCompanyID
                    ? {
                          connect: {
                              id: data.loggedInUser.companyID as number
                          }
                      }
                    : undefined,
                processed: data.orderData.processed,
                processedAt: data.orderData.processed ? new Date() : undefined,
                processedBy: data.orderData.processed ? { connect: { id: data.loggedInUser.id } } : undefined,
                deliveryAgent:
                    // unlink delivery agent if null
                    data.orderData.deliveryAgentID === null
                        ? {
                              disconnect: true
                          }
                        : data.orderData.deliveryAgentID !== undefined
                          ? {
                                connect: {
                                    id: data.orderData.deliveryAgentID
                                }
                            }
                          : undefined,
                repository: data.orderData.repositoryID
                    ? {
                          connect: {
                              id: data.orderData.repositoryID
                          }
                      }
                    : undefined,
                branch: data.orderData.branchID
                    ? {
                          connect: {
                              id: data.orderData.branchID
                          }
                      }
                    : undefined,
                client: data.orderData.clientID
                    ? {
                          connect: {
                              id: data.orderData.clientID
                          }
                      }
                    : undefined,
                ordersInquiryEmployees: data.orderData.inquiryEmployeesIDs
                    ? {
                          deleteMany: {
                              orderId: data.orderID
                          },
                          create: data.orderData.inquiryEmployeesIDs?.map((id) => {
                              return {
                                  inquiryEmployee: {
                                      connect: {
                                          id: id
                                      }
                                  }
                              };
                          })
                      }
                    : undefined
            },
            select: orderSelect
        });
        return orderReform(order);
    }

    async deleteOrder(data: { orderID: number }) {
        const deletedOrder = await prisma.order.delete({
            where: {
                id: data.orderID
            }
        });
        return deletedOrder;
    }

    async deactivateOrder(data: { orderID: number; deletedByID: number }) {
        const deletedOrder = await prisma.order.update({
            where: {
                id: data.orderID
            },
            data: {
                deleted: true,
                deletedAt: new Date(),
                deletedBy: {
                    connect: {
                        id: data.deletedByID
                    }
                }
            }
        });
        return deletedOrder;
    }

    async reactivateOrder(data: { orderID: number }) {
        const deletedOrder = await prisma.order.update({
            where: {
                id: data.orderID
            },
            data: {
                deleted: false
            }
        });
        return deletedOrder;
    }

    async getOrdersStatistics(data: {
        filters: OrdersStatisticsFiltersType;
    }) {
        const filtersReformed = {
            AND: [
                {
                    company: {
                        id: data.filters.inquiryCompaniesIDs
                            ? {
                                  in: [...data.filters.inquiryCompaniesIDs]
                              }
                            : data.filters.companyID
                    }
                },
                {
                    storeId: data.filters.storeID
                },
                {
                    clientReport: data.filters.clientReport
                        ? { isNot: null }
                        : data.filters.clientReport
                          ? { is: null }
                          : undefined
                },
                {
                    governorateReport: data.filters.governorateReport
                        ? { isNot: null }
                        : data.filters.governorateReport
                          ? { is: null }
                          : undefined
                },
                {
                    branchReport: data.filters.branchReport
                        ? { isNot: null }
                        : data.filters.branchReport
                          ? { is: null }
                          : undefined
                },
                {
                    deliveryAgentReport: data.filters.deliveryAgentReport
                        ? { isNot: null }
                        : data.filters.deliveryAgentReport
                          ? { is: null }
                          : undefined
                },
                {
                    repositoryReport: data.filters.repositoryReport
                        ? { isNot: null }
                        : data.filters.repositoryReport
                          ? { is: null }
                          : undefined
                },
                {
                    companyReport: data.filters.companyReport
                        ? { isNot: null }
                        : data.filters.companyReport
                          ? { is: null }
                          : undefined
                },
                {
                    status: { in: data.filters.statuses }
                },
                {
                    governorate: data.filters.governorate
                },
                {
                    createdAt: {
                        gte: data.filters.startDate
                    }
                },
                {
                    createdAt: {
                        lte: data.filters.endDate
                    }
                },
                {
                    client: {
                        id: data.filters.clientID
                    }
                },
                {
                    deliveryType: data.filters.deliveryType
                },
                {
                    location: {
                        id: data.filters.locationID
                    }
                },
                {
                    deliveryAgent: {
                        id: data.filters.deliveryAgentID
                    }
                },
                {
                    deleted: false
                },
                // inquiry filters
                {
                    AND: [
                        {
                            status: data.filters.inquiryStatuses
                                ? {
                                      in: data.filters.inquiryStatuses
                                  }
                                : undefined
                        },
                        {
                            governorate: data.filters.inquiryGovernorates
                                ? {
                                      in: data.filters.inquiryGovernorates
                                  }
                                : undefined
                        },
                        {
                            branch: data.filters.inquiryBranchesIDs
                                ? {
                                      id: {
                                          in: data.filters.inquiryBranchesIDs
                                      }
                                  }
                                : undefined
                        },
                        {
                            store: data.filters.inquiryStoresIDs
                                ? {
                                      id: {
                                          in: data.filters.inquiryStoresIDs
                                      }
                                  }
                                : undefined
                        },
                        {
                            company: data.filters.inquiryCompaniesIDs
                                ? {
                                      id: {
                                          in: data.filters.inquiryCompaniesIDs
                                      }
                                  }
                                : undefined
                        },
                        {
                            location: data.filters.inquiryLocationsIDs
                                ? {
                                      id: {
                                          in: data.filters.inquiryLocationsIDs
                                      }
                                  }
                                : undefined
                        }
                    ]
                }
            ]
        } satisfies Prisma.OrderWhereInput;

        const ordersStatisticsByStatus = await prisma.order.groupBy({
            by: ["status"],
            _sum: {
                totalCost: true
            },
            _count: {
                id: true
            },
            where: {
                ...filtersReformed
            }
        });

        const ordersStatisticsByGovernorate = await prisma.order.groupBy({
            by: ["governorate"],
            _sum: {
                totalCost: true
            },
            _count: {
                id: true
            },
            where: {
                ...filtersReformed
            }
        });

        const allOrdersStatistics = await prisma.order.aggregate({
            _sum: {
                totalCost: true
            },
            _count: {
                id: true
            },
            where: {
                ...filtersReformed
            }
        });

        const allOrdersStatisticsWithoutClientReport = await prisma.order.aggregate({
            _sum: {
                totalCost: true
            },
            _count: {
                id: true
            },
            where: {
                ...filtersReformed,
                clientReport: {
                    is: null
                }
            }
        });

        const todayOrdersStatistics = await prisma.order.aggregate({
            _sum: {
                totalCost: true
            },
            _count: {
                id: true
            },
            where: {
                ...filtersReformed,
                // deleted: false,
                createdAt: {
                    gte: new Date(new Date().setHours(0, 0, 0, 0))
                }
            }
        });

        return statisticsReformed({
            ordersStatisticsByStatus,
            ordersStatisticsByGovernorate,
            allOrdersStatistics,
            allOrdersStatisticsWithoutClientReport,
            todayOrdersStatistics
        });
    }

    async getOrderTimeline(data: { params: { orderID: number }; filters: OrderTimelineFiltersType }) {
        const orderTimeline = await prisma.orderTimeline.findMany({
            where: {
                orderId: data.params.orderID,
                type: data.filters.types ? { in: data.filters.types } : data.filters.type
            },
            select: orderTimelineSelect
        });
        return orderTimeline.map(orderTimelineReform);
    }

    async updateOrderTimeline(data: {
        orderID: number;
        data: OrderTimelinePieceType;
        // {
        //     type: OrderTimelineType;
        //     by: {
        //         id: number;
        //         name: string;
        //     };
        //     old: {
        //         id: number;
        //         value: string;
        //     } | null;
        //     new: {
        //         id: number;
        //         value: string;
        //     } | null;
        //     message: string;
        //     date: Date;
        // };
    }) {
        await prisma.orderTimeline.create({
            data: {
                order: {
                    connect: {
                        id: data.orderID
                    }
                },
                type: data.data.type,
                by: JSON.stringify(data.data.by),
                old: JSON.stringify(data.data.old),
                new: JSON.stringify(data.data.new),
                message: data.data.message,
                createdAt: data.data.date
            }
        });
    }

    async getOrderChatMembers(data: { orderID: number }) {
        /*
            chatMembers:
                CLIENT
                DELIVERY_AGENT
                RECEIVING_AGENT
                BRANCH_MANAGER
                INQUIRY_EMPLOYEE
        */
        const order = await prisma.order.findUnique({
            where: {
                id: data.orderID
            },
            select: {
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
                                avatar: true
                            }
                        }
                    }
                },
                deliveryAgent: {
                    select: {
                        role: true,
                        user: {
                            select: {
                                id: true,
                                name: true,
                                phone: true,
                                avatar: true
                            }
                        }
                    }
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
                                        avatar: true
                                    }
                                },
                                role: true
                            }
                        }
                    }
                }
            }
        });

        const inquiryEmployees = await this.getOrderInquiryEmployees({ orderID: data.orderID });

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
                role: order?.client?.role
            },
            order?.deliveryAgent && {
                id: order?.deliveryAgent?.user?.id,
                name: order?.deliveryAgent?.user?.name,
                phone: order?.deliveryAgent?.user?.phone,
                avatar: order?.deliveryAgent?.user?.avatar,
                role: order?.deliveryAgent?.role
            },
            ...(order?.ordersInquiryEmployees?.map((orderInquiryEmployee) => {
                return {
                    id: orderInquiryEmployee.inquiryEmployee.user?.id ?? null,
                    name: orderInquiryEmployee.inquiryEmployee.user?.name ?? null,
                    phone: orderInquiryEmployee.inquiryEmployee?.user?.phone ?? null,
                    avatar: orderInquiryEmployee.inquiryEmployee.user?.avatar ?? null,
                    role: orderInquiryEmployee.inquiryEmployee.role
                };
            }) ?? []),
            ...(inquiryEmployees ?? [])
        ].filter((chatMember) => {
            return chatMember !== null;
        });

        return chatMembers;
    }

    async getOrderInquiryEmployees(data: { orderID: number }) {
        const order = await prisma.order.findUnique({
            where: {
                id: data.orderID
            },
            select: {
                branchId: true,
                storeId: true,
                companyId: true,
                locationId: true,
                status: true,
                governorate: true
            }
        });

        const inquiryEmployees =
            (
                await prisma.employee.findMany({
                    where: {
                        AND: [
                            { role: "INQUIRY_EMPLOYEE" },
                            {
                                OR: [
                                    {
                                        inquiryBranches: order?.branchId
                                            ? {
                                                  some: {
                                                      branchId: order.branchId
                                                  }
                                              }
                                            : undefined
                                    },
                                    {
                                        inquiryStores: order?.storeId
                                            ? {
                                                  some: {
                                                      storeId: order.storeId
                                                  }
                                              }
                                            : undefined
                                    },
                                    {
                                        inquiryCompanies: order?.companyId
                                            ? {
                                                  some: {
                                                      companyId: order.companyId
                                                  }
                                              }
                                            : undefined
                                    },
                                    {
                                        inquiryLocations: order?.locationId
                                            ? {
                                                  some: {
                                                      locationId: order.locationId
                                                  }
                                              }
                                            : undefined
                                    },
                                    // TODO
                                    {
                                        inquiryGovernorates: order?.governorate
                                            ? { has: order.governorate }
                                            : undefined
                                    },
                                    {
                                        inquiryStatuses: order?.status ? { has: order.status } : undefined
                                    }
                                ]
                            }
                        ]
                    },
                    select: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                phone: true,
                                avatar: true
                            }
                        },
                        role: true
                    }
                })
            ).map((inquiryEmployee) => {
                return {
                    id: inquiryEmployee.user?.id ?? null,
                    name: inquiryEmployee.user?.name ?? null,
                    phone: inquiryEmployee.user?.phone ?? null,
                    avatar: inquiryEmployee.user?.avatar ?? null,
                    role: inquiryEmployee.role
                };
            }) ?? [];

        return inquiryEmployees;
    }

    async getOrderStatus(data: { orderID: number }) {
        const order = await prisma.order.findUnique({
            where: {
                id: data.orderID
            },
            select: {
                status: true
            }
        });
        return order;
    }

    async updateOrdersSecondaryStatus(data: {
        ordersIDs: number[];
        secondaryStatus: SecondaryStatus;
    }) {
        const updatedOrders = await prisma.order.updateMany({
            where: {
                id: {
                    in: data.ordersIDs
                }
            },
            data: {
                secondaryStatus: data.secondaryStatus
            }
        });
        return updatedOrders;
    }

    async removeOrderFromRepositoryReport(data: {
        orderID: number;
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
                    id: data.orderID
                },
                data: {
                    repositoryReportId: null
                }
            }),
            prisma.report.update({
                where: {
                    id: data.repositoryReportID
                },
                data: {
                    baghdadOrdersCount: {
                        decrement: data.orderData.governorate === Governorate.BAGHDAD ? 1 : 0
                    },
                    governoratesOrdersCount: {
                        decrement: data.orderData.governorate !== Governorate.BAGHDAD ? 1 : 0
                    },
                    totalCost: {
                        decrement: data.orderData.totalCost
                    },
                    paidAmount: {
                        decrement: data.orderData.paidAmount
                    },
                    deliveryCost: {
                        decrement: data.orderData.deliveryCost
                    },
                    clientNet: {
                        decrement: data.orderData.clientNet
                    },
                    deliveryAgentNet: {
                        decrement: data.orderData.deliveryAgentNet
                    },
                    companyNet: {
                        decrement: data.orderData.companyNet
                    }
                }
            })
        ]);
    }
}
