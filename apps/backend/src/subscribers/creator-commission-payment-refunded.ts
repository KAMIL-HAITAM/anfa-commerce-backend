import type {
  SubscriberArgs,
  SubscriberConfig,
} from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

import { CREATOR_PROGRAM_MODULE } from "../modules/creator-program";

type PaymentRefundedEvent = {
  id?: string;
};

function readAmount(value: unknown): number {
  if (value === null || value === undefined) return 0;

  if (typeof value === "object") {
    const amount = value as {
      numeric?: unknown;
      toNumber?: () => number;
    };

    if (typeof amount.toNumber === "function") {
      return amount.toNumber();
    }

    if (amount.numeric !== undefined) {
      return Number(amount.numeric);
    }
  }

  return Number(value);
}

export default async function creatorCommissionPaymentRefundedHandler({
  event,
  container,
}: SubscriberArgs<PaymentRefundedEvent>) {
  const paymentId = event.data.id;
  if (!paymentId) return;

  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  const { data: payments } = await query.graph({
    entity: "payment",
    fields: ["id", "payment_collection_id"],
    filters: { id: paymentId },
  });

  const payment = payments?.[0] as {
    id: string;
    payment_collection_id?: string | null;
  } | undefined;

  if (!payment?.payment_collection_id) return;

  const { data: collections } = await query.graph({
    entity: "payment_collection",
    fields: ["id", "order.id"],
    filters: { id: payment.payment_collection_id },
  });

  const collection = collections?.[0] as {
    id: string;
    order?: { id: string } | null;
  } | undefined;

  const orderId = collection?.order?.id;
  if (!orderId) return;

  const { data: orders } = await query.graph({
    entity: "order",
    fields: ["id", "total", "summary.paid_total", "summary.refunded_total"],
    filters: { id: orderId },
  });

  const order = orders?.[0] as {
    id: string;
    total?: unknown;
    summary?: {
      paid_total?: unknown;
      refunded_total?: unknown;
    } | null;
  } | undefined;

  if (!order) return;

  const paid = readAmount(order.summary?.paid_total);
  const refunded = readAmount(order.summary?.refunded_total);

  if (!Number.isFinite(paid) || !Number.isFinite(refunded) || paid <= 0) {
    logger.warn(
      `[creator-commission] Cannot verify refund totals for order ${orderId}.`
    );
    return;
  }

  const service = container.resolve(CREATOR_PROGRAM_MODULE);
  const commissions = await service.listCommissions({ order_id: orderId });
  const commission = commissions[0];

  if (!commission) return;

  if (refunded >= paid) {
    if (commission.status !== "reversed") {
      await service.updateCommissions({
        id: commission.id,
        status: "reversed",
        eligible_revenue_minor: 0,
        commission_amount_minor: 0,
        // Keep paid_amount_minor, paid_at, and payout_reference.
      });
    }

    return;
  }

  if (refunded > 0) {
    logger.warn(
      `[creator-commission] Partial payment refund on ${orderId}. ` +
      "The payment event does not identify the refunded product lines. " +
      "Use the item-return workflow or reconcile the product refund manually; " +
      "do not automatically treat a shipping refund as a product refund."
    );
  }
}

export const config: SubscriberConfig = {
  event: "payment.refunded",
};