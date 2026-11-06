import { defineRouteConfig } from "@medusajs/admin-sdk";
import { Button, Container, Heading } from "@medusajs/ui";
import { useCallback, useEffect, useState } from "react";

type GlovoDelivery = {
  id: string;
  order_id: string;
  order_display_id: string | null;
  status: string;
  provider_status: string | null;
  provider_tracking_number: string | null;
  provider_tracking_url: string | null;
  courier_name: string | null;
  last_event_at: string | null;
  created_at?: string;
};

type ConnectionState = {
  environment?: string;
  credentialsConfigured?: boolean;
  dispatchEnabled?: boolean;
  dispatchFlagRequested?: boolean;
  pickupAddressBookConfigured?: boolean;
  authenticated?: boolean;
  workingAreas?: unknown;
  pickupAddresses?: unknown;
  pickupAddressesMessage?: string | null;
  message?: string;
};

const GlovoDeliveriesPage = () => {
  const [deliveries, setDeliveries] = useState<GlovoDelivery[]>([]);
  const [trackingNumbers, setTrackingNumbers] = useState<Record<string, string>>({});
  const [trackingUrls, setTrackingUrls] = useState<Record<string, string>>({});
  const [connection, setConnection] = useState<ConnectionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [confirmingDeliveryId, setConfirmingDeliveryId] = useState<string | null>(null);
  const [registeringWebhooks, setRegisteringWebhooks] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadDeliveries = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/admin/glovo/deliveries", { credentials: "include" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || `Erreur ${response.status}`);
      const rows = Array.isArray(data.deliveries) ? data.deliveries as GlovoDelivery[] : [];
      setDeliveries(rows);
      setTrackingNumbers((current) => {
        const next = { ...current };
        for (const row of rows) next[row.id] ??= row.provider_tracking_number ?? "";
        return next;
      });
      setTrackingUrls((current) => {
        const next = { ...current };
        for (const row of rows) next[row.id] ??= row.provider_tracking_url ?? "";
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger les livraisons.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDeliveries();
  }, [loadDeliveries]);

  async function checkGlovoConnection() {
    setChecking(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/admin/glovo/connection", { credentials: "include" });
      const data = await response.json() as ConnectionState;
      if (!response.ok) throw new Error(data.message || `Erreur ${response.status}`);
      setConnection(data);
      setNotice(data.authenticated
        ? "Connexion Glovo vérifiée avec succès."
        : data.message || "Les identifiants Glovo ne sont pas encore configurés.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "La connexion Glovo n'a pas pu être vérifiée.");
    } finally {
      setChecking(false);
    }
  }

  async function saveTrackingReference(delivery: GlovoDelivery) {
    setSavingId(delivery.id);
    setError("");
    setNotice("");
    const trackingNumber = (trackingNumbers[delivery.id] ?? "").trim();
    const trackingUrl = (trackingUrls[delivery.id] ?? "").trim();
    if (!trackingNumber && !trackingUrl) {
      setError("Saisissez une référence Glovo ou un lien de suivi.");
      setSavingId(null);
      return;
    }

    try {
      const response = await fetch(`/admin/glovo/deliveries/${encodeURIComponent(delivery.id)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(trackingNumber ? { provider_tracking_number: trackingNumber } : {}),
          provider_tracking_url: trackingUrl || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || `Erreur ${response.status}`);
      setNotice(`Référence de suivi enregistrée pour ${delivery.order_display_id || delivery.order_id}.`);
      await loadDeliveries();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'enregistrer la référence.");
    } finally {
      setSavingId(null);
    }
  }
  async function confirmDelivered(delivery: GlovoDelivery) {
  const confirmed = window.confirm(
    `Confirm that ${delivery.order_display_id || delivery.order_id} ` +
      "has actually been delivered? Confirm only after verifying delivery."
  );

  if (!confirmed) return;

  setConfirmingDeliveryId(delivery.id);
  setError("");
  setNotice("");

  try {
    const response = await fetch(
      `/admin/glovo/deliveries/${encodeURIComponent(delivery.id)}/confirm-delivered`,
      {
        method: "POST",
        credentials: "include",
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `Erreur ${response.status}`);
    }

    const status = data.commission?.status;

    setNotice(
      status === "approved"
        ? "Livraison confirmée et commission approuvée."
        : "Livraison confirmée. La commission restera en attente tant que le paiement n'est pas confirmé."
    );

    await loadDeliveries();
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "Impossible de confirmer la livraison."
    );
  } finally {
    setConfirmingDeliveryId(null);
  }
}

  async function registerWebhooks() {
    setRegisteringWebhooks(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/admin/glovo/webhooks", {
        method: "POST",
        credentials: "include",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || `Erreur ${response.status}`);
      setNotice("Webhooks Glovo enregistrés ou déjà configurés.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'enregistrer les webhooks.");
    } finally {
      setRegisteringWebhooks(false);
    }
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex flex-col gap-3 px-6 py-5 md:flex-row md:items-center md:justify-between">
        <div>
          <Heading level="h1">Glovo On-Demand</Heading>
          <p className="mt-1 text-sm text-ui-fg-subtle">
            Suivi des livraisons ANFA et préparation de l'intégration Glovo.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => void loadDeliveries()} disabled={loading}>Actualiser</Button>
          <Button variant="secondary" onClick={() => void checkGlovoConnection()} disabled={checking}>
            {checking ? "Vérification..." : "Tester la connexion"}
          </Button>
          <Button onClick={() => void registerWebhooks()} disabled={registeringWebhooks || !connection?.authenticated}>
            {registeringWebhooks ? "Enregistrement..." : "Enregistrer les webhooks"}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 px-6 py-5 md:grid-cols-4">
        <div className="rounded-lg border border-ui-border-base p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ui-fg-subtle">Environnement</p>
          <p className="mt-2 text-lg font-semibold">{connection?.environment || "staging (par défaut)"}</p>
        </div>
        <div className="rounded-lg border border-ui-border-base p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ui-fg-subtle">Identifiants</p>
          <p className="mt-2 text-lg font-semibold">{connection?.credentialsConfigured ? "Configurés" : "En attente"}</p>
        </div>
        <div className="rounded-lg border border-ui-border-base p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ui-fg-subtle">Dispatch réel</p>
          <p className="mt-2 text-lg font-semibold">Désactivé — en attente de validation</p>
          {connection?.dispatchFlagRequested && <p className="mt-1 text-xs text-ui-fg-error">Le drapeau d'environnement est activé, mais la création automatique n'est pas encore branchée.</p>}
        </div>
        <div className="rounded-lg border border-ui-border-base p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ui-fg-subtle">Adresse d'enlèvement</p>
          <p className="mt-2 text-lg font-semibold">{connection?.pickupAddressBookConfigured ? "ID configuré" : "À confirmer avec Glovo"}</p>
        </div>
      </div>

      {(error || notice || connection?.message) && (
        <div className="px-6 py-4">
          {error && <p role="alert" className="text-sm text-ui-fg-error">{error}</p>}
          {!error && notice && <p role="status" className="text-sm text-ui-fg-interactive">{notice}</p>}
          {!error && !notice && connection?.message && <p className="text-sm text-ui-fg-subtle">{connection.message}</p>}
        </div>
      )}

      {connection?.authenticated && (
        <div className="px-6 py-5">
          <Heading level="h2">Zones et points d'enlèvement Glovo</Heading>
          <p className="mb-3 mt-1 text-sm text-ui-fg-subtle">
            Vérifiez que Casablanca et votre adresse d'enlèvement sont disponibles avant de préparer les devis et les demandes de livraison.
          </p>
          {connection.pickupAddressesMessage && <p className="mb-3 text-sm text-ui-fg-subtle">{connection.pickupAddressesMessage}</p>}
          <details className="rounded-lg border border-ui-border-base p-3">
            <summary className="cursor-pointer text-sm font-medium">Voir la réponse du carnet d'adresses (administration)</summary>
            <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-md bg-ui-bg-subtle p-3 text-xs">{JSON.stringify(connection.pickupAddresses, null, 2) ?? "Aucune donnée."}</pre>
          </details>
          <details className="mt-2 rounded-lg border border-ui-border-base p-3">
            <summary className="cursor-pointer text-sm font-medium">Voir les zones de service Glovo</summary>
            <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-md bg-ui-bg-subtle p-3 text-xs">{JSON.stringify(connection.workingAreas, null, 2) ?? "Aucune donnée."}</pre>
          </details>
        </div>
      )}

      <div className="px-6 py-5">
        <Heading level="h2">Livraisons suivies</Heading>
        <p className="mb-4 mt-1 text-sm text-ui-fg-subtle">
          Le suivi client utilise un lien sécurisé créé à la confirmation. Après une livraison Glovo créée dans leur outil, associez ici son numéro de suivi si la création automatique n'est pas encore activée.
        </p>
        {loading ? <p className="text-sm text-ui-fg-subtle">Chargement des livraisons...</p> : deliveries.length === 0 ? (
          <div className="rounded-lg border border-dashed border-ui-border-base p-6 text-sm text-ui-fg-subtle">
            Aucune commande ne possède encore d'enregistrement de suivi. Passez une commande de test après application de la migration pour vérifier la création automatique de cet enregistrement.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-ui-border-base">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-ui-bg-subtle text-ui-fg-subtle">
                <tr>
                  <th className="px-3 py-3 font-medium">Commande</th>
                  <th className="px-3 py-3 font-medium">Statut</th>
                  <th className="px-3 py-3 font-medium">N° suivi Glovo</th>
                  <th className="px-3 py-3 font-medium">Lien Glovo (facultatif)</th>
                  <th className="px-3 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.map((delivery) => (
                  <tr key={delivery.id} className="border-t border-ui-border-base align-top">
                    <td className="px-3 py-3">
                      <p className="font-medium">{delivery.order_display_id || delivery.order_id}</p>
                      <p className="mt-1 text-xs text-ui-fg-subtle">{delivery.id}</p>
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-medium">{delivery.status}</p>
                      {delivery.provider_status && <p className="mt-1 text-xs text-ui-fg-subtle">Glovo: {delivery.provider_status}</p>}
                      {delivery.courier_name && <p className="mt-1 text-xs text-ui-fg-subtle">Coursier: {delivery.courier_name}</p>}
                    </td>
                    <td className="px-3 py-3">
                      <input
                        className="w-52 rounded-md border border-ui-border-base bg-ui-bg-field px-2 py-2"
                        value={trackingNumbers[delivery.id] ?? ""}
                        onChange={(event) => setTrackingNumbers((current) => ({ ...current, [delivery.id]: event.target.value }))}
                        placeholder="GLV..."
                        aria-label={`Référence Glovo pour ${delivery.order_display_id || delivery.order_id}`}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <input
                        className="w-64 rounded-md border border-ui-border-base bg-ui-bg-field px-2 py-2"
                        value={trackingUrls[delivery.id] ?? ""}
                        onChange={(event) => setTrackingUrls((current) => ({ ...current, [delivery.id]: event.target.value }))}
                        placeholder="https://... (facultatif)"
                        aria-label={`Lien Glovo pour ${delivery.order_display_id || delivery.order_id}`}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <Button size="small" variant="secondary" disabled={savingId === delivery.id} onClick={() => void saveTrackingReference(delivery)}>
                        {savingId === delivery.id ? "Enregistrement..." : "Enregistrer"}
                      </Button>
                      <div className="mt-2">
  <Button
    size="small"
    variant="secondary"
    disabled={
      confirmingDeliveryId === delivery.id ||
      delivery.status === "DELIVERED" ||
      delivery.status === "CANCELLED" ||
      delivery.status === "ORDER_CANCELLED"
    }
    onClick={() => void confirmDelivered(delivery)}
  >
    {confirmingDeliveryId === delivery.id
      ? "Confirmation..."
      : delivery.status === "DELIVERED"
        ? "Déjà livrée"
        : "Confirmer livrée"}
  </Button>
</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="px-6 py-5 text-sm text-ui-fg-subtle">
        <strong className="text-ui-fg-base">Sécurité :</strong> la création de livraisons réelles reste désactivée par défaut. N'activez pas GLOVO_DISPATCH_ENABLED tant que Glovo n'a pas confirmé vos identifiants, l'adresse d'enlèvement et le scénario de paiement à la livraison.
      </div>
    </Container>
  );
};

export const config = defineRouteConfig({ label: "Glovo Deliveries" });
export default GlovoDeliveriesPage;
