import type { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

import { CREATOR_PROGRAM_MODULE } from "../modules/creator-program";
import { createPendingCreatorCommissionForOrder } from "../subscribers/creator-commission-order-placed";

export default async function reprocessCreatorCommission({
  args,
  container,
}: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const orderId = args?.[0];

  if (!orderId) {
    throw new Error(
      "Pass the order ID as an argument to this script."
    );
  }

  logger.info(`[creator-commission-recovery] Starting for ${orderId}`);

  await createPendingCreatorCommissionForOrder(orderId, container);

  const service = container.resolve(CREATOR_PROGRAM_MODULE);
  const commissions = await service.listCommissions({
    order_id: orderId,
  });

  if (!commissions.length) {
    logger.warn(
      `[creator-commission-recovery] No commission row exists for ${orderId}. Check the diagnostic messages above.`
    );
    return;
  }

  const commission = commissions[0];

  logger.info(
    `[creator-commission-recovery] Result: status=${commission.status}; ` +
      `creator=${commission.creator_id}; ` +
      `eligible_revenue_minor=${commission.eligible_revenue_minor}; ` +
      `commission_amount_minor=${commission.commission_amount_minor}`
  );
}