import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { z } from "@medusajs/framework/zod";
import { GLOVO_DELIVERY_MODULE } from "../../../../../modules/glovo-delivery";

const UpdateDeliverySchema = z.object({
  provider_tracking_number: z.string().trim().min(1).max(150).optional(),
  provider_tracking_url: z.string().url().refine((value) => {
    try { return new URL(value).protocol === "https:"; } catch { return false; }
  }, "Le lien de suivi doit utiliser HTTPS.").nullable().optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: "Au moins un champ doit être fourni.",
});

export async function PATCH(req: MedusaRequest, res: MedusaResponse) {
  const parsed = UpdateDeliverySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Données de suivi invalides.", errors: parsed.error.issues });
  }

  const service = req.scope.resolve(GLOVO_DELIVERY_MODULE);
  const matches = await service.listGlovoDeliveries({ id: req.params.id });
  const delivery = matches[0];
  if (!delivery) return res.status(404).json({ message: "Enregistrement de livraison introuvable." });

  const updates: {
    id: string;
    provider_tracking_number?: string;
    provider_tracking_url?: string | null;
    provider_status?: string | null;
    status?: string;
  } = { id: delivery.id };
  if (parsed.data.provider_tracking_number !== undefined) {
    updates.provider_tracking_number = parsed.data.provider_tracking_number;
    if (!delivery.provider_status && delivery.status === "PREPARING") {
      updates.provider_status = "CREATED";
      updates.status = "CREATED";
    }
  }
  if (parsed.data.provider_tracking_url !== undefined) {
    updates.provider_tracking_url = parsed.data.provider_tracking_url;
  }
  if (
    (parsed.data.provider_tracking_number || parsed.data.provider_tracking_url) &&
    !delivery.provider_status &&
    delivery.status === "PREPARING"
  ) {
    updates.status = "CREATED";
    updates.provider_status = "CREATED";
  }

  const updated = await service.updateGlovoDeliveries(updates);
  const result = Array.isArray(updated) ? updated[0] : updated;
  return res.json({ delivery: result });
}
