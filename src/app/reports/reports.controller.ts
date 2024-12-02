import { catchAsync } from "../../lib/catchAsync";
import type { loggedInUserType } from "../../types/user";
import {
    ReportCreateOrdersFiltersSchema,
    ReportCreateSchema,
    ReportUpdateSchema,
    ReportsFiltersSchema,
    ReportsReportPDFCreateSchema
} from "./reports.dto";
import { ReportsService } from "./reports.service";

const reportsService = new ReportsService();

export class ReportController {
    createReport = catchAsync(async (req, res) => {
        const reportData = ReportCreateSchema.parse(req.body);
        const loggedInUser = res.locals.user as loggedInUserType;

        const ordersFilters = ReportCreateOrdersFiltersSchema.parse({
            type: reportData.type,
            clientID: req.query.client_id,
            deliveryAgentID: req.query.delivery_agent_id,
            companyID: req.query.company_id,
            sort: "receiptNumber:asc",
            page: req.query.page,
            size: req.query.size,
            startDate: req.query.start_date,
            endDate: req.query.end_date,
            governorate: req.query.governorate,
            statuses: req.query.statuses,
            status: req.query.status,
            deliveryType: req.query.delivery_type,
            storeID: req.query.store_id,
            repositoryID: req.query.repository_id,
            branchID: req.query.branch_id,
            clientReport: req.query.client_report,
            repositoryReport: req.query.repository_report,
            branchReport: req.query.branch_report,
            deliveryAgentReport: req.query.delivery_agent_report,
            governorateReport: req.query.governorate_report,
            companyReport: req.query.company_report,
            minified: false,
            confirmed: req.query.confirmed
        });

        const pdf = await reportsService.createReport({
            loggedInUser,
            reportData,
            ordersFilters
        });

        res.contentType("application/pdf");
        res.send(pdf);

        // const chunks: Uint8Array[] = [];
        // let result: Buffer;

        // pdf.on("data", (chunk) => {
        //     chunks.push(chunk);
        // });

        // pdf.on("end", () => {
        //     result = Buffer.concat(chunks);
        //     res.contentType("application/pdf");
        //     res.send(result);
        // });

        // pdf.end();

        // res.status(200).json({
        //     status: "success",
        //     data: createdReport
        // });
    });

    getAllReports = catchAsync(async (req, res) => {
        const loggedInUser: loggedInUserType = res.locals.user;

        const filters = ReportsFiltersSchema.parse({
            page: req.query.page,
            size: req.query.size,
            company: req.query.company,
            branch: req.query.branch,
            sort: req.query.sort,
            startDate: req.query.start_date,
            endDate: req.query.end_date,
            governorate: req.query.governorate,
            status: req.query.status,
            type: req.query.type,
            types: req.query.types,
            storeID: req.query.store_id,
            repositoryID: req.query.repository_id,
            branchID: req.query.branch_id,
            deliveryAgentID: req.query.delivery_agent_id,
            companyID: req.query.company_id,
            clientID: req.query.client_id,
            createdByID: req.query.created_by_id,
            deleted: req.query.deleted,
            minified: req.query.minified
        });

        const { page, pagesCount, reports, reportsMetaData } = await reportsService.getAllReports({
            loggedInUser: loggedInUser,
            filters: filters
        });

        if (pagesCount === 0) {
            res.status(200).json({
                status: "success",
                page: 1,
                pagesCount: 1,
                data: {
                    reports: [],
                    reportsMetaData: {
                        reportsCount: 0,
                        totalCost: 0,
                        paidAmount: 0,
                        deliveryCost: 0,
                        baghdadOrdersCount: 0,
                        governoratesOrdersCount: 0,
                        clientNet: 0,
                        deliveryAgentNet: 0,
                        companyNet: 0
                    }
                }
            });
            return;
        }

        res.status(200).json({
            status: "success",
            page: page,
            pagesCount: pagesCount,
            data: {
                reports: reports,
                reportsMetaData: reportsMetaData
            }
        });
    });

    getReport = catchAsync(async (req, res) => {
        const params = { reportID: +req.params.reportID };

        const report = await reportsService.getReport({
            params: params
        });

        res.status(200).json({
            status: "success",
            data: report
        });
    });

    getReportPDF = catchAsync(async (req, res) => {
        const params = { reportID: +req.params.reportID };

        const pdf = await reportsService.getReportPDF({
            params: params
        });

        res.contentType("application/pdf");
        res.send(pdf);

        // const chunks: Uint8Array[] = [];
        // let result: Buffer;

        // pdf.on("data", (chunk) => {
        //     chunks.push(chunk);
        // });

        // pdf.on("end", () => {
        //     result = Buffer.concat(chunks);
        //     res.contentType("application/pdf");
        //     res.send(result);
        // });

        // pdf.end();
    });

    getReportsReportPDF = catchAsync(async (req, res) => {
        const reportsData = ReportsReportPDFCreateSchema.parse(req.body);

        const filters = ReportsFiltersSchema.parse({
            page: req.query.page,
            size: req.query.size,
            company: req.query.company,
            branch: req.query.branch,
            sort: "id:asc",
            startDate: req.query.start_date,
            endDate: req.query.end_date,
            governorate: req.query.governorate,
            status: req.query.status,
            type: req.query.type,
            storeID: req.query.store_id,
            repositoryID: req.query.repository_id,
            branchID: req.query.branch_id,
            deliveryAgentID: req.query.delivery_agent_id,
            companyID: req.query.company_id,
            clientID: req.query.client_id,
            createdByID: req.query.created_by_id,
            deleted: req.query.deleted,
            minified: false
        });

        const pdf = await reportsService.getReportsReportPDF({
            reportsData: reportsData,
            reportsFilters: filters
        });

        res.contentType("application/pdf");
        res.send(pdf);
    });

    updateReport = catchAsync(async (req, res) => {
        const loggedInUser = res.locals.user as loggedInUserType;
        const reportData = ReportUpdateSchema.parse(req.body);
        const params = { reportID: +req.params.reportID };

        const report = await reportsService.updateReport({
            params: params,
            reportData: reportData,
            loggedInUser: loggedInUser
        });

        res.status(200).json({
            status: "success",
            data: report
        });
    });

    deleteReport = catchAsync(async (req, res) => {
        const params = { reportID: +req.params.reportID };

        await reportsService.deleteReport({ params });

        res.status(200).json({
            status: "success"
        });
    });

    deactivateReport = catchAsync(async (req, res) => {
        const params = { reportID: +req.params.reportID };
        const loggedInUser = res.locals.user as loggedInUserType;

        await reportsService.deactivateReport({ params: params, loggedInUser });

        res.status(200).json({
            status: "success"
        });
    });

    reactivateReport = catchAsync(async (req, res) => {
        const params = { reportID: +req.params.reportID };

        await reportsService.reactivateReport({ params: params });

        res.status(200).json({
            status: "success"
        });
    });
}
