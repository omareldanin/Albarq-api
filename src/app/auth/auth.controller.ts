import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import {env} from "../../config";
import {AppError} from "../../lib/AppError";
import {catchAsync} from "../../lib/catchAsync";
import type {loggedInUserType} from "../../types/user";
import {sendNotification} from "../notifications/helpers/sendNotification";
import {UsersRepository} from "../users/users.repository";
import {ChangePasswordSchema, RefreshTokenSchema, UserSigninSchema} from "./auth.dto";
import {AuthRepository} from "./auth.repository";

const authModel = new AuthRepository();
const usersRepository = new UsersRepository();

export class AuthController {
  signin = catchAsync(async (req, res) => {
    const user = UserSigninSchema.parse(req.body);

    const returnedUser = await authModel.signin(user);

    if (!returnedUser) {
      throw new AppError(
        "حطأ في البيانات تاكد من ادخال البيانات بشكل صحيح",
        401,
      );
    }

    const isValidPassword = bcrypt.compareSync(
      user.password + (env.PASSWORD_SALT as string),
      returnedUser.password,
    );

    if (!isValidPassword) {
      throw new AppError(
        "حطأ في البيانات تاكد من ادخال البيانات بشكل صحيح",
        401,
      );
    }

    const token = jwt.sign(
      {
        id: returnedUser?.id,
        name: returnedUser.name,
        username: user.username,
        role: returnedUser.role,
        permissions: returnedUser.permissions,
        orderStatus: returnedUser.orderStatus,
        companyID: returnedUser.companyID,
        companyName: returnedUser.companyName,
        mainCompany: returnedUser.mainCompany,
        apiOnly: returnedUser.apiOnly,
        mainRepository: returnedUser.mainRepository,
        showTreatury: returnedUser.showTreatury,
        branchId: returnedUser.branchId,
        parentBranchId: returnedUser.parentBranchId,
        repositoryId: returnedUser.repositoryId,
        type: returnedUser.type,
        clientId: returnedUser.clientId,
        repository: returnedUser.repository,
      } as loggedInUserType,
      env.ACCESS_TOKEN_SECRET as string,
      {expiresIn: env.ACCESS_TOKEN_EXPIRES_IN},
    );

    const refreshToken = jwt.sign(
      {
        id: returnedUser?.id,
      },
      env.REFRESH_TOKEN_SECRET as string,
      {expiresIn: env.REFRESH_TOKEN_EXPIRES_IN},
    );

    await usersRepository.updateUser({
      userID: returnedUser.id,
      userData: {refreshToken},
    });

    res.cookie("jwt", token, {
      httpOnly: true,
      secure: true,
      // expires: JWT_EXPIRES_IN
    });
    res.setHeader("Authorization", `Bearer ${token}`);

    res.status(201).json({
      status: "success",
      token: token,
      refreshToken: refreshToken,
    });
    if (user.fcm) {
      await usersRepository.updateUser({
        userID: returnedUser.id,
        userData: {fcm: user.fcm},
      });
    }

    await sendNotification({
      userID: returnedUser.id,
      title: "تم تسجيل الدخول",
      content: "",
    });

    // Update user login history
    await usersRepository.logUserLogin(
      returnedUser.id,
      returnedUser.companyID || 0,
      {
        ip: user.ip,
        device: user.device,
        platform: user.platform,
        browser: user.browser,
        location: user.location,
      },
    );
  });

  refreshToken = catchAsync(async (req, res) => {
    try {
      const refreshToken = RefreshTokenSchema.parse(req.body).refreshToken;

      // 1) Check if token is valid
      const decoded = jwt.verify(
        refreshToken,
        env.REFRESH_TOKEN_SECRET as string,
      ) as {
        id: number;
      };

      // 2) Check if refresh token is in the database
      const refreshTokens = await usersRepository.getUserRefreshTokens(
        decoded.id,
      );
      if (!refreshTokens || !refreshTokens.includes(refreshToken)) {
        throw new AppError("الرجاء تسجيل الدخول", 401);
      }

      // 3) Create new access token
      const user = await authModel.getUserByID(decoded.id);

      if (!user) {
        throw new AppError("الرجاء تسجيل الدخول", 401);
      }

      const token = jwt.sign(
        {
          id: user?.id,
          name: user.name,
          username: user.username,
          role: user.role,
          permissions: user.permissions,
          orderStatus: user.orderStatus,
          companyID: user.companyID,
          companyName: user.companyName,
          mainCompany: user.mainCompany,
          apiOnly: user.apiOnly,
          mainRepository: user.mainRepository,
          branchId: user.branchId,
          repositoryId: user.repositoryId,
          type: user.type,
          clientId: user.clientId,
          repository: user.repository,
          parentBranchId: user.parentBranchId,
          showTreatury: user.showTreatury,
        } as loggedInUserType,
        env.ACCESS_TOKEN_SECRET as string,
        {expiresIn: env.ACCESS_TOKEN_EXPIRES_IN},
      );

      res.cookie("jwt", token, {
        httpOnly: true,
        secure: true,
        // expires: JWT_EXPIRES_IN
      });
      res.setHeader("Authorization", `Bearer ${token}`);

      res.status(201).json({
        status: "success",
        token: token,
        // refreshToken: newRefreshToken,
      });
    } catch (err) {
      throw new AppError("الرجاء تسجيل الدخول", 401);
    }
  });

  // Client changes their own password (needs the current one).
  changePassword = catchAsync(async (req, res) => {
    const user = res.locals.user as loggedInUserType;
    const parsed = ChangePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? "بيانات غير صحيحة", 400);
    }
    const {currentPassword, newPassword} = parsed.data;

    const hash = await authModel.getPasswordHash(user.id);
    const salt = env.PASSWORD_SALT as string;
    if (!hash || !bcrypt.compareSync(currentPassword + salt, hash)) {
      throw new AppError("كلمة المرور الحالية غير صحيحة", 400);
    }

    await authModel.setPassword(user.id, bcrypt.hashSync(newPassword + salt, 12));

    res.status(200).json({status: "success"});

    // Security notice on the account (after responding)
    await sendNotification({
      userID: user.id,
      title: "تم تغيير كلمة المرور",
      content: "إذا لم تقم بذلك، تواصل مع الشركة فوراً",
    });
  });

  signout = catchAsync(async (_req, res) => {
    const user = res.locals.user as loggedInUserType;
    await authModel.signoutUser(user.id);
    res.clearCookie("jwt");
    res.status(200).json({
      status: "success",
    });
  });

  signoutUser = catchAsync(async (req, res) => {
    const userID = +req.params.userID;
    await authModel.signoutUser(userID);
    res.status(200).json({
      status: "success",
    });
  });
}
