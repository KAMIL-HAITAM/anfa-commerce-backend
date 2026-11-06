import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { GLOVO_DELIVERY_MODULE } from "../modules/glovo-delivery";

type OrderCanceledEvent = {
  id?: string;
  order_id?: string;
  canceled_at?: string | null;
};

export default async function glovoOrderCanceledHandler({
  event,
  container,
}: SubscriberArgs<OrderCanceledEvent>) {
  const orderId = event.data.id ?? event.data.order_id;
  if (!orderId) return;

  const service = container.resolve(GLOVO_DELIVERY_MODULE);
  const matches = await service.listGlovoDeliveries({ order_id: orderId });
  const delivery = matches[0];
  if (!delivery || delivery.status === "DELIVERED" || delivery.status === "CANCELLED") return;

  await service.updateGlovoDeliveries({
    id: delivery.id,
    status: "ORDER_CANCELLED",
    status_reason: "La commande ANFA a été annulée.",
    last_event_at: event.data.canceled_at ? new Date(event.data.canceled_at) : new Date(),
  });

  // Do not call Glovo's cancellation API automatically. If a courier has already
  // been requested, an operator should verify/perform the provider cancellation
  // because Glovo may charge a cancellation fee for certain delivery states.
}

export const config: SubscriberConfig = {
  event: "order.canceled",
};
