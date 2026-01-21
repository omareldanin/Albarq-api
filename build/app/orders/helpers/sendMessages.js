"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendOrderProcessingTemplate = sendOrderProcessingTemplate;
const axios_1 = __importDefault(require("axios"));
const normalizePhone_1 = require("./normalizePhone");
const GRAPH_VERSION = "v22.0";
const PHONE_NUMBER_ID = process.env.WA_PHONE_NUMBER_ID;
const TOKEN = process.env.WA_TOKEN;
async function sendOrderProcessingTemplate(rawPhone, params) {
    const to = (0, normalizePhone_1.normalizePhone)(rawPhone);
    if (!to) {
        throw new Error(`Invalid phone number: ${rawPhone}`);
    }
    const url = `https://graph.facebook.com/${GRAPH_VERSION}/${PHONE_NUMBER_ID}/messages`;
    const payload = {
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
            name: "order_processing_notification",
            language: { code: "ar" },
            components: [
                {
                    type: "body",
                    parameters: [
                        { type: "text", text: params.storeName },
                        { type: "text", text: params.customerName },
                        { type: "text", text: params.orderNumber },
                        { type: "text", text: params.phone },
                        { type: "text", text: params.price },
                        { type: "text", text: params.address },
                        { type: "text", text: params.notes },
                    ],
                },
            ],
        },
    };
    const res = await axios_1.default.post(url, payload, {
        headers: {
            Authorization: `Bearer ${TOKEN}`,
            "Content-Type": "application/json",
        },
        timeout: 15000,
    });
    return res.data; // يحتوي wamid
}
//# sourceMappingURL=sendMessages.js.map