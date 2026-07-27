"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsRepository = void 0;
const db_1 = require("../../database/db");
const notifications_responses_1 = require("./notifications.responses");
class NotificationsRepository {
    async createNotification(data) {
        const createdNotification = await db_1.prisma.notification.create({
            data: {
                title: data.title,
                content: data.content,
                receiptNumber: data.orderId ? data.orderId : undefined,
                type: data.type,
                user: {
                    connect: {
                        id: data.userID,
                    },
                },
                // company: {
                //     connect: {
                //         id: companyID
                //     }
                // }
            },
            select: notifications_responses_1.notificationSelect,
        });
        return (0, notifications_responses_1.notificationReform)(createdNotification);
    }
    async getAllNotificationsPaginated(userID, page, size, seen) {
        const paginatedNotifications = await db_1.prisma.notification.findManyPaginated({
            where: {
                userId: userID,
                seen: seen ? undefined : false,
            },
            orderBy: {
                id: "desc",
            },
            select: notifications_responses_1.notificationSelect,
        }, {
            page: page,
            size: size,
            withCount: true,
        });
        const unSeenCount = await db_1.prisma.notification.count({
            where: {
                seen: false,
                userId: userID,
            },
        });
        return {
            notifications: paginatedNotifications.data.map(notifications_responses_1.notificationReform),
            pagesCount: paginatedNotifications.pagesCount,
            unSeenCount: unSeenCount,
        };
    }
    async updateNotification(data) {
        const notification = await db_1.prisma.notification.update({
            where: {
                id: data.notificationID,
            },
            data: {
                seen: data.notificationData.seen,
            },
            select: notifications_responses_1.notificationSelect,
        });
        return (0, notifications_responses_1.notificationReform)(notification);
    }
    async updateNotifications(data) {
        const notification = await db_1.prisma.notification.updateMany({
            where: {
                user: {
                    id: data.userID,
                },
            },
            data: {
                seen: data.notificationData.seen,
            },
        });
        return notification;
    }
}
exports.NotificationsRepository = NotificationsRepository;
//# sourceMappingURL=notifications.repository.js.map