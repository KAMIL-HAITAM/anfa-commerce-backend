import { MedusaService } from "@medusajs/framework/utils";

import Creator from "./models/creator";
import Commission from "./models/commission";

class CreatorProgramModuleService extends MedusaService({
  Creator,
  Commission,
}) {}

export default CreatorProgramModuleService;