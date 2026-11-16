import {AdminRole} from "@prisma/client";
import {Router} from "express";
import {isAutherized} from "../../middlewares/isAutherized";
import {isLoggedIn} from "../../middlewares/isLoggedIn";
import {AppVersionsController} from "./appVersions.controller";

const router = Router();
const controller = new AppVersionsController();

router
  .route("/app-version")
  .get(
    controller.getAppVersion,
    /*
      #swagger.tags = ['App Version']
      #swagger.summary = 'Latest store version (public, used by the mobile app)'
      #swagger.parameters['platform'] = {in: 'query', type: 'string', enum: ['ios', 'android'], description: 'Omit to get both platforms'}
    */
  )
  .put(
    isLoggedIn,
    isAutherized([AdminRole.ADMIN]),
    controller.upsertAppVersion,
    /*
      #swagger.tags = ['App Version']
      #swagger.summary = 'Set the latest / minimum version for a platform'
      #swagger.description = 'Call after the new build is live on the store. Installed versions below latestVersion get an optional update dialog; below minVersion the dialog cannot be dismissed. storeUrl is required the first time a platform is added.'
      #swagger.requestBody = {required: true, content: {"application/json": {schema: {type: 'object', required: ['platform', 'latestVersion'], properties: {platform: {type: 'string', enum: ['IOS', 'ANDROID']}, latestVersion: {type: 'string', example: '2.4.0'}, minVersion: {type: 'string', example: '2.0.0'}, storeUrl: {type: 'string', example: 'https://play.google.com/store/apps/details?id=com.delivery.iq'}, releaseNotes: {type: 'string', example: 'تحسينات في المحادثة والكشوفات'}}}}}}
    */
  );

router.route("/app-version/notify").post(
  isLoggedIn,
  isAutherized([AdminRole.ADMIN]),
  controller.notifyUpdate,
  /*
    #swagger.tags = ['App Version']
    #swagger.summary = 'Push "update available" to all users'
    #swagger.description = 'Sends to every active user. Call once the version is live on both stores. Tapping the notification opens the store when the device has an update.'
    #swagger.requestBody = {required: false, content: {"application/json": {schema: {type: 'object', properties: {title: {type: 'string'}, content: {type: 'string'}}}}}}
  */
);

export default router;
