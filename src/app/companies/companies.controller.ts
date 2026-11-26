import * as bcrypt from "bcrypt";
import { env } from "../../config";
import { AppError } from "../../lib/AppError";
import { catchAsync } from "../../lib/catchAsync";
import type { loggedInUserType } from "../../types/user";
import { EmployeesRepository } from "../employees/employees.repository";
import { CompanyCreateSchema, CompanyUpdateSchema } from "./companies.dto";
import { CompaniesRepository } from "./companies.repository";
import crypto from "crypto";
import { prisma } from "../../database/db";

const companiesRepository = new CompaniesRepository();
const employeesRepository = new EmployeesRepository();

/** Makes a new API key for a company. Only its hash is stored; the old key stops working. */
const issueCompanyApiKey = async (companyID: number) => {
  const rawApiKey = `albarq_live_${crypto.randomBytes(32).toString("hex")}`;
  const apiKeyHash = crypto.createHash("sha256").update(rawApiKey).digest("hex");
  await prisma.company.update({
    where: { id: companyID },
    data: { apiKeyHash },
  });
  return rawApiKey;
};

/**
 * The logged-in manager's company, when it can send orders through the API
 * (a partner/external company linked to the company that delivers its orders).
 */
const getMyIntegrationCompany = async (loggedInUser: loggedInUserType) => {
  if (!loggedInUser.companyID) {
    throw new AppError("ليس لديك صلاحية القيام بهذا الفعل", 403);
  }
  const company = await prisma.company.findUnique({
    where: { id: loggedInUser.companyID },
    select: {
      id: true,
      name: true,
      apiKeyHash: true,
      apiOnly: true,
      isExternal: true,
      targetCompanyId: true,
      webhookUrl: true,
    },
  });
  if (!company) {
    throw new AppError("company not found", 404);
  }
  if (!company.targetCompanyId || !(company.apiOnly || company.isExternal)) {
    throw new AppError("هذه الشركة غير مفعّلة للربط عبر API", 403);
  }
  return company;
};

export class CompaniesController {
  createCompany = catchAsync(async (req, res) => {
    const loggedInUser = res.locals.user as loggedInUserType;
    const companyData = CompanyCreateSchema.parse(req.body);

    if (
      companyData.companyData.apiOnly &&
      !companyData.companyData.companyID &&
      loggedInUser.role !== "COMPANY_MANAGER"
    ) {
      throw new AppError(
        "اختر الشركة التابعة التي تستلم طلبات هذه الشركة",
        400,
      );
    }

    let logo: string | undefined;
    if (req.file) {
      const file = req.file as Express.MulterS3.File;
      logo = file.location;
    }

    const hashedPassword = bcrypt.hashSync(
      companyData.companyManager.password + (env.PASSWORD_SALT as string),
      12,
    );

    const createdCompany = await companiesRepository.createCompany({
      loggedInUser: loggedInUser,
      companyData: {
        companyData: { ...companyData.companyData, logo },
        companyManager: {
          ...companyData.companyManager,
          password: hashedPassword,
          avatar: logo,
        },
      },
    });

    res.status(200).json({
      status: "success",
      data: createdCompany,
    });
  });

  generateApikey = catchAsync(async (req, res) => {
    const { id } = req.body;

    if (!id) {
      throw new AppError("Client name and permissions are required", 400);
    }

    const company = await companiesRepository.getCompany({
      companyID: id,
    });

    if (!company) {
      throw new AppError("company not found", 404);
    }

    const rawApiKey = await issueCompanyApiKey(company.id);

    res.status(200).json({
      status: "success",
      apiKey: rawApiKey,
    });
  });

  // ---- Self-service API key of a partner company (integration docs page) ----

  getMyApiKeyStatus = catchAsync(async (_req, res) => {
    const loggedInUser = res.locals.user as loggedInUserType;
    const company = await getMyIntegrationCompany(loggedInUser);
    const targetCompany = company.targetCompanyId
      ? await prisma.company.findUnique({
          where: { id: company.targetCompanyId },
          select: { name: true },
        })
      : null;

    res.status(200).json({
      status: "success",
      data: {
        hasKey: !!company.apiKeyHash,
        companyName: company.name,
        targetCompanyName: targetCompany?.name ?? null,
        // Where status updates are sent; set by Albarq. The bearer token is never returned.
        webhookUrl: company.webhookUrl ?? null,
      },
    });
  });

  generateMyApiKey = catchAsync(async (_req, res) => {
    const loggedInUser = res.locals.user as loggedInUserType;
    const company = await getMyIntegrationCompany(loggedInUser);
    // Replaces any previous key: the old one stops working immediately.
    const rawApiKey = await issueCompanyApiKey(company.id);
    res.status(200).json({
      status: "success",
      apiKey: rawApiKey,
    });
  });

  revokeMyApiKey = catchAsync(async (_req, res) => {
    const loggedInUser = res.locals.user as loggedInUserType;
    const company = await getMyIntegrationCompany(loggedInUser);
    await prisma.company.update({
      where: { id: company.id },
      data: { apiKeyHash: null },
    });
    res.status(200).json({ status: "success" });
  });

  getAllCompanies = catchAsync(async (req, res) => {
    const loggedInUser = res.locals.user as loggedInUserType;

    const minified = req.query.minified
      ? req.query.minified === "true"
      : undefined;

    const mainCompany = req.query.main_company
      ? req.query.main_company === "true"
      : undefined;
    let size = req.query.size ? +req.query.size : 10;
    if (size > 500 && minified !== true) {
      size = 10;
    }

    let page = 1;
    if (
      req.query.page &&
      !Number.isNaN(+req.query.page) &&
      +req.query.page > 0
    ) {
      page = +req.query.page;
    }

    const { companies, pagesCount } =
      await companiesRepository.getAllCompaniesPaginated(
        {
          page: page,
          size: size,
          minified: minified,
          mainCompany: mainCompany,
        },
        loggedInUser,
      );

    res.status(200).json({
      status: "success",
      page: page,
      pagesCount: pagesCount,
      data: companies,
    });
  });

  getCompany = catchAsync(async (req, res) => {
    const companyID = +req.params.companyID;

    const company = await companiesRepository.getCompany({
      companyID: +companyID,
    });

    res.status(200).json({
      status: "success",
      data: company,
    });
  });

  updateCompany = catchAsync(async (req, res) => {
    const companyID = +req.params.companyID;
    const companyData = CompanyUpdateSchema.parse(req.body);

    let logo: string | undefined;
    if (req.file) {
      const file = req.file as Express.MulterS3.File;
      logo = file.location;
    }

    const companyManagerID = (
      await employeesRepository.getCompanyManager({
        companyID: +companyID,
      })
    ).id;
    if (!companyManagerID) {
      throw new AppError("لا يوجد مدير لهذه الشركة", 404);
    }
    companyData.companyManagerID = companyManagerID;

    if (companyData.password) {
      const hashedPassword = bcrypt.hashSync(
        companyData.password + (env.PASSWORD_SALT as string),
        12,
      );
      companyData.password = hashedPassword;
    }

    const company = await companiesRepository.updateCompany({
      companyID: +companyID,
      companyData: { ...companyData, logo },
    });

    res.status(200).json({
      status: "success",
      data: company,
    });
  });

  deleteCompany = catchAsync(async (req, res) => {
    const companyID = +req.params.companyID;

    await companiesRepository.deleteCompany({
      companyID: +companyID,
    });

    res.status(200).json({
      status: "success",
    });
  });
}
