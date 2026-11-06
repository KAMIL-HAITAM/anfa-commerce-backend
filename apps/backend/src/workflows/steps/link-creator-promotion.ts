import {
  createStep,
  StepResponse,
} from "@medusajs/framework/workflows-sdk";

import { CREATOR_PROGRAM_MODULE } from "../../modules/creator-program";

type LinkCreatorPromotionInput = {
  creatorId: string;
  promotionId: string;
};

export const linkCreatorPromotionStep = createStep(
  "link-creator-promotion",
  async (input: LinkCreatorPromotionInput, { container }) => {
    const creatorService = container.resolve(CREATOR_PROGRAM_MODULE);

    const creator = await creatorService.updateCreators({
      id: input.creatorId,
      promotion_id: input.promotionId,
    });

    return new StepResponse(creator);
  }
);