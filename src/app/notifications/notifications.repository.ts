import { prisma } from "../../database/db";
import type { NotificationCreateType, NotificationUpdateType } from "./notifications.dto";
import { notificationReform, notificationSelect } from "./notifications.responses";

export class NotificationsRepository {
    async createNotification(data: NotificationCreateType) {
        const createdNotification = await prisma.notification.create({
            data: {
                title: data.title,
                content: data.content,
                user: {
                    connect: {
                        id: data.userID
                    }
                }
                // company: {
                //     connect: {
                //         id: companyID
                //     }
                // }
            },
            select: notificationSelect
        });

        return notificationReform(createdNotification);
    }

    async getAllNotificationsPaginated(userID: number, page: number, size: number, seen: boolean) {
        const paginatedNotifications = await prisma.notification.findManyPaginated(
            {
                // if seen true gett all notifications seen and unseen
                // if seen false get only unseen notifications
                where: {
                    seen:
                        seen === true
                            ? undefined
                            : {
                                  equals: false
                              },
                    user: {
                        id: userID
                    }
                },
                orderBy: {
                    id: "desc"
                },
                select: notificationSelect
            },
            {
                page: page,
                size: size
            }
        );
        return {
            notifications: paginatedNotifications.data.map(notificationReform),
            pagesCount: paginatedNotifications.pagesCount
        };
    }

    async updateNotification(data: {
        notificationID: number;
        notificationData: NotificationUpdateType;
    }) {
        const notification = await prisma.notification.update({
            where: {
                id: data.notificationID
            },
            data: {
                seen: data.notificationData.seen
            },
            select: notificationSelect
        });
        return notificationReform(notification);
    }

    async updateNotifications(data: {
        userID: number;
        notificationData: NotificationUpdateType;
    }) {
        const notification = await prisma.notification.updateMany({
            where: {
                user: {
                    id: data.userID
                }
            },
            data: {
                seen: data.notificationData.seen
            }
        });
        return notification;
    }
}
