
import {
  createWorkflow,
  WorkflowResponse,
  transform,
} from "@medusajs/framework/workflows-sdk";

import { updatePromotionsStatusWorkflow } from "@medusajs/medusa/core-flows";

import { updateCreatorStatusStep } from "./steps/update-creator-status";

type UpdateCreatorStatusInput = {
  creatorId: string;
  promotionId: string;
  is_active: boolean;
};

export const updateCreatorStatusWorkflow = createWorkflow(
  "update-creator-status",
  (input: UpdateCreatorStatusInput) => {
    const promotionStatus = transform(
      { is_active: input.is_active },
      (data) => (data.is_active ? "active" : "inactive")
    );

    updatePromotionsStatusWorkflow.runAsStep({
      input: {
        promotionsData: [
          {
            id: input.promotionId,
            status: promotionStatus,
          },
        ],
      },
    });

    const creator = updateCreatorStatusStep({
      creatorId: input.creatorId,
      is_active: input.is_active,
    });

    return new WorkflowResponse({ creator });
  }
);
