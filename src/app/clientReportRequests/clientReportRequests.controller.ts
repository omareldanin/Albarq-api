import { catchAsync } from "../../lib/catchAsync";
import type { loggedInUserType } from "../../types/user";
import {
    ReportRequestCreateSchema,
    ReportRequestParamsSchema,
    ReportRequestRejectSchema,
    ReportRequestsListSchema
} from "./clientReportRequests.dto";
import { ClientReportRequestsRepository } from "./clientReportRequests.repository";

const repository = new ClientReportRequestsRepository();
const user = (res: { locals: Record<string, unknown> }) => res.locals.user as loggedInUserType;

export class ClientReportRequestsController {
    getPreview = catchAsync(async (_req, res) => {
        const data = await repository.getPreview(user(res));
        res.status(200).json({ status: "success", data });
    });

    createRequest = catchAsync(async (req, res) => {
        const data = ReportRequestCreateSchema.parse(req.body);
        const request = await repository.createRequest(user(res), data);
        res.status(201).json({ status: "success", data: request });
    });

    getMyRequests = catchAsync(async (_req, res) => {
        const data = await repository.getMyRequests(user(res));
        res.status(200).json({ status: "success", data });
    });

    cancelRequest = catchAsync(async (req, res) => {
        const { requestID } = ReportRequestParamsSchema.parse(req.params);
        await repository.cancelRequest(user(res), requestID);
        res.status(200).json({ status: "success" });
    });

    getRequests = catchAsync(async (req, res) => {
        const filters = ReportRequestsListSchema.parse(req.query);
        const result = await repository.getRequests(user(res), filters);
        res.status(200).json({ status: "success", ...result });
    });

    getRequestPdf = catchAsync(async (req, res) => {
        const { requestID } = ReportRequestParamsSchema.parse(req.params);
        const pdf = await repository.getRequestPdf(user(res), requestID);
        const pdfBuffer = Buffer.isBuffer(pdf) ? pdf : Buffer.from(pdf);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename=account-request-${requestID}.pdf`);
        res.send(pdfBuffer);
    });

    approveRequest = catchAsync(async (req, res) => {
        const { requestID } = ReportRequestParamsSchema.parse(req.params);
        const data = await repository.approveRequest(user(res), requestID);
        res.status(200).json({ status: "success", data });
    });

    rejectRequest = catchAsync(async (req, res) => {
        const { requestID } = ReportRequestParamsSchema.parse(req.params);
        const { reason } = ReportRequestRejectSchema.parse(req.body);
        await repository.rejectRequest(user(res), requestID, reason);
        res.status(200).json({ status: "success" });
    });
}
