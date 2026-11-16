"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppVersionsController = void 0;
const catchAsync_1 = require("../../lib/catchAsync");
const logger_1 = require("../../lib/logger");
const appVersions_dto_1 = require("./appVersions.dto");
const appVersions_push_1 = require("./appVersions.push");
const appVersions_repository_1 = require("./appVersions.repository");
const repository = new appVersions_repository_1.AppVersionsRepository();
class AppVersionsController {
    // Public: the app checks this on launch, before or after login.
    getAppVersion = (0, catchAsync_1.catchAsync)(async (req, res) => {
        const { platform } = appVersions_dto_1.AppVersionQuerySchema.parse(req.query);
        const data = platform
            ? await repository.getAppVersion(platform)
            : await repository.getAllAppVersions();
        res.status(200).json({ status: "success", data });
    });
    upsertAppVersion = (0, catchAsync_1.catchAsync)(async (req, res) => {
        const data = appVersions_dto_1.AppVersionUpsertSchema.parse(req.body);
        const appVersion = await repository.upsertAppVersion(data);
        res.status(200).json({ status: "success", data: appVersion });
    });
    // Sends "update available" to every user. Call it once the new version is
    // live on BOTH stores: Expo tokens don't tell us the device platform.
    notifyUpdate = (0, catchAsync_1.catchAsync)(async (req, res) => {
        const data = appVersions_dto_1.AppVersionNotifySchema.parse(req.body ?? {});
        const tokens = await repository.getActivePushTokens();
        // Runs in the background so large user lists don't time out the request.
        void (0, appVersions_push_1.broadcastPush)(tokens, {
            title: data.title ?? "تحديث جديد متاح ⚡",
            body: data.content ?? "حدّث التطبيق الآن للحصول على أحدث المزايا والتحسينات",
            data: { type: "APP_UPDATE" },
        }).catch((error) => logger_1.Logger.error("App update push failed", error));
        res.status(202).json({
            status: "success",
            data: { recipients: tokens.length },
        });
    });
}
exports.AppVersionsController = AppVersionsController;
//# sourceMappingURL=appVersions.controller.js.map