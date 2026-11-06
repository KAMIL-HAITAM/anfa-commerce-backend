import {
  createStep,
  StepResponse,
} from "@medusajs/framework/workflows-sdk";

import {
  MedusaError,
  Modules,
} from "@medusajs/framework/utils";

export type CreateCreatorPromotionInput = {
  creatorId: string;
  code: string;
  discount_percent: number;
  is_active: boolean;
};

export const createCreatorPromotionStep = createStep(
  "create-creator-promotion",
  async (input: CreateCreatorPromotionInput, { container }) => {
    const promotionService = container.resolve(Modules.PROMOTION);

    const promotion = await promotionService.createPromotions({
      code: input.code,
      type: "standard",
      status: input.is_active ? "active" : "draft",
      application_method: {
        type: "percentage",
        target_type: "items",
        allocation: "across",
        value: input.discount_percent,
        currency_code: "mad",
      },
      metadata: {
        creator_id: input.creatorId,
      },
    });

    if (!promotion) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        "Creator promotion was not created."
      );
    }

    return new StepResponse(promotion, promotion.id);
  },
  async (promotionId, { container }) => {
    if (!promotionId) return;

    const promotionService = container.resolve(Modules.PROMOTION);
    await promotionService.deletePromotions(promotionId);
  }
);