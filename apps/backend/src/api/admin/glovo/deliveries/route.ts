import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { GLOVO_DELIVERY_MODULE } from "../../../../modules/glovo-delivery";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve(GLOVO_DELIVERY_MODULE);
  const orderId = typeof req.query.order_id === "string" ? req.query.order_id : undefined;
  const deliveries = orderId
    ? await service.listGlovoDeliveries({ order_id: orderId })
    : await service.listGlovoDeliveries();

  return res.json({ deliveries });
}
