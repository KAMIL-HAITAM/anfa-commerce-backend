import { timingSafeEqual } from "node:crypto";
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { z } from "@medusajs/framework/zod";
import { GLOVO_DELIVERY_MODULE } from "../../../../modules/glovo-delivery";
import { tryApproveCreatorCommissionForOrder } from "../../../../lib/creator-commission";

const CourierSchema = z.object({
  name: z.string().max(200).nullable().optional(),
  phone: z.string().max(80).nullable().optional(),
  position: z.object({
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
  }).nullable().optional(),
}).nullable().optional();

const WebhookSchema = z.object({
  webhookId: z.union([z.string(), z.number()]),
  eventType: z.enum(["STATUS_UPDATE", "POSITION_UPDATE"]),
  trackingNumber: z.string().trim().min(1).max(150),
  status: z.string().trim().min(1).max(100),
  date: z.string().trim().min(1).max(80),
  updateReason: z.string().max(1000).nullable().optional(),
  courier: CourierSchema,
  estimatedTimeOfArrival: z.object({
    pickup: z.string().max(80).nullable().optional(),
    delivery: z.string().max(80).nullable().optional(),
  }).nullable().optional(),
});

function constantTimeStringEqual(candidate: string, expected: string): boolean {
  const left = Buffer.from(candidate, "utf8");
  const right = Buffer.from(expected, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const expectedSecret = process.env.GLOVO_PARTNER_SECRET?.trim();
  const suppliedSecret = String(req.headers.authorization ?? "");
  if (!expectedSecret || !suppliedSecret || !constantTimeStringEqual(suppliedSecret, expectedSecret)) {
    return res.status(401).json({ message: "Unauthorized webhook." });
  }

  const parsed = WebhookSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid Glovo webhook payload." });
  }

  const event = parsed.data;
  const service = req.scope.resolve(GLOVO_DELIVERY_MODULE);
  const matches = await service.listGlovoDeliveries({
    provider_tracking_number: event.trackingNumber,
  });
  const delivery = matches[0];

  // Glovo can call a partner-level webhook for deliveries managed elsewhere.
  // Acknowledge unrelated tracking numbers so they do not trigger futile retries.
  if (!delivery) return res.status(200).json({ received: true, matched: false });

  const incomingDate = new Date(event.date);
  if (!Number.isFinite(incomingDate.getTime())) {
    return res.status(400).json({ message: "Invalid Glovo webhook date." });
  }
  const previousDate = delivery.last_event_at ? new Date(delivery.last_event_at).getTime() : 0;
  // Glovo's webhookId identifies the registered webhook subscription, not a
  // unique delivery event. Do not deduplicate solely by this value: it can be
  // identical across many legitimate updates. Reject only strictly older events;
  // equal timestamps are allowed because separate event types can arrive together.
  const webhookSubscriptionId = String(event.webhookId);
  if (incomingDate.getTime() < previousDate) {
    return res.status(200).json({ received: true, stale: true });
  }

  const updates: {
    id: string;
    status: string;
    provider_status: string;
    status_reason: string | null;
    last_event_at: Date;
    last_webhook_id: string;
    courier_name?: string | null;
    courier_phone?: string | null;
    courier_latitude?: number | null;
    courier_longitude?: number | null;
    eta_pickup?: string | null;
    eta_delivery?: string | null;
  } = {
    id: delivery.id,
    status: event.status,
    provider_status: event.status,
    status_reason: event.updateReason ?? null,
    last_event_at: incomingDate,
    last_webhook_id: webhookSubscriptionId,
  };

  if (event.courier !== undefined) {
    updates.courier_name = event.courier?.name ?? null;
    updates.courier_phone = event.courier?.phone ?? null;
    if (event.courier?.position) {
      updates.courier_latitude = event.courier.position.latitude;
      updates.courier_longitude = event.courier.position.longitude;
    }
  }

  if (event.estimatedTimeOfArrival !== undefined) {
    updates.eta_pickup = event.estimatedTimeOfArrival?.pickup ?? null;
    updates.eta_delivery = event.estimatedTimeOfArrival?.delivery ?? null;
  }

  await service.updateGlovoDeliveries(updates);

if (updates.status.trim().toUpperCase() === "DELIVERED") {
  await tryApproveCreatorCommissionForOrder(
    delivery.order_id,
    req.scope
  );
}

return res.status(200).json({ received: true, matched: true });
}
