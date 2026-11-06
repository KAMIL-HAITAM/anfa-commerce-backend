
import { defineRouteConfig } from "@medusajs/admin-sdk";
import {
  Container,
  Heading,
  Button,
} from "@medusajs/ui";
import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";

type Creator = {
  id: string;
  name: string;
  slug: string;
  type: "ambassador" | "affiliate";
  code: string;
  discount_percent: number;
  commission_percent: number;
  is_active: boolean;
  is_featured: boolean;
  photo_url: string | null;
  social_handle: string | null;
  bio: string | null;
  promotion_id: string | null;
};

type CreatorForm = {
  name: string;
  type: "ambassador" | "affiliate";
  code: string;
  discount_percent: string;
  commission_percent: string;
  photo_url: string;
  social_handle: string;
  bio: string;
  is_featured: boolean;
};

type CreatorProfileForm = {
  name: string;
  type: "ambassador" | "affiliate";
  photo_url: string;
  social_handle: string;
  bio: string;
};

const initialForm: CreatorForm = {
  name: "",
  type: "affiliate",
  code: "",
  discount_percent: "10",
  commission_percent: "8",
  photo_url: "",
  social_handle: "",
  bio: "",
  is_featured: false,
};

const CreatorsPage = () => {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [form, setForm] = useState<CreatorForm>(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [updatingFeaturedCreatorId, setUpdatingFeaturedCreatorId] =
    useState<string | null>(null);
  const [updatingCreatorId, setUpdatingCreatorId] =
    useState<string | null>(null);
  const [editingCreatorId, setEditingCreatorId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<CreatorProfileForm | null>(null);
  const [uploadingPhotoFor, setUploadingPhotoFor] = useState<string | null>(null);

  const loadCreators = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/admin/creators", {
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || `Request failed (${response.status})`
        );
      }

      setCreators(Array.isArray(data.creators) ? data.creators : []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossible de charger les créateurs."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCreators();
  }, [loadCreators]);

  function updateField<K extends keyof CreatorForm>(
    field: K,
    value: CreatorForm[K]
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateEditField<K extends keyof CreatorProfileForm>(
    field: K,
    value: CreatorProfileForm[K]
  ) {
    setEditForm((current) =>
      current ? { ...current, [field]: value } : current
    );
  }

  function startEditing(creator: Creator) {
    setEditingCreatorId(creator.id);
    setEditForm({
      name: creator.name,
      type: creator.type,
      photo_url: creator.photo_url || "",
      social_handle: creator.social_handle || "",
      bio: creator.bio || "",
    });
    setError("");
    setNotice("");
  }

  function cancelEditing() {
    setEditingCreatorId(null);
    setEditForm(null);
  }

  async function uploadCreatorPhoto(file: File, target: "new" | "edit") {
    const uploadKey = target === "new" ? "new" : editingCreatorId;
    if (target === "edit" && !editingCreatorId) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      setError("Format non pris en charge. Utilisez JPG, PNG, WEBP ou GIF.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("La photo doit faire 5 Mo maximum.");
      return;
    }

    setUploadingPhotoFor(uploadKey);
    setError("");
    setNotice("");

    try {
      const body = new FormData();
      body.append("files", file);

      const response = await fetch("/admin/uploads", {
        method: "POST",
        credentials: "include",
        body,
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || `Échec de l'importation (${response.status})`
        );
      }

      const url = data.files?.[0]?.url;
      if (typeof url !== "string" || !url) {
        throw new Error("Medusa n'a pas renvoyé l'URL de la photo.");
      }

      if (target === "new") {
        updateField("photo_url", url);
      } else {
        updateEditField("photo_url", url);
      }
      setNotice("Photo importée. Enregistrez le formulaire pour appliquer la modification.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossible d'importer cette photo."
      );
    } finally {
      setUploadingPhotoFor(null);
    }
  }

  async function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingCreatorId || !editForm) return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(
        `/admin/creators/${encodeURIComponent(editingCreatorId)}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: editForm.name.trim(),
            type: editForm.type,
            photo_url: editForm.photo_url.trim() || null,
            social_handle: editForm.social_handle.trim() || null,
            bio: editForm.bio.trim() || null,
          }),
        }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `Erreur ${response.status}`);
      }
      if (!data.creator) {
        throw new Error("La réponse ne contient pas le créateur modifié.");
      }

      setCreators((current) =>
        current.map((creator) =>
          creator.id === editingCreatorId ? (data.creator as Creator) : creator
        )
      );
      setEditingCreatorId(null);
      setEditForm(null);
      setNotice("Profil du créateur mis à jour.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossible de modifier ce profil."
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleCreatorStatus(creator: Creator) {
  if (!creator.promotion_id) {
    setError("Ce créateur n'a pas de promotion liée.");
    return;
  }

  const nextStatus = !creator.is_active;

  setUpdatingCreatorId(creator.id);
  setError("");
  setNotice("");

  try {
    const response = await fetch(
      `/admin/creators/${encodeURIComponent(creator.id)}`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          is_active: nextStatus,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.message || `Erreur ${response.status}`
      );
    }

    setCreators((current) =>
      current.map((item) =>
        item.id === creator.id ? data.creator as Creator : item
      )
    );

    setNotice(
      nextStatus
        ? "Créateur activé et promotion activée."
        : "Créateur désactivé et promotion désactivée."
    );
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "Impossible de modifier le statut."
    );
  } finally {
    setUpdatingCreatorId(null);
  }
}


  async function toggleCreatorFeatured(creator: Creator) {
  const nextFeatured = !creator.is_featured;

  setUpdatingFeaturedCreatorId(creator.id);
  setError("");
  setNotice("");

  try {
    const response = await fetch(
      `/admin/creators/${encodeURIComponent(creator.id)}/featured`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          is_featured: nextFeatured,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.message || `Erreur ${response.status}`
      );
    }

    setCreators((current) =>
      current.map((item) =>
        item.id === creator.id
          ? (data.creator as Creator)
          : item
      )
    );

    setNotice(
      nextFeatured
        ? "Créateur sélectionné pour la mise en avant publique."
        : "Créateur retiré de la mise en avant publique."
    );
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "Impossible de modifier la mise en avant."
    );
  } finally {
    setUpdatingFeaturedCreatorId(null);
  }
}
 async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/admin/creators", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: form.name.trim(),
          type: form.type,
          code: form.code.trim().toUpperCase(),
          discount_percent: Number(form.discount_percent),
          commission_percent: Number(form.commission_percent),
          is_active: false,
          is_featured: form.is_featured,
          photo_url: form.photo_url.trim() || null,
          social_handle: form.social_handle.trim() || null,
          bio: form.bio.trim() || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || `Creator creation failed (${response.status})`
        );
      }

      if (data.creator) {
        setCreators((current) => [
          data.creator as Creator,
          ...current,
        ]);
      } else {
        await loadCreators();
      }

      setForm(initialForm);
      setNotice(
        "Créateur enregistré. Son code reste inactif pour le moment."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossible d'enregistrer ce créateur."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Container className="flex flex-col gap-y-6 py-6">
      <div className="flex flex-col gap-y-1">
        <Heading level="h1">Creator Program</Heading>
        <p className="text-ui-fg-subtle text-sm">
          Gestion des ambassadeurs, affiliés, codes et rémunérations.
        </p>
      </div>

      {notice && (
        <p className="text-ui-fg-subtle" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="text-ui-fg-error" role="alert">
          {error}
        </p>
      )}

      <div className="rounded-lg border border-ui-border-base p-5">
        <div className="mb-5 flex flex-col gap-y-1">
          <Heading level="h2">Ajouter un créateur</Heading>
          <p className="text-ui-fg-subtle text-sm">
            Les nouveaux codes sont créés en mode inactif.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 gap-4 md:grid-cols-2"
        >
          <label className="flex flex-col gap-y-1 text-sm">
            Nom du créateur *
            <input
              required
              maxLength={120}
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              className="rounded-md border border-ui-border-base px-3 py-2"
              placeholder="Nom public"
            />
          </label>

          <label className="flex flex-col gap-y-1 text-sm">
            Type *
            <select
              value={form.type}
              onChange={(e) =>
                updateField(
                  "type",
                  e.target.value as CreatorForm["type"]
                )
              }
              className="rounded-md border border-ui-border-base px-3 py-2"
            >
              <option value="affiliate">Affilié</option>
              <option value="ambassador">Ambassadeur</option>
            </select>
          </label>

          <label className="flex flex-col gap-y-1 text-sm">
            Code créateur *
            <input
              required
              minLength={3}
              maxLength={32}
              pattern="[A-Za-z0-9_-]+"
              value={form.code}
              onChange={(e) =>
                updateField("code", e.target.value.toUpperCase())
              }
              className="rounded-md border border-ui-border-base px-3 py-2"
              placeholder="YASSINE10"
            />
          </label>

          <label className="flex flex-col gap-y-1 text-sm">
            Réduction client (%) *
            <input
              required
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={form.discount_percent}
              onChange={(e) =>
                updateField("discount_percent", e.target.value)
              }
              className="rounded-md border border-ui-border-base px-3 py-2"
            />
          </label>

          <label className="flex flex-col gap-y-1 text-sm">
            Commission créateur (%) *
            <input
              required
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={form.commission_percent}
              onChange={(e) =>
                updateField("commission_percent", e.target.value)
              }
              className="rounded-md border border-ui-border-base px-3 py-2"
            />
          </label>

          <label className="flex flex-col gap-y-1 text-sm">
            Réseau social
            <input
              maxLength={100}
              value={form.social_handle}
              onChange={(e) =>
                updateField("social_handle", e.target.value)
              }
              className="rounded-md border border-ui-border-base px-3 py-2"
              placeholder="@createur"
            />
          </label>

          <div className="flex flex-col gap-y-2 text-sm md:col-span-2">
            <label className="flex flex-col gap-y-1">
              Photo du créateur
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                disabled={uploadingPhotoFor === "new"}
                onChange={(e) => {
                  const file = e.currentTarget.files?.[0];
                  e.currentTarget.value = "";
                  if (file) void uploadCreatorPhoto(file, "new");
                }}
                className="block w-full rounded-md border border-ui-border-base px-3 py-2"
              />
            </label>
            <p className="text-xs text-ui-fg-subtle">JPG, PNG, WEBP ou GIF — 5 Mo maximum.</p>
            {uploadingPhotoFor === "new" && (
              <p className="text-ui-fg-subtle">Importation de la photo...</p>
            )}
            {form.photo_url && (
              <div className="flex items-center gap-x-3">
                <img
                  src={form.photo_url}
                  alt="Aperçu de la photo du créateur"
                  className="h-16 w-16 rounded-md border border-ui-border-base object-cover"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => updateField("photo_url", "")}
                >
                  Retirer la photo
                </Button>
              </div>
            )}
          </div>

          <label className="flex flex-col gap-y-1 text-sm md:col-span-2">
            Biographie
            <textarea
              maxLength={1000}
              rows={3}
              value={form.bio}
              onChange={(e) => updateField("bio", e.target.value)}
              className="rounded-md border border-ui-border-base px-3 py-2"
              placeholder="Présentation du créateur..."
            />
          </label>

          <label className="flex items-center gap-x-2 text-sm md:col-span-2">
            <input
              type="checkbox"
              checked={form.is_featured}
              onChange={(e) =>
                updateField("is_featured", e.target.checked)
              }
            />
            Sélectionner pour la mise en avant publique
          </label>

          <div className="md:col-span-2">
            <Button type="submit" disabled={saving || uploadingPhotoFor === "new"}>
              {saving ? "Enregistrement..." : uploadingPhotoFor === "new" ? "Importation de la photo..." : "Créer le créateur"}
            </Button>
          </div>
        </form>

      </div>

      {editingCreatorId && editForm && (
        <div className="rounded-lg border border-ui-border-base p-5">
          <div className="mb-5 flex flex-col gap-y-1">
            <Heading level="h2">Modifier le profil</Heading>
            <p className="text-ui-fg-subtle text-sm">
              Modifiez les informations publiques du créateur. Le code promo, la réduction client et la commission ne sont pas modifiés ici.
            </p>
          </div>

          <form
            onSubmit={handleEditSubmit}
            className="grid grid-cols-1 gap-4 md:grid-cols-2"
          >
            <label className="flex flex-col gap-y-1 text-sm">
              Nom du créateur *
              <input
                required
                maxLength={120}
                value={editForm.name}
                onChange={(e) => updateEditField("name", e.target.value)}
                className="rounded-md border border-ui-border-base px-3 py-2"
              />
            </label>

            <label className="flex flex-col gap-y-1 text-sm">
              Type *
              <select
                value={editForm.type}
                onChange={(e) =>
                  updateEditField("type", e.target.value as CreatorProfileForm["type"])
                }
                className="rounded-md border border-ui-border-base px-3 py-2"
              >
                <option value="affiliate">Affilié</option>
                <option value="ambassador">Ambassadeur</option>
              </select>
            </label>

            <label className="flex flex-col gap-y-1 text-sm md:col-span-2">
              Réseau social
              <input
                maxLength={100}
                value={editForm.social_handle}
                onChange={(e) => updateEditField("social_handle", e.target.value)}
                className="rounded-md border border-ui-border-base px-3 py-2"
                placeholder="@createur"
              />
            </label>

            <div className="flex flex-col gap-y-2 text-sm md:col-span-2">
              <label className="flex flex-col gap-y-1">
                Photo du créateur
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  disabled={uploadingPhotoFor === editingCreatorId}
                  onChange={(e) => {
                    const file = e.currentTarget.files?.[0];
                    e.currentTarget.value = "";
                    if (file) void uploadCreatorPhoto(file, "edit");
                  }}
                  className="block w-full rounded-md border border-ui-border-base px-3 py-2"
                />
              </label>
              <p className="text-xs text-ui-fg-subtle">JPG, PNG, WEBP ou GIF — 5 Mo maximum.</p>
              {uploadingPhotoFor === editingCreatorId && (
                <p className="text-ui-fg-subtle">Importation de la photo...</p>
              )}
              {editForm.photo_url && (
                <div className="flex items-center gap-x-3">
                  <img
                    src={editForm.photo_url}
                    alt="Aperçu de la photo du créateur"
                    className="h-16 w-16 rounded-md border border-ui-border-base object-cover"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => updateEditField("photo_url", "")}
                  >
                    Retirer la photo
                  </Button>
                </div>
              )}
            </div>

            <label className="flex flex-col gap-y-1 text-sm md:col-span-2">
              Biographie
              <textarea
                maxLength={1000}
                rows={4}
                value={editForm.bio}
                onChange={(e) => updateEditField("bio", e.target.value)}
                className="rounded-md border border-ui-border-base px-3 py-2"
                placeholder="Présentation du créateur..."
              />
            </label>

            <div className="flex flex-wrap gap-2 md:col-span-2">
              <Button type="submit" disabled={saving || uploadingPhotoFor === editingCreatorId}>
                {saving ? "Enregistrement..." : "Enregistrer les modifications"}
              </Button>
              <Button type="button" variant="secondary" onClick={cancelEditing} disabled={saving}>
                Annuler
              </Button>
            </div>
          </form>
        </div>
      )}

      <div className="rounded-lg border border-ui-border-base p-5">
        <div className="mb-4 flex items-center justify-between">
          <Heading level="h2">Créateurs enregistrés</Heading>
          <Button
            variant="secondary"
            onClick={() => void loadCreators()}
            disabled={loading}
          >
            Actualiser
          </Button>
        </div>

        {loading ? (
          <p>Chargement des créateurs...</p>
        ) : creators.length === 0 ? (
          <p className="text-ui-fg-subtle">
            Aucun créateur enregistré.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ui-border-base">
                  <th className="px-3 py-3">Créateur</th>
                  <th className="px-3 py-3">Type</th>
                  <th className="px-3 py-3">Code</th>
                  <th className="px-3 py-3">Réduction</th>
                  <th className="px-3 py-3">Commission</th>
                  <th className="px-3 py-3">Statut</th>
                  <th className="px-3 py-3">Promotion</th>
                  <th className="px-3 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {creators.map((creator) => (
                  <tr
                    key={creator.id}
                    className="border-b border-ui-border-base"
                  >
                    <td className="px-3 py-3">
                      <div className="font-medium">{creator.name}</div>
                      {creator.social_handle && (
                        <div className="text-ui-fg-subtle">
                          {creator.social_handle}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {creator.type === "ambassador"
                        ? "Ambassadeur"
                        : "Affilié"}
                    </td>
                    <td className="px-3 py-3 font-mono">
                      {creator.code}
                    </td>
                    <td className="px-3 py-3">
                      {creator.discount_percent}%
                    </td>
                    <td className="px-3 py-3">
                      {creator.commission_percent}%
                    </td>
                    <td className="px-3 py-3">
                      {creator.is_active ? "Actif" : "Inactif"}
                    </td>
                    <td className="px-3 py-3 font-mono">
                      {creator.promotion_id || "Non lié"}
                    </td>
                    
<td className="px-3 py-3">
                      <div className="flex min-w-[190px] flex-col items-start gap-y-2">
                        <Button
                          variant="secondary"
                          onClick={() => startEditing(creator)}
                        >
                          Modifier le profil
                        </Button>
                        <Button
                          variant="secondary"
                          disabled={
                            updatingCreatorId === creator.id ||
                            !creator.promotion_id
                          }
                          onClick={() => void toggleCreatorStatus(creator)}
                        >
                          {updatingCreatorId === creator.id
                            ? "Mise à jour..."
                            : creator.is_active
                              ? "Désactiver"
                              : "Activer"}
                        </Button>

                        {!creator.promotion_id && (
                          <p className="text-xs text-ui-fg-subtle">
                            Promotion manquante
                          </p>
                        )}

                        <p className="text-xs text-ui-fg-subtle">
                          Mise en avant publique : {creator.is_featured ? "Oui" : "Non"}
                        </p>

                        <Button
                          variant="secondary"
                          disabled={updatingFeaturedCreatorId === creator.id}
                          onClick={() => void toggleCreatorFeatured(creator)}
                        >
                          {updatingFeaturedCreatorId === creator.id
                            ? "Mise à jour..."
                            : creator.is_featured
                              ? "Retirer de la mise en avant"
                              : "Mettre en avant"}
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
    </Container>
  );
};

export const config = defineRouteConfig({
  label: "Creator Program",
});

export default CreatorsPage;
