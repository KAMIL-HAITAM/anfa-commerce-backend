
import {
  createStep,
  StepResponse,
} from "@medusajs/framework/workflows-sdk";

import { MedusaError } from "@medusajs/framework/utils";
import { CREATOR_PROGRAM_MODULE } from "../../modules/creator-program";

type UpdateCreatorStatusInput = {
  creatorId: string;
  is_active: boolean;
};

export const updateCreatorStatusStep = createStep(
  "update-creator-status",
  async (input: UpdateCreatorStatusInput, { container }) => {
    const creatorService = container.resolve(CREATOR_PROGRAM_MODULE);

    const existing = await creatorService.listCreators({
      id: input.creatorId,
    });

    const creator = existing[0];

    if (!creator) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        "Creator not found."
      );
    }

    const updated = await creatorService.updateCreators({
      id: input.creatorId,
      is_active: input.is_active,
    });

    const updatedCreator = Array.isArray(updated)
      ? updated[0]
      : updated;

    return new StepResponse(updatedCreator, {
      creatorId: input.creatorId,
      previousIsActive: creator.is_active,
    });
  },
  async (compensation, { container }) => {
    if (!compensation) return;

    const creatorService = container.resolve(CREATOR_PROGRAM_MODULE);

    await creatorService.updateCreators({
      id: compensation.creatorId,
      is_active: compensation.previousIsActive,
    });
  }
);
