import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261031172036 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "creator_commission" drop constraint if exists "creator_commission_order_id_unique";`);
    this.addSql(`alter table if exists "creator" drop constraint if exists "creator_code_unique";`);
    this.addSql(`alter table if exists "creator" drop constraint if exists "creator_slug_unique";`);
    this.addSql(`create table if not exists "creator" ("id" text not null, "name" text not null, "slug" text not null, "type" text check ("type" in ('ambassador', 'affiliate')) not null default 'affiliate', "code" text not null, "discount_percent" real not null default 10, "commission_percent" real not null default 10, "is_active" boolean not null default true, "is_featured" boolean not null default false, "photo_url" text null, "social_handle" text null, "bio" text null, "promotion_id" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "creator_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_creator_slug_unique" ON "creator" ("slug") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_creator_code_unique" ON "creator" ("code") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_creator_deleted_at" ON "creator" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "creator_commission" ("id" text not null, "creator_id" text not null, "order_id" text not null, "currency_code" text not null default 'mad', "eligible_revenue_minor" integer not null, "commission_rate" real not null, "commission_amount_minor" integer not null, "status" text check ("status" in ('pending', 'approved', 'paid', 'reversed')) not null default 'pending', "payout_reference" text null, "paid_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "creator_commission_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_creator_commission_order_id_unique" ON "creator_commission" ("order_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_creator_commission_deleted_at" ON "creator_commission" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "creator" cascade;`);

    this.addSql(`drop table if exists "creator_commission" cascade;`);
  }

}
