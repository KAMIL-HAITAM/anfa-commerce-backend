import { MedusaService } from "@medusajs/framework/utils";
import GlovoDelivery from "./models/delivery";

class GlovoDeliveryModuleService extends MedusaService({ GlovoDelivery }) {}

export default GlovoDeliveryModuleService;
