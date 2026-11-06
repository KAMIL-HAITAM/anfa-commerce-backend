import { createHash } from "node:crypto";
import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { GLOVO_DELIVERY_MODULE } from "../../../../../modules/glovo-delivery";
import {
  GLOVO_TRACKING_TOKEN_METADATA_KEY,
  createAccountTrackingToken,
} from "../../../../../lib/glovo-tracking";

/** Return a tracking URL only to the customer who owns this Medusa order. */
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const customerId = req.auth_context.actor_id;
  const orderId = req.params.order_id;

  if (!customerId || !orderId) {
    return res.status(404).json({ message: "Suivi introuvable." });
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  const result = await query.graph({
    entity: "order",
    fields: ["id", "display_id", "customer_id", "canceled_at", "metadata"],
    filters: { id: orderId },
  });

  const order = (result.data?.[0] ?? null) as {
    id: string;
    display_id?: string | number | null;
    customer_id?: string | null;
    canceled_at?: string | Date | null;
    metadata?: Record<string, unknown> | null;
  } | null;

  // Never disclose whether another customer's order exists.
  if (!order || order.customer_id !== customerId || order.canceled_at) {
    return res.status(404).json({ message: "Suivi introuvable." });
  }

  const trackingMarker = order.metadata?.[
    GLOVO_TRACKING_TOKEN_METADATA_KEY
  ];

  const hasGlovoTrackingMarker =
    typeof trackingMarker === "string" &&
    /^[a-f0-9]{64}$/i.test(trackingMarker);

  const service = req.scope.resolve(GLOVO_DELIVERY_MODULE);
  const deliveries = await service.listGlovoDeliveries({
    order_id: order.id,
  });

  let delivery = deliveries[0];

  // Do not create Glovo tracking records for orders that have no
  // tracking marker from checkout.
  if (!delivery && !hasGlovoTrackingMarker) {
    return res.status(404).json({
      message: "Aucun suivi n'est disponible pour cette commande.",
    });
  }

  let token: string;

  try {
    token = createAccountTrackingToken(order.id);
  } catch {
    return res.status(503).json({
      message: "Le suivi de commande n'est pas configuré.",
    });
  }

  const tokenHash = createHash("sha256")
    .update(token, "utf8")
    .digest("hex");

  if (!delivery) {
    try {
      delivery = await service.createGlovoDeliveries({
        order_id: order.id,
        order_display_id:
          order.display_id == null
            ? null
            : `#${String(order.display_id)}`,
        tracking_token_hash: tokenHash,
        account_tracking_token_hash: tokenHash,
        status: "PREPARING",
      });
    } catch {
      // Another request may have created the record at the same time.
      const retry = await service.listGlovoDeliveries({
        order_id: order.id,
      });

      delivery = retry[0];

      if (!delivery) {
        return res.status(503).json({
          message: "Impossible de créer le suivi pour cette commande.",
        });
      }
    }
  }

  // Ensure the owner's deterministic tracking token can find the record.
  if (delivery.account_tracking_token_hash !== tokenHash) {
    await service.updateGlovoDeliveries({
      id: delivery.id,
      account_tracking_token_hash: tokenHash,
    });
  }

  return res.json({
    tracking_path: `/track/${token}`,
    delivery: {
      order_display_id: delivery.order_display_id,
      status: delivery.status,
    },
  });
}