import { model } from "@medusajs/framework/utils";

const Creator = model.define("creator", {
  id: model.id().primaryKey(),

  name: model.text(),
  slug: model.text().unique(),
  type: model.enum(["ambassador", "affiliate"]).default("affiliate"),
  code: model.text().unique(),

  discount_percent: model.float().default(10),
  commission_percent: model.float().default(10),

  is_active: model.boolean().default(true),
  is_featured: model.boolean().default(false),

  photo_url: model.text().nullable(),
  social_handle: model.text().nullable(),
  bio: model.text().nullable(),

  promotion_id: model.text().nullable(),
});

export default Creator;