import {
  createStep,
  StepResponse,
} from "@medusajs/framework/workflows-sdk";
import { MedusaError } from "@medusajs/framework/utils";
import { CREATOR_PROGRAM_MODULE } from "../../modules/creator-program";

type MarkPaidInput = {
  commissionId: string;
  payoutReference: string;
};

export const markCreatorCommissionPaidStep = createStep(
  "mark-creator-commission-paid",
  async (input: MarkPaidInput, { container }) => {
    const service = container.resolve(CREATOR_PROGRAM_MODULE);

    const matches = await service.listCommissions({
      id: input.commissionId,
    });
    const commission = matches[0];

    if (!commission) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        "Commission not found."
      );
    }

    if (
      commission.status !== "approved" ||
      Number(commission.commission_amount_minor) <= 0
    ) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        "Only approved commissions with a positive amount can be paid."
      );
    }

    const updated = await service.updateCommissions({
      id: commission.id,
      status: "paid",
      payout_reference: input.payoutReference,
      paid_at: new Date(),
      paid_amount_minor: commission.commission_amount_minor,
    });

    const result = Array.isArray(updated) ? updated[0] : updated;

    return new StepResponse(result);
  }
);