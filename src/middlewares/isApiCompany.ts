import type { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/AppError";
import type { loggedInUserType } from "../types/user";
import { prisma } from "../database/db";
import crypto from "crypto";

export const isApiCompany = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const apiKey = req.header("x-api-key");

  if (!apiKey) {
    return next(new AppError("API Key required", 401));
  }

  const apiKeyHash = crypto.createHash("sha256").update(apiKey).digest("hex");

  const company = await prisma.company.findFirst({
    where: { apiKeyHash },
    select: {
      id: true,
      name: true,
      targetCompanyId: true,
    },
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
