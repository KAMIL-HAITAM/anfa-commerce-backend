import type {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

import { CREATOR_PROGRAM_MODULE } from "../../../../../../modules/creator-program";
import { GLOVO_DELIVERY_MODULE } from "../../../../../../modules/glovo-delivery";
import { tryApproveCreatorCommissionForOrder } from "../../../../../../lib/creator-commission";

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const deliveryService = req.scope.resolve(GLOVO_DELIVERY_MODULE);
  const matches = await deliveryService.listGlovoDeliveries({
    id: req.params.id,
  });

  const delivery = matches[0];

  if (!delivery) {
    return res.status(404).json({
      message: "Delivery record not found.",
    });
  }

  const currentStatus = String(delivery.status ?? "").toUpperCase();

  if (["CANCELLED", "ORDER_CANCELLED"].includes(currentStatus)) {
    return res.status(409).json({
      message: "A cancelled delivery cannot be marked as delivered.",
    });
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  const { data } = await query.graph({
    entity: "order",
    fields: ["id", "status", "canceled_at"],
    filters: { id: delivery.order_id },
  });

  const order = data?.[0] as {
    id: string;
    status?: string | null;
    canceled_at?: string | Date | null;
  } | undefined;

  if (!order || order.canceled_at || order.status?.toLowerCase() === "canceled") {
    return res.status(409).json({
      message: "A cancelled or missing order cannot be marked as delivered.",
    });
  }

  if (currentStatus !== "DELIVERED") {
    await deliveryService.updateGlovoDeliveries({
      id: delivery.id,
      status: "DELIVERED",
      provider_status: "MANUALLY_CONFIRMED_DELIVERED",
      status_reason: "Delivery manually confirmed by an admin after verification.",
      last_event_at: new Date(),
    });
  }

  // This helper will still refuse approval unless the order is fully paid.
  await tryApproveCreatorCommissionForOrder(delivery.order_id, req.scope);

  const creatorService = req.scope.resolve(CREATOR_PROGRAM_MODULE);
  const commissions = await creatorService.listCommissions({
    order_id: delivery.order_id,
  });

  return res.json({
    success: true,
    delivery_id: delivery.id,
    commission: commissions[0] ?? null,
  });
}