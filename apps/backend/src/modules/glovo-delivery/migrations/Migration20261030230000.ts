import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261030230000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "glovo_delivery" (
        "id" text NOT NULL,
        "order_id" text NOT NULL,
        "order_display_id" text NULL,
        "tracking_token_hash" text NOT NULL,
        "account_tracking_token_hash" text NULL,
        "provider_tracking_number" text NULL,
        "provider_tracking_url" text NULL,
        "status" text NOT NULL DEFAULT 'PREPARING',
        "provider_status" text NULL,
        "status_reason" text NULL,
        "courier_name" text NULL,
        "courier_phone" text NULL,
        "courier_latitude" real NULL,
        "courier_longitude" real NULL,
        "eta_pickup" text NULL,
        "eta_delivery" text NULL,
        "last_event_at" timestamptz NULL,
        "last_webhook_id" text NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz NULL,
        CONSTRAINT "glovo_delivery_pkey" PRIMARY KEY ("id")
      );
    `);

    this.addSql(`
      CREATE UNIQUE INDEX IF NOT EXISTS
      "IDX_glovo_delivery_order_id_unique"
      ON "glovo_delivery" ("order_id")
      WHERE deleted_at IS NULL;
    `);

    this.addSql(`
      CREATE UNIQUE INDEX IF NOT EXISTS
      "IDX_glovo_delivery_tracking_token_hash_unique"
      ON "glovo_delivery" ("tracking_token_hash")
      WHERE deleted_at IS NULL;
    `);

    this.addSql(`
      CREATE UNIQUE INDEX IF NOT EXISTS
      "IDX_glovo_delivery_account_tracking_token_hash_unique"
      ON "glovo_delivery" ("account_tracking_token_hash")
      WHERE deleted_at IS NULL
        AND account_tracking_token_hash IS NOT NULL;
    `);

    this.addSql(`
      CREATE INDEX IF NOT EXISTS "IDX_glovo_delivery_deleted_at"
      ON "glovo_delivery" ("deleted_at")
      WHERE deleted_at IS NULL;
    `);
  }

  // Deliberately non-destructive: this migration may run against
  // a database that already contains real delivery records.
  override async down(): Promise<void> {}
}