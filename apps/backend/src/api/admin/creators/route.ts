import { z } from "@medusajs/framework/zod";
import type {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { CREATOR_PROGRAM_MODULE } from "../../../modules/creator-program";
import { createCreatorWorkflow } from "../../../workflows/create-creator";

const CreateCreatorSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().min(1).max(120).optional(),
  type: z.enum(["ambassador", "affiliate"]).optional(),
  code: z
    .string()
    .trim()
    .min(3)
    .max(32)
    .regex(/^[a-zA-Z0-9_-]+$/),

  discount_percent: z.number().min(0).max(100).optional(),
  commission_percent: z.number().min(0).max(100).optional(),

  is_active: z.boolean().optional(),
  is_featured: z.boolean().optional(),

  photo_url: z.string().url().nullable().optional(),
  social_handle: z.string().trim().max(100).nullable().optional(),
  bio: z.string().trim().max(1000).nullable().optional(),
});

function makeSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const creatorService = req.scope.resolve(CREATOR_PROGRAM_MODULE);

  const creators = await creatorService.listCreators();

  return res.json({ creators });
}

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const parsed = CreateCreatorSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid creator data.",
      errors: parsed.error.issues,
    });
  }

  const data = parsed.data;
  const creatorService = req.scope.resolve(CREATOR_PROGRAM_MODULE);

  const code = data.code.toUpperCase();
  const slug = makeSlug(data.slug || data.name);

  if (!slug) {
    return res.status(400).json({
      message: "A valid creator name or slug is required.",
    });
  }

  const existingCode = await creatorService.listCreators({ code });
  const existingSlug = await creatorService.listCreators({ slug });

  if (existingCode.length > 0) {
    return res.status(409).json({
      message: "This creator code already exists.",
    });
  }

  if (existingSlug.length > 0) {
    return res.status(409).json({
      message: "This creator slug already exists.",
    });
  }

  const input = {
    name: data.name,
    slug,
    type: data.type ?? "affiliate",
    code,
    discount_percent: data.discount_percent ?? 10,
    commission_percent: data.commission_percent ?? 10,
    is_active: data.is_active ?? true,
    is_featured: data.is_featured ?? false,
    photo_url: data.photo_url ?? null,
    social_handle: data.social_handle ?? null,
    bio: data.bio ?? null,
    promotion_id: null,
  };

  const { result } = await createCreatorWorkflow(req.scope).run({
    input,
  });

  return res.status(201).json({ creator: result.creator });
}