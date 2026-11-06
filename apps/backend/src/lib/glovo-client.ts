/**
 * Server-only client for Glovo On-Demand / LaaS Partners API v2.
 * Never import this file from the Next.js client bundle.
 */

type JsonObject = Record<string, unknown>;
type GlovoEventType = "STATUS_UPDATE" | "POSITION_UPDATE";

type GlovoTokenResponse = {
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  expires_in?: number;
};

type CachedToken = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  baseUrl: string;
};

export class GlovoApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "GlovoApiError";
  }
}

let cachedToken: CachedToken | null = null;

export function getGlovoEnvironment(): "staging" | "production" {
  return process.env.GLOVO_API_ENV?.trim().toLowerCase() === "production"
    ? "production"
    : "staging";
}

function baseUrl(): string {
  return getGlovoEnvironment() === "production"
    ? "https://ondemand-api.glovoapp.com"
    : "https://ondemand-stageapi.glovoapp.com";
}

export function isGlovoConfigured(): boolean {
  return Boolean(
    process.env.GLOVO_CLIENT_ID?.trim() &&
      process.env.GLOVO_CLIENT_SECRET?.trim(),
  );
}

export function isGlovoDispatchEnabled(): boolean {
  return process.env.GLOVO_DISPATCH_ENABLED?.trim().toLowerCase() === "true";
}

export function glovoConfigSummary() {
  return {
    environment: getGlovoEnvironment(),
    credentialsConfigured: isGlovoConfigured(),
    // The API client is prepared, but automatic parcel creation is deliberately
    // not wired until Glovo confirms the account-specific pickup/COD requirements.
    dispatchEnabled: false,
    dispatchFlagRequested: isGlovoDispatchEnabled(),
    webhookSecretConfigured: Boolean(process.env.GLOVO_PARTNER_SECRET?.trim()),
    webhookUrlConfigured: Boolean(process.env.GLOVO_WEBHOOK_URL?.trim()),
    pickupAddressBookConfigured: Boolean(process.env.GLOVO_PICKUP_ADDRESS_BOOK_ID?.trim()),
  };
}

async function tokenRequest(path: string, body: JsonObject): Promise<GlovoTokenResponse> {
  const response = await fetch(`${baseUrl()}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "glovo-app-type": "b2b",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const text = await response.text();
  let payload: unknown = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { message: "Glovo returned a non-JSON authentication response." };
  }

  if (!response.ok) {
    throw new GlovoApiError(
      `Glovo authentication failed (${response.status}).`,
      response.status,
    );
  }

  return payload as GlovoTokenResponse;
}

async function getAccessToken(): Promise<string> {
  const currentBaseUrl = baseUrl();
  if (
    cachedToken &&
    cachedToken.baseUrl === currentBaseUrl &&
    cachedToken.expiresAt > Date.now() + 60_000
  ) {
    return cachedToken.accessToken;
  }

  if (!isGlovoConfigured()) {
    throw new GlovoApiError(
      "Glovo credentials are not configured. Dispatch remains disabled.",
      503,
    );
  }

  let tokenResponse: GlovoTokenResponse | null = null;
  if (cachedToken?.refreshToken && cachedToken.baseUrl === currentBaseUrl) {
    try {
      tokenResponse = await tokenRequest("/oauth/refresh", {
        refreshToken: cachedToken.refreshToken,
      });
    } catch {
      cachedToken = null;
    }
  }

  if (!tokenResponse?.accessToken) {
    tokenResponse = await tokenRequest("/oauth/token", {
      grantType: "client_credentials",
      clientId: process.env.GLOVO_CLIENT_ID!.trim(),
      clientSecret: process.env.GLOVO_CLIENT_SECRET!.trim(),
    });
  }

  if (!tokenResponse.accessToken) {
    throw new GlovoApiError("Glovo authentication response did not include an access token.", 502);
  }

  const expiresIn = Number(tokenResponse.expiresIn ?? tokenResponse.expires_in ?? 300);
  cachedToken = {
    accessToken: tokenResponse.accessToken,
    refreshToken: tokenResponse.refreshToken ?? cachedToken?.refreshToken,
    expiresAt: Date.now() + Math.max(60, expiresIn) * 1000,
    baseUrl: currentBaseUrl,
  };

  return cachedToken.accessToken;
}

async function glovoRequest<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const accessToken = await getAccessToken();
  const response = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { message: "Glovo returned a non-JSON response." };
    }
  }

  if (!response.ok) {
    throw new GlovoApiError(
      `Glovo API request failed (${response.status}).`,
      response.status,
    );
  }

  return payload as T;
}

export async function getGlovoWorkingAreas(): Promise<unknown> {
  return glovoRequest("/v2/laas/working-areas");
}

/**
 * Returns the pickup locations created for this Glovo partner account.
 * Glovo's documentation says address-book entries are created by its account
 * managers rather than through the API, so this is read-only discovery.
 */
export async function getGlovoAddresses(): Promise<unknown> {
  return glovoRequest("/v2/laas/addresses?page=0&limit=50");
}

export async function createGlovoQuote(payload: JsonObject): Promise<unknown> {
  return glovoRequest("/v2/laas/quotes", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createGlovoParcelFromQuote(
  quoteId: string,
  payload: JsonObject,
): Promise<unknown> {
  return glovoRequest(`/v2/laas/quotes/${encodeURIComponent(quoteId)}/parcels`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getGlovoParcelStatus(trackingNumber: string): Promise<unknown> {
  return glovoRequest(`/v2/laas/parcels/${encodeURIComponent(trackingNumber)}/status`);
}

export async function getGlovoTrackingLink(
  trackingNumber: string,
  lang = "fr",
): Promise<unknown> {
  const query = new URLSearchParams({ lang });
  return glovoRequest(
    `/v2/laas/parcels/${encodeURIComponent(trackingNumber)}/parcel-tracking-link?${query.toString()}`,
  );
}

export async function getGlovoCourierPosition(trackingNumber: string): Promise<unknown> {
  return glovoRequest(`/v2/laas/parcels/${encodeURIComponent(trackingNumber)}/courier-position`);
}

export async function getGlovoCourierContact(trackingNumber: string): Promise<unknown> {
  return glovoRequest(`/v2/laas/parcels/${encodeURIComponent(trackingNumber)}/courier-contact`);
}

export type GlovoWebhookRegistration = {
  webhookId?: string | number;
  eventType?: GlovoEventType;
  callbackUrl?: string;
};

export async function getGlovoWebhooks(): Promise<GlovoWebhookRegistration[]> {
  const result = await glovoRequest<unknown>("/v2/laas/webhooks");
  if (Array.isArray(result)) return result as GlovoWebhookRegistration[];
  if (result && typeof result === "object") {
    const maybeItems = (result as { webhooks?: unknown }).webhooks;
    if (Array.isArray(maybeItems)) return maybeItems as GlovoWebhookRegistration[];
  }
  return [];
}

export async function registerGlovoWebhook(
  callbackUrl: string,
  eventType: GlovoEventType,
  partnerSecret: string,
): Promise<unknown> {
  return glovoRequest("/v2/laas/webhooks", {
    method: "POST",
    body: JSON.stringify({ callbackUrl, eventType, partnerSecret }),
  });
}
