import { Module } from "@medusajs/framework/utils";
import CreatorProgramModuleService from "./service";

export const CREATOR_PROGRAM_MODULE = "creator_program";

export default Module(CREATOR_PROGRAM_MODULE, {
  service: CreatorProgramModuleService,
});