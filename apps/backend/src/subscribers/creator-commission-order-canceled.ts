import type {
  SubscriberArgs,
  SubscriberConfig,
} from "@medusajs/framework";

import { CREATOR_PROGRAM_MODULE } from "../modules/creator-program";

type OrderCanceledEvent = {
  id?: string;
};

export default async function creatorCommissionOrderCanceledHandler({
  event,
  container,
}: SubscriberArgs<OrderCanceledEvent>) {
  const orderId = event.data.id;
  if (!orderId) return;

  const creatorService = container.resolve(CREATOR_PROGRAM_MODULE);

  const commissions = await creatorService.listCommissions({
    order_id: orderId,
  });

  for (const commission of commissions) {
    if (commission.status === "reversed") continue;

    await creatorService.updateCommissions({
      id: commission.id,
      status: "reversed",
      eligible_revenue_minor: 0,
      commission_amount_minor: 0,
    });

    // Intentionally preserve paid_amount_minor, paid_at,
    // and payout_reference for audit and reconciliation.
  }
}

export const config: SubscriberConfig = {
  event: "order.canceled",
};