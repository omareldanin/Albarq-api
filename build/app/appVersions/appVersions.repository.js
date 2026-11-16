"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppVersionsRepository = void 0;
const db_1 = require("../../database/db");
const AppError_1 = require("../../lib/AppError");
const appVersions_dto_1 = require("./appVersions.dto");
const appVersionSelect = {
    platform: true,
    latestVersion: true,
    minVersion: true,
    storeUrl: true,
    releaseNotes: true,
    updatedAt: true,
};
class AppVersionsRepository {
    getAppVersion(platform) {
        return db_1.prisma.appVersion.findUnique({
            where: { platform },
            select: appVersionSelect,
        });
    }
    getAllAppVersions() {
        return db_1.prisma.appVersion.findMany({
            orderBy: { platform: "asc" },
            select: appVersionSelect,
        });
    }
    async upsertAppVersion(data) {
        const existing = await db_1.prisma.appVersion.findUnique({
            where: { platform: data.platform },
            select: { minVersion: true, storeUrl: true },
        });
        const storeUrl = data.storeUrl ?? existing?.storeUrl;
        if (!storeUrl) {
            throw new AppError_1.AppError("رابط المتجر مطلوب عند إضافة المنصة لأول مرة", 400);
        }
        const minVersion = data.minVersion ?? existing?.minVersion ?? "0.0.0";
        if ((0, appVersions_dto_1.compareVersions)(minVersion, data.latestVersion) > 0) {
            throw new AppError_1.AppError("الحد الأدنى للإصدار يجب ألا يتجاوز آخر إصدار", 400);
        }
        const values = {
            latestVersion: data.latestVersion,
            minVersion,
            storeUrl,
            releaseNotes: data.releaseNotes ?? "",
        };
        return db_1.prisma.appVersion.upsert({
            where: { platform: data.platform },
            create: { platform: data.platform, ...values },
            update: values,
            select: appVersionSelect,
        });
    }
    /** Unique Expo push tokens of users that are not deleted. */
    async getActivePushTokens() {
        const users = await db_1.prisma.user.findMany({
            where: {
                fcm: { startsWith: "Expo" },
                OR: [
                    { admin: { isNot: null } },
                    { employee: { deleted: false } },
                    { client: { deleted: false } },
                ],
            },
            select: { fcm: true },
        });
        return [...new Set(users.map((user) => user.fcm))];
    }
}
exports.AppVersionsRepository = AppVersionsRepository;
//# sourceMappingURL=appVersions.repository.js.map