import { createHash } from "node:crypto";
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { GLOVO_DELIVERY_MODULE } from "../../../../../modules/glovo-delivery";
import { isValidTrackingToken } from "../../../../../lib/glovo-tracking";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const token = req.params.token;
  if (!isValidTrackingToken(token)) {
    return res.status(404).json({ message: "Suivi introuvable." });
  }

  const tokenHash = createHash("sha256").update(token, "utf8").digest("hex");
  const service = req.scope.resolve(GLOVO_DELIVERY_MODULE);
  const originalMatches = await service.listGlovoDeliveries({ tracking_token_hash: tokenHash });
  const accountMatches = originalMatches.length
    ? []
    : await service.listGlovoDeliveries({ account_tracking_token_hash: tokenHash });
  const delivery = originalMatches[0] ?? accountMatches[0];

  if (!delivery) {
    return res.status(404).json({ message: "Suivi introuvable." });
  }

  // This public response deliberately excludes customer address, email and phone.
  return res.json({
    delivery: {
      order_display_id: delivery.order_display_id,
      status: delivery.status,
      provider_status: delivery.provider_status,
      status_reason: delivery.status_reason,
      provider_tracking_url: delivery.provider_tracking_url,
      courier_name: delivery.courier_name,
      courier_phone: delivery.courier_phone,
      courier_latitude: delivery.courier_latitude,
      courier_longitude: delivery.courier_longitude,
      eta_pickup: delivery.eta_pickup,
      eta_delivery: delivery.eta_delivery,
      last_event_at: delivery.last_event_at,
      live_tracking: Boolean(delivery.provider_tracking_number && delivery.last_event_at),
    },
  });
}
