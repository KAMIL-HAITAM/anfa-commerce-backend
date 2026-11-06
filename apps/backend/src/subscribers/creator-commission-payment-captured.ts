import type {
  SubscriberArgs,
  SubscriberConfig,
} from "@medusajs/framework";

import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { tryApproveCreatorCommissionForOrder } from "../lib/creator-commission";

type PaymentCapturedEvent = {
  id?: string;
};

type PaymentRecord = {
  id: string;
  payment_collection_id?: string | null;
};

type PaymentCollectionRecord = {
  id: string;
  order?: { id: string } | null;
};

export default async function creatorCommissionPaymentCapturedHandler({
  event,
  container,
}: SubscriberArgs<PaymentCapturedEvent>) {
  const paymentId = event.data.id;
  if (!paymentId) return;

  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  // First, retrieve the payment directly by its ID.
  const { data: payments } = await query.graph({
    entity: "payment",
    fields: ["id", "payment_collection_id"],
    filters: { id: paymentId },
  });

  const payment = (payments?.[0] ?? null) as PaymentRecord | null;
  if (!payment?.payment_collection_id) return;

  // Next, retrieve the order linked to the payment collection.
  const { data: collections } = await query.graph({
    entity: "payment_collection",
    fields: ["id", "order.id"],
    filters: { id: payment.payment_collection_id },
  });

  const collection = (collections?.[0] ?? null) as
    | PaymentCollectionRecord
    | null;

  const orderId = collection?.order?.id;
  if (!orderId) return;

  // Approval helper independently verifies full payment and delivery.
  await tryApproveCreatorCommissionForOrder(orderId, container);
}

export const config: SubscriberConfig = {
  event: "payment.captured",
};