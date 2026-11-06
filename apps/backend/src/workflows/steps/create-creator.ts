import {
  createStep,
  StepResponse,
} from "@medusajs/framework/workflows-sdk";

import { CREATOR_PROGRAM_MODULE } from "../../modules/creator-program";
import { MedusaError } from "@medusajs/framework/utils";

export type CreateCreatorInput = {
  name: string;
  slug: string;
  type: "ambassador" | "affiliate";
  code: string;
  discount_percent: number;
  commission_percent: number;
  is_active: boolean;
  is_featured: boolean;
  photo_url: string | null;
  social_handle: string | null;
  bio: string | null;
  promotion_id: string | null;
};

export const createCreatorStep = createStep(
  "create-creator",
  async (input: CreateCreatorInput, { container }) => {
    const creatorService = container.resolve(
      CREATOR_PROGRAM_MODULE
    );

    const created = await creatorService.createCreators(input);
    const creator = Array.isArray(created) ? created[0] : created;

    if (!creator) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        "Creator creation returned no record."
      );
    }

    return new StepResponse(creator, creator.id);
  },
  async (creatorId, { container }) => {
    if (!creatorId) return;

    const creatorService = container.resolve(
      CREATOR_PROGRAM_MODULE
    );

    await creatorService.deleteCreators(creatorId);
  }
);