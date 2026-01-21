import axios from "axios";
import {normalizePhone} from "./normalizePhone";

const GRAPH_VERSION = "v22.0";
const PHONE_NUMBER_ID = process.env.WA_PHONE_NUMBER_ID!;
const TOKEN = process.env.WA_TOKEN!;

type OrderTemplateParams = {
  storeName: string;
  customerName: string;
  orderNumber: string;
  phone: string;
  price: string;
  address: string;
  notes: string;
};

export async function sendOrderProcessingTemplate(
  rawPhone: string,
  params: OrderTemplateParams,
) {
  const to = normalizePhone(rawPhone);
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
      language: {code: "ar"},
      components: [
        {
          type: "body",
          parameters: [
            {type: "text", text: params.storeName},
            {type: "text", text: params.customerName},
            {type: "text", text: params.orderNumber},
            {type: "text", text: params.phone},
            {type: "text", text: params.price},
            {type: "text", text: params.address},
            {type: "text", text: params.notes},
          ],
        },
      ],
    },
  };

  const res = await axios.post(url, payload, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    timeout: 15000,
  });
  console.log(res.status);
  console.log(res.statusText);

  return res.data; // يحتوي wamid
}
