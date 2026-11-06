import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { getGlovoAddresses, getGlovoWorkingAreas, glovoConfigSummary } from "../../../../lib/glovo-client";

export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  const config = glovoConfigSummary();
  if (!config.credentialsConfigured) {
    return res.json({ ...config, authenticated: false, message: "Ajoutez les identifiants Glovo après leur réception." });
  }

  try {
    const workingAreas = await getGlovoWorkingAreas();
    let pickupAddresses: unknown = null;
    let pickupAddressesMessage: string | null = null;
    try {
      pickupAddresses = await getGlovoAddresses();
    } catch {
      pickupAddressesMessage = "L'accès au carnet d'adresses Glovo n'est pas disponible pour le moment.";
    }
    return res.json({
      ...config,
      authenticated: true,
      workingAreas,
      pickupAddresses,
      pickupAddressesMessage,
    });
  } catch {
    return res.status(502).json({
      ...config,
      authenticated: false,
      message: "La connexion Glovo n'a pas pu être vérifiée. Vérifiez l'environnement et les identifiants.",
    });
  }
}
