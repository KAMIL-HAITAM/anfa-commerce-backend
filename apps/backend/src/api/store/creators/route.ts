import type {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { CREATOR_PROGRAM_MODULE } from "../../../modules/creator-program";

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const creatorService = req.scope.resolve(CREATOR_PROGRAM_MODULE);

  const activeCreators = await creatorService.listCreators({
    is_active: true,
  });

  const ambassadors = activeCreators
    .filter(
      (creator) =>
        creator.is_active &&
        (creator.type === "ambassador" || creator.is_featured)
    )
    .map((creator) => ({
      id: creator.id,
      name: creator.name,
      slug: creator.slug,
      code: creator.code,
      photo_url: creator.photo_url,
      social_handle: creator.social_handle,
      bio: creator.bio,
      is_featured: creator.is_featured,
    }));

  return res.json({ ambassadors });
}