
import type {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";

import { z } from "@medusajs/framework/zod";
import { CREATOR_PROGRAM_MODULE } from "../../../../modules/creator-program";
import { updateCreatorStatusWorkflow } from "../../../../workflows/update-creator-status";

// Activate / deactivate creator
const UpdateStatusSchema = z.object({
  is_active: z.boolean(),
});

// Edit creator profile
const UpdateCreatorProfileSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  type: z.enum(["ambassador", "affiliate"]).optional(),
  photo_url: z.string().url().nullable().optional(),
  social_handle: z.string().trim().max(100).nullable().optional(),
  bio: z.string().trim().max(1000).nullable().optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: "At least one profile field must be provided.",
});

function makeSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// POST /admin/creators/:id
// Activate or deactivate a creator
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
        "This creator has no linked promotion and cannot be activated.",
    });
  }

  const { result } = await updateCreatorStatusWorkflow(req.scope).run({
    input: {
      creatorId: creator.id,
      promotionId: creator.promotion_id,
      is_active: parsed.data.is_active,
    },
  });

  return res.json({ creator: result.creator });
}

// PATCH /admin/creators/:id
// Edit creator profile
export async function PATCH(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const parsed = UpdateCreatorProfileSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid creator profile data.",
      errors: parsed.error.issues,
    });
  }

  const creatorService = req.scope.resolve(CREATOR_PROGRAM_MODULE);

  const existingCreators = await creatorService.listCreators({
    id: req.params.id,
  });

  const existing = existingCreators[0];

  if (!existing) {
    return res.status(404).json({
      message: "Creator not found.",
    });
  }

  const updates: {
    name?: string;
    slug?: string;
    type?: "ambassador" | "affiliate";
    photo_url?: string | null;
    social_handle?: string | null;
    bio?: string | null;
  } = {};

  const data = parsed.data;

  if (data.name !== undefined) {
    const slug = makeSlug(data.name);

    if (!slug) {
      return res.status(400).json({
        message: "A valid creator name is required.",
      });
    }

    const slugMatches = await creatorService.listCreators({ slug });

    if (slugMatches.some((creator) => creator.id !== existing.id)) {
      return res.status(409).json({
        message: "Another creator already uses a similar name/slug.",
      });
    }

    updates.name = data.name;
    updates.slug = slug;
  }

  if (data.type !== undefined) updates.type = data.type;
  if (data.photo_url !== undefined) updates.photo_url = data.photo_url;
  if (data.social_handle !== undefined) updates.social_handle = data.social_handle;
  if (data.bio !== undefined) updates.bio = data.bio;

  const updated = await creatorService.updateCreators({
    id: existing.id,
    ...updates,
  });

  const updatedCreator = Array.isArray(updated) ? updated[0] : updated;

  return res.json({ creator: updatedCreator });
}
