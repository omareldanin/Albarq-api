import { prisma } from "../../../database/db";
import { localizeOrderStatus } from "../../../lib/localize";
import { Logger } from "../../../lib/logger";
import { sendNotification } from "../../notifications/helpers/sendNotification";
import { OrdersRepository } from "../../orders/orders.repository";
// import { OrderTimelineType } from "../../orders/orders.dto";

const ordersRepository = new OrdersRepository();

export const automaticUpdatesTask = async () => {
    try {
        const currentDate = new Date();
        const currentHour = currentDate.getUTCHours();
        const currentMinute = currentDate.getUTCMinutes();
        const currentTime =
            currentMinute >= 0 && currentMinute < 30
                ? currentHour
                : currentMinute >= 30 && currentMinute < 60
                  ? currentHour + 1
                  : currentHour + 1;

        const companies = await prisma.company.findMany({
            select: {
                id: true,
                orderStatusAutomaticUpdate: true
            }
        });

        for (const company of companies) {
            const automaticUpdates = await prisma.automaticUpdate.findMany({
                where: {
                    company: {
                        id: company.id
                    },
                    updateAt: {
                        // Add 3 hours to the current time to get local baghdad time
                        equals: currentTime + 3
                    },
                    enabled: true
                },
                select: {
                    id: true,
                    orderStatus: true,
                    // newStatus: true,
                    governorate: true,
                    branch: {
                        select: {
                            id: true
                        }
                    },
                    checkAfter: true,
                    // updateAt: true,
                    returnCondition: true,
                    newOrderStatus: true
                }
            });

            for (const automaticUpdate of automaticUpdates) {
                const orders = await prisma.order.findMany({
                    where: {
                        company: {
                            id: company.id
                        },
                        status: automaticUpdate.orderStatus,
                        governorate: automaticUpdate.governorate,
                        branch: {
                            id: automaticUpdate.branch.id
                        }
                    },
                    select: {
                        id: true,
                        status: true,
                        updatedAt: true,
                        createdAt: true,
                        client: {
                            select: {
                                id: true
                            }
                        },
                        deliveryAgent: {
                            select: {
                                id: true
                            }
                        }
                    }
                });

                if (!orders) {
                    return;
                }

                for (const order of orders) {
                    const lastUpdate = new Date(order.updatedAt);
                    const difference = currentDate.getTime() - lastUpdate.getTime();
                    const hoursDifference = difference / (1000 * 3600);
                    if (hoursDifference < automaticUpdate.checkAfter) {
                        continue;
                    }

                    await prisma.order.update({
                        where: {
                            id: order.id
                        },
                        data: {
                            status: automaticUpdate.newOrderStatus,
                            secondaryStatus: automaticUpdate.returnCondition,
                            automaticUpdate: {
                                connect: {
                                    id: automaticUpdate.id
                                }
                            }
                        }
                    });

                    await ordersRepository.updateOrderTimeline({
                        orderID: order.id,
                        data: {
                            type: "STATUS_CHANGE",
                            date: order.updatedAt,
                            old: {
                                value: order.status
                            },
                            new: {
                                value: automaticUpdate.newOrderStatus
                            },
                            by: {
                                id: 0,
                                name: "التحديث التلقائي"
                            },
                            message: `تم تغيير حالة الطلب من ${localizeOrderStatus(
                                order.status
                            )} إلى ${localizeOrderStatus(automaticUpdate.newOrderStatus)}`
                        }
                    });

                    order.client &&
                        (await sendNotification({
                            userID: order.client.id,
                            title: "تم تغيير حالة الطلب",
                            content: `تم تغيير حالة الطلب رقم ${order.id} إلى ${localizeOrderStatus(
                                automaticUpdate.newOrderStatus
                            )}`
                        }));

                    order.deliveryAgent &&
                        (await sendNotification({
                            userID: order.deliveryAgent.id,
                            title: "تم تغيير حالة الطلب",
                            content: `تم تغيير حالة الطلب رقم ${order.id} إلى ${localizeOrderStatus(
                                automaticUpdate.newOrderStatus
                            )}`
                        }));

                    Logger.info(`Automatic update for order with ID: ${order.id} has been completed.`);
                }
            }
        }

        Logger.info("Automatic updates task has been completed.");
    } catch (error) {
        Logger.error("Error in automatic updates task", error);
    }
};
