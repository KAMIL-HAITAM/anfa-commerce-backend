import {
  createStep,
  StepResponse,
} from "@medusajs/framework/workflows-sdk";

import { MedusaError } from "@medusajs/framework/utils";
import { CREATOR_PROGRAM_MODULE } from "../../modules/creator-program";

type UpdateCreatorFeaturedInput = {
  creatorId: string;
  is_featured: boolean;
};

export const updateCreatorFeaturedStep = createStep(
  "update-creator-featured",
  async (input: UpdateCreatorFeaturedInput, { container }) => {
    const service = container.resolve(CREATOR_PROGRAM_MODULE);

    const existing = await service.listCreators({
      id: input.creatorId,
    });

    const creator = existing[0];

    if (!creator) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        "Creator not found."
      );
    }

    const updated = await service.updateCreators({
      id: input.creatorId,
      is_featured: input.is_featured,
    });

    const updatedCreator = Array.isArray(updated)
      ? updated[0]
      : updated;

    return new StepResponse(updatedCreator, {
      creatorId: creator.id,
      previousIsFeatured: creator.is_featured,
    });
  },
  async (compensation, { container }) => {
    if (!compensation) return;

    const service = container.resolve(CREATOR_PROGRAM_MODULE);

    await service.updateCreators({
      id: compensation.creatorId,
      is_featured: compensation.previousIsFeatured,
    });
  }
);