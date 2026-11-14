import {catchAsync} from "../../lib/catchAsync";
import type {loggedInUserType} from "../../types/user";
import {
  ReceivingReportCreateSchema,
  ReceivingReportParamsSchema,
  ReceivingReportsListSchema,
} from "./receivingReports.dto";
import {generateReceivingReportPDF} from "./receivingReports.pdf";
import {ReceivingReportsRepository} from "./receivingReports.repository";

const repository = new ReceivingReportsRepository();

export class ReceivingReportsController {
  createReports = catchAsync(async (req, res) => {
    const data = ReceivingReportCreateSchema.parse(req.body ?? {});
    const reports = await repository.createReports(
      res.locals.user as loggedInUserType,
      data,
    );
    res.status(201).json({status: "success", data: reports});
  });

  getReports = catchAsync(async (req, res) => {
    const filters = ReceivingReportsListSchema.parse(req.query);
    const result = await repository.getReports(
      res.locals.user as loggedInUserType,
      filters,
    );
    res.status(200).json({status: "success", ...result});
  });

  getReportPDF = catchAsync(async (req, res) => {
    const {reportID} = ReceivingReportParamsSchema.parse(req.params);
    const data = await repository.getReportWithOrders(
      res.locals.user as loggedInUserType,
      reportID,
    );
    const pdf = await generateReceivingReportPDF(data);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="receiving-report-${reportID}.pdf"`,
    );
    res.setHeader("Cache-Control", "private, no-store");
    res.status(200).send(Buffer.from(pdf));
  });
}
