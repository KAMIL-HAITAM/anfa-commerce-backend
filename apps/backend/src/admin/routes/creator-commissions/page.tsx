import { defineRouteConfig } from "@medusajs/admin-sdk";
import { Button, Container, Heading } from "@medusajs/ui";
import { useCallback, useEffect, useState } from "react";

type CommissionStatus = "pending" | "approved" | "paid" | "reversed";

type Commission = {
  id: string;
  creator_id: string;
  order_id: string;
  currency_code: string;
  eligible_revenue_minor: number;
  commission_rate: number;
  commission_amount_minor: number;
  paid_amount_minor: number;
  status: CommissionStatus;
  payout_reference: string | null;
  paid_at: string | null;
  created_at?: string;
  clawback_due_minor: number;
  creator: {
    name: string;
    code: string;
  } | null;
};

function currencyScale(currencyCode: string): number {
  try {
    const digits = new Intl.NumberFormat("en", {
      style: "currency",
      currency: currencyCode.toUpperCase(),
    }).resolvedOptions().maximumFractionDigits;

    return 10 ** (digits ?? 2);
  } catch {
    return 100;
  }
}

function formatMoney(minor: number, currencyCode: string): string {
  const currency = currencyCode.toUpperCase();
  const major = Number(minor || 0) / currencyScale(currencyCode);

  try {
    return new Intl.NumberFormat("fr-MA", {
      style: "currency",
      currency,
    }).format(major);
  } catch {
    return `${major.toFixed(2)} ${currency}`;
  }
}

function statusLabel(status: CommissionStatus): string {
  switch (status) {
    case "pending":
      return "En attente";
    case "approved":
      return "Approuvée";
    case "paid":
      return "Payée";
    case "reversed":
      return "Annulée";
  }
}

const CreatorCommissionsPage = () => {
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [references, setReferences] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadCommissions = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/admin/creator-commissions", {
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || `Erreur ${response.status}`
        );
      }

      const rows = Array.isArray(data.commissions)
        ? (data.commissions as Commission[])
        : [];

      setCommissions(rows);
      setReferences((current) => {
        const next = { ...current };

        for (const commission of rows) {
          next[commission.id] ??= "";
        }

        return next;
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossible de charger les commissions."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCommissions();
  }, [loadCommissions]);

  async function markAsPaid(commission: Commission) {
    const payoutReference = (
      references[commission.id] ?? ""
    ).trim();

    if (!payoutReference) {
      setError("Saisissez la référence du paiement avant de continuer.");
      return;
    }

    if (
      commission.status !== "approved" ||
      commission.commission_amount_minor <= 0
    ) {
      setError("Cette commission n'est pas éligible au paiement.");
      return;
    }

    const confirmed = window.confirm(
      `Confirmer le paiement de ${formatMoney(
        commission.commission_amount_minor,
        commission.currency_code
      )} pour ${commission.creator?.name ?? "ce créateur"} ?\n\n` +
        "Confirmez uniquement si le virement a réellement été effectué."
    );

    if (!confirmed) return;

    setSavingId(commission.id);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/admin/creator-commissions", {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          commission_id: commission.id,
          payout_reference: payoutReference,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || `Erreur ${response.status}`
        );
      }

      setNotice(
        `Paiement enregistré pour ${
          commission.creator?.name ?? commission.order_id
        }.`
      );

      await loadCommissions();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossible d'enregistrer le paiement."
      );
    } finally {
      setSavingId(null);
    }
  }

  const totalApproved = commissions
    .filter((item) => item.status === "approved")
    .reduce(
      (sum, item) => sum + item.commission_amount_minor,
      0
    );

  const totalPending = commissions
    .filter((item) => item.status === "pending")
    .reduce(
      (sum, item) => sum + item.commission_amount_minor,
      0
    );

  const madTotal = (minor: number) => formatMoney(minor, "mad");

  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-5">
        <Heading level="h1">Creator Commissions</Heading>
        <p className="mt-2 text-sm text-ui-fg-subtle">
          Suivez les commissions, vérifiez les montants approuvés
          et enregistrez les paiements manuels des créateurs.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 px-6 py-5 md:grid-cols-3">
        <div className="rounded-lg border border-ui-border-base p-4">
          <p className="text-sm text-ui-fg-subtle">
            Commissions en attente
          </p>
          <p className="mt-2 text-xl font-semibold">
            {madTotal(totalPending)}
          </p>
        </div>

        <div className="rounded-lg border border-ui-border-base p-4">
          <p className="text-sm text-ui-fg-subtle">
            Approuvées, à payer
          </p>
          <p className="mt-2 text-xl font-semibold">
            {madTotal(totalApproved)}
          </p>
        </div>

        <div className="rounded-lg border border-ui-border-base p-4">
          <p className="text-sm text-ui-fg-subtle">
            Nombre de commissions
          </p>
          <p className="mt-2 text-xl font-semibold">
            {commissions.length}
          </p>
        </div>
      </div>

      <div className="px-6 py-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <Heading level="h2">Historique des commissions</Heading>

          <Button
            variant="secondary"
            onClick={() => void loadCommissions()}
            disabled={loading}
          >
            {loading ? "Chargement..." : "Actualiser"}
          </Button>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-4 rounded-lg border border-ui-border-error p-3 text-sm"
          >
            {error}
          </div>
        )}

        {notice && (
          <div
            role="status"
            className="mb-4 rounded-lg border border-ui-border-base p-3 text-sm"
          >
            {notice}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-ui-fg-subtle">
            Chargement des commissions...
          </p>
        ) : commissions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-ui-border-base p-6 text-sm text-ui-fg-subtle">
            Aucune commission enregistrée pour le moment.
            Les commissions apparaîtront lorsqu'une commande
            admissible utilisera une promotion de créateur.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-ui-border-base">
            <table className="w-full min-w-[1150px] text-left text-sm">
              <thead className="bg-ui-bg-subtle text-ui-fg-subtle">
                <tr>
                  <th className="px-3 py-3 font-medium">Créateur</th>
                  <th className="px-3 py-3 font-medium">Commande</th>
                  <th className="px-3 py-3 font-medium">Revenu éligible</th>
                  <th className="px-3 py-3 font-medium">Taux</th>
                  <th className="px-3 py-3 font-medium">Commission actuelle</th>
                  <th className="px-3 py-3 font-medium">Statut</th>
                  <th className="px-3 py-3 font-medium">Historique / action</th>
                </tr>
              </thead>

              <tbody>
                {commissions.map((commission) => (
                  <tr
                    key={commission.id}
                    className="border-t border-ui-border-base align-top"
                  >
                    <td className="px-3 py-3">
                      <p className="font-medium">
                        {commission.creator?.name ?? "Créateur inconnu"}
                      </p>
                      <p className="mt-1 text-xs text-ui-fg-subtle">
                        {commission.creator?.code ?? commission.creator_id}
                      </p>
                    </td>

                    <td className="px-3 py-3">
                      <p className="font-medium">
                        {commission.order_id}
                      </p>
                      <p className="mt-1 text-xs text-ui-fg-subtle">
                        {commission.id}
                      </p>
                    </td>

                    <td className="px-3 py-3">
                      {formatMoney(
                        commission.eligible_revenue_minor,
                        commission.currency_code
                      )}
                    </td>

                    <td className="px-3 py-3">
                      {commission.commission_rate}%
                    </td>

                    <td className="px-3 py-3 font-medium">
                      {formatMoney(
                        commission.commission_amount_minor,
                        commission.currency_code
                      )}

                      {commission.clawback_due_minor > 0 && (
                        <p className="mt-1 text-xs text-ui-fg-subtle">
                          À régulariser :{" "}
                          {formatMoney(
                            commission.clawback_due_minor,
                            commission.currency_code
                          )}
                        </p>
                      )}
                    </td>

                    <td className="px-3 py-3">
                      {statusLabel(commission.status)}
                    </td>

                    <td className="min-w-[260px] px-3 py-3">
                      {commission.status === "paid" ? (
                        <>
                          <p>
                            Payé :{" "}
                            {formatMoney(
                              commission.paid_amount_minor,
                              commission.currency_code
                            )}
                          </p>
                          <p className="mt-1 text-xs text-ui-fg-subtle">
                            Référence :{" "}
                            {commission.payout_reference || "Non renseignée"}
                          </p>
                          {commission.paid_at && (
                            <p className="mt-1 text-xs text-ui-fg-subtle">
                              {new Date(commission.paid_at).toLocaleString("fr-MA")}
                            </p>
                          )}
                        </>
                      ) : commission.status === "approved" ? (
                        <div className="flex flex-col items-start gap-2">
                          <input
                            className="w-full rounded-md border border-ui-border-base bg-ui-bg-field px-3 py-2"
                            value={references[commission.id] ?? ""}
                            onChange={(event) =>
                              setReferences((current) => ({
                                ...current,
                                [commission.id]: event.target.value,
                              }))
                            }
                            placeholder="Référence du virement"
                            aria-label={`Référence de paiement pour ${commission.order_id}`}
                            maxLength={200}
                          />

                          <Button
                            size="small"
                            variant="secondary"
                            disabled={savingId === commission.id}
                            onClick={() => void markAsPaid(commission)}
                          >
                            {savingId === commission.id
                              ? "Enregistrement..."
                              : "Enregistrer le paiement"}
                          </Button>
                        </div>
                      ) : (
                        <span className="text-ui-fg-subtle">
                          {commission.status === "pending"
                            ? "En attente de livraison et de paiement"
                            : "Aucune action disponible"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Container>
  );
};

export const config = defineRouteConfig({
  label: "Creator Commissions",
});

export default CreatorCommissionsPage;