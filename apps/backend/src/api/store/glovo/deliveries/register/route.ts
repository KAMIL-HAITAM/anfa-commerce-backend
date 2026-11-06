import { createHash } from "node:crypto";
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { z } from "@medusajs/framework/zod";
import { GLOVO_DELIVERY_MODULE } from "../../../../../modules/glovo-delivery";
import { GLOVO_TRACKING_TOKEN_METADATA_KEY, safeTokenHashMatches } from "../../../../../lib/glovo-tracking";

const RegisterSchema = z.object({
  order_id: z.string().trim().min(1).max(200),
  tracking_token: z.string().regex(/^[a-f0-9]{64}$/i),
});

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid tracking registration request." });
  }

  const { order_id: orderId, tracking_token: token } = parsed.data;
  const tokenHash = createHash("sha256").update(token, "utf8").digest("hex");
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const result = await query.graph({
    entity: "order",
    fields: ["id", "display_id", "metadata"],
    filters: { id: orderId },
  });

  const order = (result.data?.[0] ?? null) as {
    id: string;
    display_id?: string | number | null;
    metadata?: Record<string, unknown> | null;
  } | null;

  if (!order || !safeTokenHashMatches(tokenHash, order.metadata?.[GLOVO_TRACKING_TOKEN_METADATA_KEY])) {
    // Keep unknown order IDs and invalid tokens indistinguishable to callers.
    return res.status(404).json({ message: "Tracking registration could not be verified." });
  }

  const service = req.scope.resolve(GLOVO_DELIVERY_MODULE);
  const existing = await service.listGlovoDeliveries({ order_id: order.id });
  if (existing[0]) {
    if (existing[0].tracking_token_hash !== tokenHash) {
      return res.status(409).json({ message: "A tracking record already exists for this order." });
    }
    return res.status(200).json({
      tracking_path: `/track/${token}`,
      delivery: { id: existing[0].id, status: existing[0].status },
    });
  }

  const created = await service.createGlovoDeliveries({
    order_id: order.id,
    order_display_id: order.display_id == null ? null : `#${String(order.display_id)}`,
    tracking_token_hash: tokenHash,
    status: "PREPARING",
  });

  return res.status(201).json({
    tracking_path: `/track/${token}`,
    delivery: { id: created.id, status: created.status },
  });
}
