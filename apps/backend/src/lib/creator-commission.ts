import type { MedusaContainer } from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

import { CREATOR_PROGRAM_MODULE } from "../modules/creator-program";
import { GLOVO_DELIVERY_MODULE } from "../modules/glovo-delivery";

function toAmount(value: unknown): number {
  if (value === null || value === undefined) {
    return 0;
  }

  if (typeof value === "object") {
    const amount = value as {
      numeric?: unknown;
      toNumber?: () => number;
    };

    if (typeof amount.toNumber === "function") {
      const parsed = amount.toNumber();
      return Number.isFinite(parsed) ? parsed : NaN;
    }

    if (amount.numeric !== undefined) {
      const parsed = Number(amount.numeric);
      return Number.isFinite(parsed) ? parsed : NaN;
    }
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

export async function tryApproveCreatorCommissionForOrder(
  orderId: string,
  container: MedusaContainer
): Promise<void> {
  const creatorService = container.resolve(CREATOR_PROGRAM_MODULE);

  const commissions = await creatorService.listCommissions({
    order_id: orderId,
  });

  const commission = commissions[0];

  // Only pending commissions can transition to approved.
  if (!commission || commission.status !== "pending") return;

  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  const { data } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "status",
      "canceled_at",
      "total",
      "summary.paid_total",
      "summary.refunded_total",
    ],
    filters: { id: orderId },
  });

  const order = (data?.[0] ?? null) as {
    id: string;
    status?: string | null;
    canceled_at?: string | Date | null;
    total?: number | string | null;
    summary?: {
      paid_total?: number | string | null;
      refunded_total?: number | string | null;
    } | null;
  } | null;

  if (
    !order ||
    order.canceled_at ||
    order.status?.toLowerCase() === "canceled"
  ) {
    return;
  }

  const total = toAmount(order.total);
  const paidTotal = toAmount(order.summary?.paid_total);
  const refundedTotal = toAmount(order.summary?.refunded_total);

  if (
    !Number.isFinite(total) ||
    !Number.isFinite(paidTotal) ||
    !Number.isFinite(refundedTotal)
  ) {
    return;
  }

  // Require the entire order total to have been paid.
  if (paidTotal < total) return;

  // Never approve an order whose captured payments have all been refunded.
  if (paidTotal > 0 && refundedTotal >= paidTotal) return;

  const deliveryService = container.resolve(GLOVO_DELIVERY_MODULE);
  const deliveries = await deliveryService.listGlovoDeliveries({
    order_id: orderId,
  });

  const delivery = deliveries[0];

  if (delivery?.status?.trim().toUpperCase() !== "DELIVERED") {
    return;
  }

  await creatorService.updateCommissions({
    id: commission.id,
    status: "approved",
  });
}