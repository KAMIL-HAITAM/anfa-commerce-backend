import { Module } from "@medusajs/framework/utils";
import GlovoDeliveryModuleService from "./service";

export const GLOVO_DELIVERY_MODULE = "glovo_delivery";

export default Module(GLOVO_DELIVERY_MODULE, {
  service: GlovoDeliveryModuleService,
});
