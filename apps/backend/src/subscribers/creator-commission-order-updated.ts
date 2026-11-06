import type {
  SubscriberArgs,
  SubscriberConfig,
} from "@medusajs/framework";

import { tryApproveCreatorCommissionForOrder } from "../lib/creator-commission";

type OrderUpdatedEvent = {
  id?: string;
};

export default async function creatorCommissionOrderUpdatedHandler({
  event,
  container,
}: SubscriberArgs<OrderUpdatedEvent>) {
  if (!event.data.id) return;

  await tryApproveCreatorCommissionForOrder(event.data.id, container);
}

export const config: SubscriberConfig = {
  event: "order.updated",
};