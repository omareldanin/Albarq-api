import {OrderStatus} from "@prisma/client";
import {AppError} from "../lib/AppError";
import {toExternalAction} from "./externalStatus";

/**
 * Extra fields sent alongside a status update. Which ones are required
 * depends on the action:
 *  - POSTPONED            -> postponed_date_id is required (1=tomorrow, 2=2 days, 3=3+ days)
 *  - RETURNED_WITH_AGENT  -> return_reason(_en/_ku) recommended
 *  - PARTIAL_DELIVERY     -> quantity_delivered / quantity_returned
 *  - SUCCESSFUL_DELIVERY  -> proof_image_url, received_by_name, GPS (optional)
 */
export interface StatusUpdateDetails {
  note?: string;
  // delivery
  proof_image_url?: string;
  received_by_name?: string;
  delivery_latitude?: number;
  delivery_longitude?: number;
  // postponed
  postponed_reason?: string;
  postponed_reason_en?: string;
  postponed_reason_ku?: string;
  postponed_date_id?: number;
  // return
  return_reason?: string;
  return_reason_en?: string;
  return_reason_ku?: string;
  treated_message?: string;
  // partial
  is_partial?: boolean;
  quantity_delivered?: number;
  quantity_returned?: number;
  partial_return_action?: string;
  [key: string]: unknown;
}

// ── Token cache ────────────────────────────────────────────────

// ── Token cache, keyed per credential set ──────────────────────
interface CachedToken {
  token: string;
  expiry: number;
}

const tokenCache = new Map<string, CachedToken>();

const cacheKey = (url: string, username: string) => `${url}::${username}`;

interface LoginResponse {
  token: string;
  expires_in: number;
}

async function loginToJenni(
  url: string,
  username: string,
  password: string,
): Promise<string> {
  const {gotScraping} = await import("got-scraping");

  try {
    const {body} = (await gotScraping.post(`${url}/v2/auth/login`, {
      json: {username, password},
      responseType: "json",
    })) as {body: LoginResponse};

    tokenCache.set(cacheKey(url, username), {
      token: body.token,
      expiry: Date.now() + body.expires_in * 1000,
    });

    return body.token;
  } catch (error: any) {
    throw new AppError(
      `فشل تسجيل الدخول إلى النظام الخارجي: ${
        error?.response?.data?.message ?? error?.message ?? "unknown"
      }`,
      502,
    );
  }
}

async function ensureValidToken(
  url: string,
  username: string,
  password: string,
): Promise<string> {
  const key = cacheKey(url, username);
  const cached = tokenCache.get(key);

  // refresh 5 minutes before expiry
  if (cached && Date.now() < cached.expiry - 5 * 60 * 1000) {
    return cached.token;
  }

  return loginToJenni(url, username, password);
}

const POSTPONED_DATE_ID_MAP: Record<string, number> = {
  "مؤجل غدا": 1, // tomorrow
  "مؤجل ليلا": 1, // tonight → treat as tomorrow (soonest bucket)
  "مؤجل لأكثر من يوم": 3, // more than a day → 3+ days
};

export function toPostponedDateId(
  value: string | undefined,
): number | undefined {
  if (!value) return undefined;
  return POSTPONED_DATE_ID_MAP[value];
}

/** Remove keys whose value is undefined (or null) so they aren't sent in the payload. */
function stripEmpty<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== null),
  ) as Partial<T>;
}

// ── Core sender ────────────────────────────────────────────────
/**
 * Send a single status update to Jenni using an already-resolved action code.
 * Prefer `updateExternalOrderStatus` which maps from the internal OrderStatus.
 */
export async function sendStatusUpdateToJenni(
  shipmentId: number,
  url: string,
  actionCode: string,
  details: StatusUpdateDetails = {},
  username: string,
  password: string,
  registrationText: string,
) {
  let token = await ensureValidToken(url, username, password);

  const payload = {
    system_code: registrationText,
    updates: [
      {
        shipment_id: shipmentId,
        action_code: actionCode,
        ...stripEmpty(details),
      },
    ],
  };

  const post = async (bearer: string) => {
    const {gotScraping} = await import("got-scraping");
    const {body} = await gotScraping.post(`${url}/v2/push/update-status`, {
      json: payload,
      responseType: "json",
      headers: {
        Authorization: `${bearer}`,
        "Content-Type": "application/json",
      },
    });
    console.log(body);

    return body;
  };

  try {
    return await post(token);
  } catch (error: any) {
    // token may have expired mid-flight — re-login once and retry
    if (
      error?.response?.statusCode === 401 ||
      error?.response?.status === 401
    ) {
      tokenCache.delete(cacheKey(url, username));
      token = await loginToJenni(url, username, password);
      return await post(token);
    }

    throw new AppError(
      `فشل إرسال تحديث الحالة إلى النظام الخارجي: ${
        error?.response?.data?.message ?? error?.message ?? "unknown"
      }`,
      502,
    );
  }
}

// ── Public API (maps internal status -> external action) ───────
/**
 * Update an order's status in the external (Jenni) system.
 * @param shipmentId  the external shipment_id (stored on your order as receiptNumber)
 * @param status      the internal OrderStatus
 * @param details     extra fields required by some actions
 * @returns the external response, or null if this status has no external action
 */
export async function updateExternalOrderStatus(
  shipmentId: number | string,
  url: string,
  username: string,
  password: string,
  registrationText: string,
  status: OrderStatus,
  details: StatusUpdateDetails = {},
) {
  const actionCode = toExternalAction(status);
  if (!actionCode) {
    // REGISTERED / CHANGE_ADDRESS — nothing to push
    return null;
  }
  return sendStatusUpdateToJenni(
    +shipmentId,
    url,
    actionCode,
    details,
    username,
    password,
    registrationText,
  );
}
