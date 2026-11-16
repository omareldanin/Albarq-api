"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const express_1 = require("express");
const isAutherized_1 = require("../../middlewares/isAutherized");
const isLoggedIn_1 = require("../../middlewares/isLoggedIn");
const appVersions_controller_1 = require("./appVersions.controller");
const router = (0, express_1.Router)();
const controller = new appVersions_controller_1.AppVersionsController();
router
    .route("/app-version")
    .get(controller.getAppVersion)
    .put(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([client_1.AdminRole.ADMIN]), controller.upsertAppVersion);
router.route("/app-version/notify").post(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([client_1.AdminRole.ADMIN]), controller.notifyUpdate);
exports.default = router;
//# sourceMappingURL=appVersions.routes.js.map