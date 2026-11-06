import type {
  SubscriberArgs,
  SubscriberConfig,
} from "@medusajs/framework";

import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { CREATOR_PROGRAM_MODULE } from "../modules/creator-program";

type ReturnReceivedEvent = {
  order_id?: string;
  return_id?: string;
};

type ReturnItem = {
  subtotal?: number | string | null;
  discount_subtotal?: number | string | null;
  total?: number | string | null;
  return_received_total?: number | string | null;
};

type OrderForReturn = {
  id: string;
  currency_code?: string | null;
  items?: ReturnItem[] | null;
};

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

export default async function creatorCommissionOrderReturnReceivedHandler({
  event,
  container,
}: SubscriberArgs<ReturnReceivedEvent>) {
  const orderId = event.data.order_id;
  if (!orderId) return;

  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  const { data } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "currency_code",
      "items.subtotal",
      "items.discount_subtotal",
      "items.total",
      "items.return_received_total",
    ],
    filters: { id: orderId },
  });

  const order = (data?.[0] ?? null) as OrderForReturn | null;
  if (!order) return;

  const creatorService = container.resolve(CREATOR_PROGRAM_MODULE);
  const commissions = await creatorService.listCommissions({
    order_id: order.id,
  });

  const commission = commissions[0];

  if (!commission || commission.status === "reversed") return;

  // Recalculate from aggregate return totals, so repeated events
  // do not subtract the same returned items more than once.
  const eligibleRevenueMajor = (order.items ?? []).reduce(
    (sum, item) => {
      const subtotal = Math.max(0, amount(item.subtotal));
      const discount = Math.max(0, amount(item.discount_subtotal));
      const eligibleLineRevenue = Math.max(0, subtotal - discount);

      const lineTotal = Math.max(0, amount(item.total));
      const returnedTotal = Math.min(
        lineTotal,
        Math.max(0, amount(item.return_received_total))
      );

      const returnedShare =
        lineTotal > 0 ? returnedTotal / lineTotal : 0;

      return sum + eligibleLineRevenue * (1 - returnedShare);
    },
    0
  );

  const currencyCode = (
    order.currency_code || commission.currency_code || "mad"
  ).toLowerCase();

  const scale = currencyScale(currencyCode);
  const eligibleRevenueMinor = Math.max(
    0,
    Math.round(eligibleRevenueMajor * scale)
  );

  const commissionRate = amount(commission.commission_rate);
  const commissionAmountMinor = Math.max(
    0,
    Math.round((eligibleRevenueMinor * commissionRate) / 100)
  );

  // Keep the actual payout history intact. For a paid commission,
  // paid_amount_minor - commission_amount_minor represents the
  // amount requiring clawback or reconciliation after a return.
  const nextStatus =
    commission.status === "paid"
      ? "paid"
      : eligibleRevenueMinor === 0 || commissionAmountMinor === 0
        ? "reversed"
        : commission.status;

  await creatorService.updateCommissions({
    id: commission.id,
    currency_code: currencyCode,
    eligible_revenue_minor: eligibleRevenueMinor,
    commission_amount_minor: commissionAmountMinor,
    status: nextStatus,
  });
}

export const config: SubscriberConfig = {
  event: "order.return_received",
};