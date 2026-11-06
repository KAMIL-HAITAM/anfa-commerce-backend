import { model } from "@medusajs/framework/utils";

const GlovoDelivery = model.define("glovo_delivery", {
  id: model.id().primaryKey(),

  // Medusa order ID. A single Glovo delivery record is maintained per order.
  order_id: model.text().unique(),
  order_display_id: model.text().nullable(),
  tracking_token_hash: model.text().unique(),
  // Secondary stable token hash for authenticated account-history links.
  account_tracking_token_hash: model.text().nullable(),

  // These remain empty until the delivery has actually been created with Glovo.
  provider_tracking_number: model.text().nullable(),
  provider_tracking_url: model.text().nullable(),
  status: model.text().default("PREPARING"),
  provider_status: model.text().nullable(),
  status_reason: model.text().nullable(),

  courier_name: model.text().nullable(),
  courier_phone: model.text().nullable(),
  courier_latitude: model.float().nullable(),
  courier_longitude: model.float().nullable(),
  eta_pickup: model.text().nullable(),
  eta_delivery: model.text().nullable(),

  last_event_at: model.dateTime().nullable(),
  last_webhook_id: model.text().nullable(),
});

export default GlovoDelivery;
