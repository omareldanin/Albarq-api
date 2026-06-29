"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const orders_routes_1 = __importDefault(require("../../app/externalOrders/orders.routes"));
const router = (0, express_1.Router)();
router.use("/", orders_routes_1.default);
exports.default = router;
//# sourceMappingURL=index.js.map