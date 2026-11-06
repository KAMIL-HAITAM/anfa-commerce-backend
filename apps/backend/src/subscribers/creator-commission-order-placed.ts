import type {
  SubscriberArgs,
  SubscriberConfig,
} from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { CREATOR_PROGRAM_MODULE } from "../modules/creator-program";
import { tryApproveCreatorCommissionForOrder } from "../lib/creator-commission";

type OrderPlacedEvent = {
  id?: string;
  order_id?: string;
};

type OrderItem = {
  subtotal?: number | string | null;
  discount_subtotal?: number | string | null;
  unit_price?: number | string | null;
  quantity?: number | string | null;
  adjustments?: Array<{
    promotion_id?: string | null;
    amount?: number | string | null;
  } | null> | null;
};

type OrderForCommission = {
  id: string;
  currency_code?: string | null;
  promotions?: Array<{ id?: string | null } | null> | null;
  items?: OrderItem[] | null;
};

type SubscriberContainer =
  SubscriberArgs<OrderPlacedEvent>["container"];

function amount(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  if (value && typeof value === "object") {
    const candidate = value as {
      numeric?: unknown;
      toNumber?: () => number;
    };

    if (candidate.numeric !== undefined) {
      return amount(candidate.numeric);
    }

    if (typeof candidate.toNumber === "function") {
      try {
        return amount(candidate.toNumber());
      } catch {
        return 0;
      }
    }
  }

  return 0;
}

function currencyScale(currencyCode: string): number {
  try {
    const digits = new Intl.NumberFormat("en", {
      style: "currency",
      currency: currencyCode.toUpperCase(),
    }).resolvedOptions().maximumFractionDigits;

    return 10 ** (digits ?? 2);
  } catch {
    return 100;
  }
}

/** Shared processing logic for the event handler and one-time recovery script. */
export async function createPendingCreatorCommissionForOrder(
  orderId: string,
  container: SubscriberContainer
): Promise<void> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);

  logger.info(`[creator-commission] Processing order ${orderId}`);

  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  const { data } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "currency_code",
      "promotions.id",
      "items.subtotal",
      "items.discount_subtotal",
      "items.adjustments.promotion_id",
      "items.unit_price",
      "items.quantity",
      "items.adjustments.amount",
    ],
    filters: { id: orderId },
  });

  const order = (data?.[0] ?? null) as OrderForCommission | null;

  if (!order) {
    logger.warn(`[creator-commission] Order ${orderId} was not found by Query Graph.`);
    return;
  }

  logger.info(
    `[creator-commission] Loaded order ${orderId}; ` +
      `items=${order.items?.length ?? 0}; ` +
      `promotions=${order.promotions?.length ?? 0}`
  );

  const promotionIds = new Set<string>();

  for (const promotion of order.promotions ?? []) {
    if (promotion?.id) promotionIds.add(promotion.id);
  }

  for (const item of order.items ?? []) {
    for (const adjustment of item?.adjustments ?? []) {
      if (adjustment?.promotion_id) {
        promotionIds.add(adjustment.promotion_id);
      }
    }
  }

  if (!promotionIds.size) {
    logger.warn(
      `[creator-commission] Order ${orderId} has no promotion IDs in the queried order data.`
    );
    return;
  }

  logger.info(
    `[creator-commission] Promotion IDs for ${orderId}: ${[...promotionIds].join(", ")}`
  );

  const creatorService = container.resolve(CREATOR_PROGRAM_MODULE);

  const existing = await creatorService.listCommissions({
    order_id: order.id,
  });

  if (existing.length) {
    logger.info(
      `[creator-commission] A commission already exists for ${orderId}; skipping duplicate.`
    );
    return;
  }

  const currencyCode = (order.currency_code || "mad").toLowerCase();
  const scale = currencyScale(currencyCode);

  const eligibleRevenueMajor = (order.items ?? []).reduce(
  (sum, item) => {
    const subtotal = Math.max(0, amount(item?.subtotal));

    const discountSubtotal = Math.max(
      0,
      amount(item?.discount_subtotal)
    );

    const adjustmentDiscount = (item?.adjustments ?? []).reduce(
      (total, adjustment) =>
        total + Math.max(0, amount(adjustment?.amount)),
      0
    );

    // Prefer calculated subtotal data when available.
    if (subtotal > 0) {
      const discount = Math.max(
        discountSubtotal,
        adjustmentDiscount
      );

      return sum + Math.max(0, subtotal - discount);
    }

    // Fallback for orders whose calculated subtotal is unavailable.
    // Use the underlying unit price and quantity, then subtract
    // item-level discounts. Shipping is not included.
    const unitPrice = Math.max(
      0,
      amount(item?.unit_price)
    );

    const quantity = Math.max(
      0,
      amount(item?.quantity)
    );

    return sum + Math.max(
      0,
      unitPrice * quantity - adjustmentDiscount
    );
  },
  0
);

  const eligibleRevenueMinor = Math.round(
    eligibleRevenueMajor * scale
  );

  logger.info(
    `[creator-commission] Eligible revenue for ${orderId}: ${eligibleRevenueMinor} minor units`
  );

  if (eligibleRevenueMinor <= 0) {
    logger.warn(
      `[creator-commission] Order ${orderId} has no positive eligible product revenue.`
    );
    return;
  }

  for (const promotionId of promotionIds) {
    const creators = await creatorService.listCreators({
      promotion_id: promotionId,
    });

    const creator = creators[0];
    if (!creator) {
      logger.warn(
        `[creator-commission] No creator found for promotion ${promotionId}.`
      );
      continue;
    }

    const commissionRate = amount(creator.commission_percent);

    if (commissionRate <= 0) {
      logger.warn(
        `[creator-commission] Creator ${creator.code} has a non-positive commission rate.`
      );
      continue;
    }

    const commissionAmountMinor = Math.round(
      (eligibleRevenueMinor * commissionRate) / 100
    );

    if (commissionAmountMinor <= 0) {
      logger.warn(
        `[creator-commission] Calculated commission for ${orderId} is zero.`
      );
      continue;
    }

    // Recheck before inserting. The database's unique order index remains
    // the final protection against simultaneous duplicate creation.
    const duplicateCheck = await creatorService.listCommissions({
      order_id: order.id,
    });

    if (duplicateCheck.length) {
      logger.info(
        `[creator-commission] Commission appeared for ${orderId}; skipping duplicate.`
      );
      return;
    }

    await creatorService.createCommissions({
      creator_id: creator.id,
      order_id: order.id,
      currency_code: currencyCode,
      eligible_revenue_minor: eligibleRevenueMinor,
      commission_rate: commissionRate,
      commission_amount_minor: commissionAmountMinor,
      paid_amount_minor: 0,
      status: "pending",
    });
    await tryApproveCreatorCommissionForOrder(order.id, container);

    logger.info(
      `[creator-commission] Created pending commission for ${orderId}; ` +
        `creator=${creator.code}; amount=${commissionAmountMinor} ${currencyCode} minor units.`
    );

    return;
  }

  logger.warn(
    `[creator-commission] No creator matched the applied promotions for ${orderId}.`
  );
}

export default async function creatorCommissionOrderPlacedHandler({
  event,
  container,
}: SubscriberArgs<OrderPlacedEvent>) {
  const orderId = event.data.id ?? event.data.order_id;
  if (!orderId) {
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
    logger.warn("[creator-commission] order.placed event did not contain an order ID.");
    return;
  }

  await createPendingCreatorCommissionForOrder(orderId, container);
}

export const config: SubscriberConfig = {
  event: "order.placed",
};