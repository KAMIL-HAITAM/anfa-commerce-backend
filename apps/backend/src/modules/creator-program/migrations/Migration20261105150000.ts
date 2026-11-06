import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261105150000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      ALTER TABLE "creator_commission"
      ADD COLUMN IF NOT EXISTS "paid_amount_minor"
      integer NOT NULL DEFAULT 0;
    `);
  }

  // Preserve recorded payout history if this migration is rolled back.
  override async down(): Promise<void> {}
}