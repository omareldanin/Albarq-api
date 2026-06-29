import type {NextFunction, Request, Response} from "express";
import {AppError} from "../lib/AppError";
import type {loggedInUserType} from "../types/user";
import {prisma} from "../database/db";
import crypto from "crypto";

export const isApiCompany = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const apiKey = req.header("x-api-key");
  const authToken = req.headers.authorization?.replace("Bearer ", "");

  if (apiKey && authToken && apiKey !== authToken) {
    return next(new AppError("Conflicting credentials", 401));
  }

  const secret = apiKey ?? authToken;

  if (!secret) {
    return res.status(401).json({
      success: false,
      message: "Invalid authentication token",
    });
  }

  const apiKeyHash = crypto.createHash("sha256").update(secret).digest("hex");

  const company = await prisma.company.findFirst({
    where: {apiKeyHash},
    select: {id: true, name: true, targetCompanyId: true},
  });

  if (!company) {
    return next(new AppError("Invalid API Key", 401));
  }

  res.locals.user = {
    id: company.id,
    name: company.name,
    companyID: company.targetCompanyId,
  } as loggedInUserType;

  next();
};
