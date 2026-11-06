import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261102232000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table if exists "glovo_delivery" add column if not exists "account_tracking_token_hash" text null;`);
    this.addSql(`create unique index if not exists "IDX_glovo_delivery_account_tracking_token_hash_unique" on "glovo_delivery" ("account_tracking_token_hash") where deleted_at is null and account_tracking_token_hash is not null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_glovo_delivery_account_tracking_token_hash_unique";`);
    this.addSql(`alter table if exists "glovo_delivery" drop column if exists "account_tracking_token_hash";`);
  }
}
