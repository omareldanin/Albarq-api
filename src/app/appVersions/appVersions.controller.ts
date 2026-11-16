import {catchAsync} from "../../lib/catchAsync";
import {Logger} from "../../lib/logger";
import {
  AppVersionNotifySchema,
  AppVersionQuerySchema,
  AppVersionUpsertSchema,
} from "./appVersions.dto";
import {broadcastPush} from "./appVersions.push";
import {AppVersionsRepository} from "./appVersions.repository";

const repository = new AppVersionsRepository();

export class AppVersionsController {
  // Public: the app checks this on launch, before or after login.
  getAppVersion = catchAsync(async (req, res) => {
    const {platform} = AppVersionQuerySchema.parse(req.query);
    const data = platform
      ? await repository.getAppVersion(platform)
      : await repository.getAllAppVersions();
    res.status(200).json({status: "success", data});
  });

  upsertAppVersion = catchAsync(async (req, res) => {
    const data = AppVersionUpsertSchema.parse(req.body);
    const appVersion = await repository.upsertAppVersion(data);
    res.status(200).json({status: "success", data: appVersion});
  });

  // Sends "update available" to every user. Call it once the new version is
  // live on BOTH stores: Expo tokens don't tell us the device platform.
  notifyUpdate = catchAsync(async (req, res) => {
    const data = AppVersionNotifySchema.parse(req.body ?? {});
    const tokens = await repository.getActivePushTokens();

    // Runs in the background so large user lists don't time out the request.
    void broadcastPush(tokens, {
      title: data.title ?? "تحديث جديد متاح ⚡",
      body:
        data.content ?? "حدّث التطبيق الآن للحصول على أحدث المزايا والتحسينات",
      data: {type: "APP_UPDATE"},
    }).catch((error) => Logger.error("App update push failed", error));

    res.status(202).json({
      status: "success",
      data: {recipients: tokens.length},
    });
  });
}
