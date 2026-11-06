import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";

import { updateCreatorFeaturedStep } from "./steps/update-creator-featured";

type UpdateCreatorFeaturedInput = {
  creatorId: string;
  is_featured: boolean;
};

export const updateCreatorFeaturedWorkflow = createWorkflow(
  "update-creator-featured",
  (input: UpdateCreatorFeaturedInput) => {
    const creator = updateCreatorFeaturedStep(input);

    return new WorkflowResponse({ creator });
  }
);