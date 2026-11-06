import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { markCreatorCommissionPaidStep } from "./steps/mark-creator-commission-paid";

type MarkPaidInput = {
  commissionId: string;
  payoutReference: string;
};

export const markCreatorCommissionPaidWorkflow = createWorkflow(
  "mark-creator-commission-paid",
  (input: MarkPaidInput) => {
    const commission = markCreatorCommissionPaidStep(input);

    return new WorkflowResponse({ commission });
  }
);