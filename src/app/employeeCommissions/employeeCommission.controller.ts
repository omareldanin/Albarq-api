import {prisma} from "../../database/db";
import {catchAsync} from "../../lib/catchAsync";
import {loggedInUserType} from "../../types/user";
import {generateEmployeeReport} from "../reports/helpers/generateEmployeeReport";
import {reportReform, reportSelect} from "../reports/reports.responses";
import {EmployeeClientCommissionRepository} from "./employeeCommission.repository";
import {EmployeeClientCommissionUpsertSchema} from "./employeeCommissions.dto";

const repository = new EmployeeClientCommissionRepository();

export class EmployeeClientCommissionController {
  getEmployeeClients = catchAsync(async (req, res) => {
    const employeeID = +req.params.employeeID;
    const data = await repository.getEmployeeClients({employeeID});
    res.status(200).json({status: "success", data});
  });

  upsertEmployeeClient = catchAsync(async (req, res) => {
    const employeeID = +req.params.employeeID;
    const data = EmployeeClientCommissionUpsertSchema.parse(req.body);
    const result = await repository.upsertEmployeeClient({employeeID, data});
    res.status(200).json({status: "success", data: result});
  });

  deleteEmployeeClient = catchAsync(async (req, res) => {
    const employeeID = +req.params.employeeID;
    const clientID = +req.params.clientID;
    await repository.deleteEmployeeClient({employeeID, clientID});
    res.status(200).json({status: "success"});
  });

  getEmployeeCommission = catchAsync(async (req, res) => {
    const employeeID = +req.params.employeeID;
    const startDate = req.query.start_date
      ? new Date(req.query.start_date as string)
      : undefined;
    const endDate = req.query.end_date
      ? new Date(req.query.end_date as string)
      : undefined;

    const data = await repository.calculateEmployeeCommission({
      employeeID,
      startDate,
      endDate,
    });

    res.status(200).json({status: "success", data});
  });

  createReport = catchAsync(async (req, res) => {
    const loggedInUser = res.locals.user as loggedInUserType;

    const employeeID = +req.params.employeeID;
    const startDate = req.query.start_date
      ? new Date(req.query.start_date as string)
      : undefined;
    const endDate = req.query.end_date
      ? new Date(req.query.end_date as string)
      : undefined;

    const data = await repository.createReport({
      employeeID,
      startDate,
      endDate,
      loggedInUser,
    });

    const report = await prisma.report.findUnique({
      where: {
        id: data.id,
      },
      select: reportSelect,
    });

    const reportData = reportReform(report);

    const pdf = await generateEmployeeReport(reportData, data.data.details);

    const pdfBuffer = Buffer.isBuffer(pdf) ? pdf : Buffer.from(pdf);
    // Set headers for a PDF response
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=generated.pdf");
    console.log("PDF size:", pdfBuffer.length);

    res.send(pdfBuffer);
  });
}
