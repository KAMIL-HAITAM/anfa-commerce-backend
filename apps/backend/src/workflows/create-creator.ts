import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";

import {
  createCreatorStep,
  type CreateCreatorInput,
} from "./steps/create-creator";

import { createCreatorPromotionStep } from "./steps/create-creator-promotion";
import { linkCreatorPromotionStep } from "./steps/link-creator-promotion";

export const createCreatorWorkflow = createWorkflow(
  "create-creator",
  (input: CreateCreatorInput) => {
    const creator = createCreatorStep(input);

    const promotion = createCreatorPromotionStep({
      creatorId: creator.id,
      code: creator.code,
      discount_percent: creator.discount_percent,
      is_active: creator.is_active,
    });

    const linkedCreator = linkCreatorPromotionStep({
      creatorId: creator.id,
      promotionId: promotion.id,
    });

    return new WorkflowResponse({
      creator: linkedCreator,
      promotion,
    });
  }
);