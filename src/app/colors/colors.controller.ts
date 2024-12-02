// import { AdminRole } from "@prisma/client";
import { catchAsync } from "../../lib/catchAsync";
// import type { loggedInUserType } from "../../types/user";
import { ColorCreateSchema, ColorUpdateSchema } from "./colors.dto";
import { ColorsRepository } from "./colors.repository";

const colorsRepository = new ColorsRepository();
export class ColorsController {
    createColor = catchAsync(async (req, res) => {
        const colorData = ColorCreateSchema.parse(req.body);
        // const companyID = +res.locals.user.companyID;

        const createdColor = await colorsRepository.createColor(colorData);

        res.status(200).json({
            status: "success",
            data: createdColor
        });
    });

    getAllColors = catchAsync(async (req, res) => {
        // Filters
        // const loggedInUser = res.locals.user as loggedInUserType;
        // let companyID: number | undefined;
        // if (Object.keys(AdminRole).includes(loggedInUser.role)) {
        //     companyID = req.query.company_id ? +req.query.company_id : undefined;
        // } else if (loggedInUser.companyID) {
        //     companyID = loggedInUser.companyID;
        // }

        const minified = req.query.minified ? req.query.minified === "true" : undefined;

        let size = req.query.size ? +req.query.size : 10;
        if (size > 500 && minified !== true) {
            size = 10;
        }
        let page = 1;
        if (req.query.page && !Number.isNaN(+req.query.page) && +req.query.page > 0) {
            page = +req.query.page;
        }

        const { colors, pagesCount } = await colorsRepository.getAllColorsPaginated({
            page: page,
            size: size,
            // companyID: companyID,
            minified: minified
        });

        res.status(200).json({
            status: "success",
            page: page,
            pagesCount: pagesCount,
            data: colors
        });
    });

    getColor = catchAsync(async (req, res) => {
        const colorID = +req.params.colorID;

        const color = await colorsRepository.getColor({
            colorID: colorID
        });

        res.status(200).json({
            status: "success",
            data: color
        });
    });

    updateColor = catchAsync(async (req, res) => {
        const colorID = +req.params.colorID;

        const colorData = ColorUpdateSchema.parse(req.body);

        const color = await colorsRepository.updateColor({
            colorID: colorID,
            colorData: colorData
        });

        res.status(200).json({
            status: "success",
            data: color
        });
    });

    deleteColor = catchAsync(async (req, res) => {
        const colorID = +req.params.colorID;

        await colorsRepository.deleteColor({
            colorID: colorID
        });

        res.status(200).json({
            status: "success"
        });
    });
}
