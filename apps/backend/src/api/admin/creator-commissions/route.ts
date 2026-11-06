import type {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { z } from "@medusajs/framework/zod";
import { CREATOR_PROGRAM_MODULE } from "../../../modules/creator-program";
import { markCreatorCommissionPaidWorkflow } from "../../../workflows/mark-creator-commission-paid";

const MarkPaidSchema = z.object({
  commission_id: z.string().trim().min(1).max(200),
  payout_reference: z.string().trim().min(1).max(200),
});

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const service = req.scope.resolve(CREATOR_PROGRAM_MODULE);

  const [commissions, creators] = await Promise.all([
    service.listCommissions(),
    service.listCreators(),
  ]);

  const creatorsById = new Map(
    creators.map((creator) => [
      creator.id,
      { name: creator.name, code: creator.code },
    ])
  );

  return res.json({
    commissions: commissions.map((commission) => ({
      ...commission,
      creator: creatorsById.get(commission.creator_id) ?? null,
      clawback_due_minor: Math.max(
        0,
        Number(commission.paid_amount_minor ?? 0) -
          Number(commission.commission_amount_minor ?? 0)
      ),
    })),
  });
}

export async function PATCH(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const parsed = MarkPaidSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid payout data.",
      errors: parsed.error.issues,
    });
  }

  const service = req.scope.resolve(CREATOR_PROGRAM_MODULE);
  const matches = await service.listCommissions({
    id: parsed.data.commission_id,
  });
  const commission = matches[0];

  if (!commission) {
    return res.status(404).json({ message: "Commission not found." });
  }

  if (
    commission.status !== "approved" ||
    Number(commission.commission_amount_minor) <= 0
  ) {
    return res.status(409).json({
      message: "Only approved commissions with a positive amount can be paid.",
    });
  }

  const { result } = await markCreatorCommissionPaidWorkflow(req.scope).run({
    input: {
      commissionId: parsed.data.commission_id,
      payoutReference: parsed.data.payout_reference,
    },
  });

  return res.json({ commission: result.commission });
}