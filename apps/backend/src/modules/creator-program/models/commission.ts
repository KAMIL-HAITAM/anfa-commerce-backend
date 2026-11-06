import { model } from "@medusajs/framework/utils";

const Commission = model.define("creator_commission", {
  id: model.id().primaryKey(),

  creator_id: model.text(),
  order_id: model.text().unique(),

  currency_code: model.text().default("mad"),

  eligible_revenue_minor: model.number(),
  commission_rate: model.float(),
  commission_amount_minor: model.number(),
  paid_amount_minor: model.number().default(0),

  status: model
    .enum(["pending", "approved", "paid", "reversed"])
    .default("pending"),

  payout_reference: model.text().nullable(),
  paid_at: model.dateTime().nullable(),
});

export default Commission;