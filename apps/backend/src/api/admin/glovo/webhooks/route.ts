import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import {
  getGlovoWebhooks,
  isGlovoConfigured,
  registerGlovoWebhook,
} from "../../../../lib/glovo-client";

const EVENT_TYPES = ["STATUS_UPDATE", "POSITION_UPDATE"] as const;

export async function POST(_req: MedusaRequest, res: MedusaResponse) {
  if (!isGlovoConfigured()) {
    return res.status(503).json({ message: "Glovo n'est pas configuré. Ajoutez les identifiants d'abord." });
  }

  const callbackUrl = process.env.GLOVO_WEBHOOK_URL?.trim();
  const partnerSecret = process.env.GLOVO_PARTNER_SECRET?.trim();
  if (!callbackUrl || !partnerSecret) {
    return res.status(400).json({ message: "Configurez GLOVO_WEBHOOK_URL et GLOVO_PARTNER_SECRET avant d'enregistrer les webhooks." });
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(callbackUrl);
  } catch {
    return res.status(400).json({ message: "GLOVO_WEBHOOK_URL doit être une URL valide." });
  }
  if (parsedUrl.protocol !== "https:") {
    return res.status(400).json({ message: "Le webhook Glovo doit être accessible depuis Internet via HTTPS. localhost ne fonctionnera pas." });
  }

  const existing = await getGlovoWebhooks();
  const results: Array<{ eventType: string; state: string; webhookId?: string | number }> = [];
  for (const eventType of EVENT_TYPES) {
    const current = existing.find((entry) => entry.eventType === eventType);
    if (current) {
      if (current.callbackUrl && current.callbackUrl !== callbackUrl) {
        return res.status(409).json({
          message: `Un webhook ${eventType} existe déjà avec une autre URL. Modifiez-le dans le portail Glovo avant de réessayer.`,
          results,
        });
      }
      results.push({ eventType, state: "already_registered", webhookId: current.webhookId });
      continue;
    }
    const created = await registerGlovoWebhook(callbackUrl, eventType, partnerSecret);
    const record = created && typeof created === "object" ? created as { webhookId?: string | number } : {};
    results.push({ eventType, state: "registered", webhookId: record.webhookId });
  }

  return res.json({ success: true, results });
}
