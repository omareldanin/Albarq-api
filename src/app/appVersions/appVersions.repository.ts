import type {AppPlatform} from "@prisma/client";
import {prisma} from "../../database/db";
import {AppError} from "../../lib/AppError";
import {type AppVersionUpsertType, compareVersions} from "./appVersions.dto";

const appVersionSelect = {
  platform: true,
  latestVersion: true,
  minVersion: true,
  storeUrl: true,
  releaseNotes: true,
  updatedAt: true,
} as const;

export class AppVersionsRepository {
  getAppVersion(platform: AppPlatform) {
    return prisma.appVersion.findUnique({
      where: {platform},
      select: appVersionSelect,
    });
  }

  getAllAppVersions() {
    return prisma.appVersion.findMany({
      orderBy: {platform: "asc"},
      select: appVersionSelect,
    });
  }

  async upsertAppVersion(data: AppVersionUpsertType) {
    const existing = await prisma.appVersion.findUnique({
      where: {platform: data.platform},
      select: {minVersion: true, storeUrl: true},
    });

    const storeUrl = data.storeUrl ?? existing?.storeUrl;
    if (!storeUrl) {
      throw new AppError("رابط المتجر مطلوب عند إضافة المنصة لأول مرة", 400);
    }

    const minVersion = data.minVersion ?? existing?.minVersion ?? "0.0.0";
    if (compareVersions(minVersion, data.latestVersion) > 0) {
      throw new AppError("الحد الأدنى للإصدار يجب ألا يتجاوز آخر إصدار", 400);
    }

    const values = {
      latestVersion: data.latestVersion,
      minVersion,
      storeUrl,
      releaseNotes: data.releaseNotes ?? "",
    };

    return prisma.appVersion.upsert({
      where: {platform: data.platform},
      create: {platform: data.platform, ...values},
      update: values,
      select: appVersionSelect,
    });
  }

  /** Unique Expo push tokens of users that are not deleted. */
  async getActivePushTokens() {
    const users = await prisma.user.findMany({
      where: {
        fcm: {startsWith: "Expo"},
        OR: [
          {admin: {isNot: null}},
          {employee: {deleted: false, companyId: 75}},
          {client: {deleted: false, companyId: 75}},
        ],
      },
      select: {fcm: true},
    });
    return [...new Set(users.map((user) => user.fcm))];
  }
}
