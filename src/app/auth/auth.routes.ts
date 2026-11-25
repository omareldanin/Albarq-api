import {Router} from "express";

import {AuthController} from "./auth.controller";

import {isAutherized} from "../../middlewares/isAutherized";
import {isLoggedIn} from "../../middlewares/isLoggedIn";

const router = Router();
const authController = new AuthController();

router.route("/auth/signin").post(authController.signin);

router.route("/auth/validate-token").post(isLoggedIn, (_req, res) => {
  res.status(200).json({
    status: "valid",
  });
});

router.route("/auth/refresh-token").post(
  authController.refreshToken,
  /*
        #swagger.tags = ['Auth Routes']
    */
);

router.route("/auth/change-password").patch(
  isLoggedIn,
  isAutherized(["CLIENT"]),
  authController.changePassword,
  /*
        #swagger.tags = ['Auth Routes']
        #swagger.summary = 'Client changes their own password'
        #swagger.description = 'Clients only. Checks currentPassword, sets newPassword (min 6, must differ) and signs out other sessions (refresh tokens cleared). Staff still reset client passwords from PATCH /clients/:id.'
        #swagger.requestBody = {required: true, content: {"application/json": {schema: {type: 'object', required: ['currentPassword', 'newPassword'], properties: {currentPassword: {type: 'string'}, newPassword: {type: 'string', minLength: 6}}}}}}
        #swagger.responses[400] = {description: 'Wrong current password or invalid new password'}
  */
);

router.route("/auth/signout").post(
  isLoggedIn,
  authController.signout,
  /*
        #swagger.tags = ['Auth Routes']
    */
);

router.route("/auth/signout/:userID").post(
  isLoggedIn,
  isAutherized(["ADMIN", "ADMIN_ASSISTANT", "COMPANY_MANAGER"]),
  authController.signoutUser,
  /*
        #swagger.tags = ['Auth Routes']
    */
);

export default router;
