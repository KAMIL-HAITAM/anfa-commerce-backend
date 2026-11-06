
import type {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";

import { z } from "@medusajs/framework/zod";
import { CREATOR_PROGRAM_MODULE } from "../../../../../modules/creator-program";
import { updateCreatorFeaturedWorkflow } from "../../../../../workflows/update-creator-featured";

const UpdateStatusSchema = z.object({
  is_featured: z.boolean(),
});

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const parsed = UpdateStatusSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid creator status.",
    });
  }

  const creatorService = req.scope.resolve(CREATOR_PROGRAM_MODULE);

  const creators = await creatorService.listCreators({
    id: req.params.id,
  });

  const creator = creators[0];

  if (!creator) {
    return res.status(404).json({
      message: "Creator not found.",
    });
  }

  if (!creator.promotion_id) {
    return res.status(409).json({
      message:
        "This creator has no linked promotion and cannot be featured.",
    });
  }

  const { result } = await updateCreatorFeaturedWorkflow(req.scope).run({
   input: {
     creatorId: creator.id,
     is_featured: parsed.data.is_featured,
   },
 });

  return res.json({ creator: result.creator });
}
