import { invoke } from "@tauri-apps/api/core";
import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faMapMarkerAlt } from "@fortawesome/free-solid-svg-icons";

// Fonction pour afficher un ID court (8 premiers caractères)
const shortId = (id: string): string => {
  return id.length > 8 ? id.substring(0, 8) : id;
};

export type Picture = {
  id: string;
  point_id?: string;
  image?: string;
};

export type Point = {
  id: string;
  x: number;
  y: number;
  name?: string;
  status?: boolean;
  comment?: string;
  pictures?: Picture[];
};

// Resolve image src helper (support data:image or base64 string)
function resolveImageSrc(image?: string) {
  if (!image) return "";
  if (image.startsWith("data:")) return image;
  return `data:image/png;base64,${image}`;
}

export default function PointDetails({
  point,
  onClose,
  onRefresh,
  cachedAddress,
  onCacheAddress,
}: {
  point: Point | null;
  onClose?: () => void;
  onRefresh?: () => void;
  cachedAddress?: string;
  onCacheAddress?: (id: string, address: string) => void;
}) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(cachedAddress || null);
  const [loadingAddress, setLoadingAddress] = useState(!cachedAddress);
  const [editingComment, setEditingComment] = useState(false);
  const [newComment, setNewComment] = useState(point?.comment || "");
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(point?.name || "");
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    if (!point) return;

    // Si on a l'adresse en cache (via prop), on l'utilise
    if (cachedAddress) {
      setAddress(cachedAddress);
      setLoadingAddress(false);
      return;
    }

    let mounted = true;
    const fetchAddress = async () => {
      try {
        setLoadingAddress(true);
        const result = await invoke<string | null>("reverse_geocode", {
          lat: Number(point.y),
          lon: Number(point.x),
        });

        if (mounted) {
          if (result) {
            setAddress(result);
            if (onCacheAddress) onCacheAddress(point.id, result);
          } else {
            setAddress(null);
          }
        }
      } catch (err) {
        console.error("Erreur reverse geocoding details", err);
      } finally {
        if (mounted) setLoadingAddress(false);
      }
    };

    fetchAddress();

    return () => {
      mounted = false;
    };
  }, [point, cachedAddress, onCacheAddress]);

  async function toggleStatus() {
    if (!point) return;
    setUpdatingStatus(true);
    const newStatus = !point.status;
    try {
      await invoke("update_point", {
        point: {
          ...point,
          status: newStatus,
        },
      });
      // Mettre à jour localement pour affichage immédiat
      point.status = newStatus;
      if (onRefresh) await onRefresh();
      toast.success("Statut mis à jour");
    } catch (error) {
      console.error("Erreur lors de la mise à jour du statut:", error);
      toast.error("Erreur lors de la mise à jour du statut.");
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function saveComment() {
    if (!point) return;
    try {
      await invoke("update_point", {
        point: {
          ...point,
          comment: newComment || null,
        },
      });
      // Mettre à jour localement pour affichage immédiat
      point.comment = newComment || undefined;
      setEditingComment(false);
      if (onRefresh) await onRefresh();
      toast.success("Commentaire enregistré");
    } catch (error) {
      console.error("Erreur lors de la sauvegarde du commentaire:", error);
      toast.error("Erreur lors de la sauvegarde du commentaire.");
    }
  }

  async function saveName() {
    if (!point) return;
    try {
      await invoke("update_point", {
        point: {
          ...point,
          name: newName || null,
        },
      });
      // Mettre à jour localement pour affichage immédiat
      point.name = newName || undefined;
      setEditingName(false);
      if (onRefresh) await onRefresh();
      toast.success("Nom modifié");
    } catch (error) {
      console.error("Erreur lors de la sauvegarde du nom:", error);
      toast.error("Erreur lors de la sauvegarde du nom.");
    }
  }

  async function handleDelete() {
    if (!point) return;

    try {
      await invoke("delete_point", { pointId: point.id });
      toast.success(`Point ${point.name} supprimé`);
      if (onClose) onClose();
      if (onRefresh) await onRefresh();
    } catch (error) {
      console.error("Erreur lors de la suppression:", error);
      toast.error("Erreur lors de la suppression du point.");
    }
  }

  if (!point) {
    return (
      <div className="p-6 text-center">
        <div className="text-gray-400 text-lg">
          Aucune donnée pour ce point.
        </div>
        <button
          onClick={onClose}
          className="mt-4 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-medium transition-colors"
        >
          Fermer
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {point.name || `Point ${point.name}`}
            </h2>
            <p className="text-gray-500 text-sm mt-1 flex items-center gap-1">
              <FontAwesomeIcon icon={faMapMarkerAlt} className="text-gray-400" />
              {loadingAddress ? (
                <span className="italic">Recherche adresse...</span>
              ) : address ? (
                <span>{address}</span>
              ) : (
                <span>Adresse non trouvée</span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onClose) onClose();
            }}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Nom */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-semibold text-gray-900">
              Nom
            </label>
            {!editingName && (
              <button
                onClick={() => {
                  setEditingName(true);
                  setNewName(point.name || "");
                }}
                className="text-primary hover:text-white hover:bg-primary border border-primary px-3 py-1 rounded-lg text-sm font-medium transition-all"
              >
                Modifier
              </button>
            )}
          </div>
          {editingName ? (
            <div className="space-y-3">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="Entrer le nom du point..."
              />
              <div className="flex gap-2">
                <button
                  onClick={saveName}
                  className="flex-1 bg-primary hover:bg-primary/90 text-white py-2 rounded-lg font-medium transition-colors"
                >
                  Sauvegarder
                </button>
                <button
                  onClick={() => setEditingName(false)}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 rounded-lg font-medium transition-colors"
                >
                  Annuler
                </button>
              </div>
            </div>
          ) : (
            <div className=" border border-gray-200 rounded-lg px-4 py-3 shadow-sm">
              <p className="text-gray-700">
                {point.name || (
                  <span className="text-gray-400 italic">Aucun nom</span>
                )}
              </p>
            </div>
          )}
        </div>

        {/* Statut */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-3">
            Statut
          </label>
          <button
            onClick={toggleStatus}
            disabled={updatingStatus}
            className={`w-full px-4 py-2.5 rounded-lg font-medium transition-colors ${point.status
              ? "bg-green-100 text-green-700 hover:bg-green-200"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {updatingStatus ? "..." : point.status ? "Traité" : "Non traité"}
          </button>
        </div>

        {/* Commentaire */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-semibold text-gray-900">
              Commentaire
            </label>
            {!editingComment && (
              <button
                onClick={() => {
                  setEditingComment(true);
                  setNewComment(point.comment || "");
                }}
                className="text-primary hover:text-white hover:bg-primary border border-primary px-3 py-1 rounded-lg text-sm font-medium transition-all"
              >
                Modifier
              </button>
            )}
          </div>
          {editingComment ? (
            <div className="space-y-3">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                rows={4}
                placeholder="Ajouter un commentaire..."
              />
              <div className="flex gap-2">
                <button
                  onClick={saveComment}
                  className="flex-1 bg-primary hover:bg-primary/90 text-white py-2 rounded-lg font-medium transition-colors"
                >
                  Sauvegarder
                </button>
                <button
                  onClick={() => setEditingComment(false)}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 rounded-lg font-medium transition-colors"
                >
                  Annuler
                </button>
              </div>
            </div>
          ) : (
            <div className="border border-gray-200 rounded-lg px-4 py-3 shadow-sm">
              <p className="text-gray-700">
                {point.comment || (
                  <span className="text-gray-400 italic">Aucun commentaire</span>
                )}
              </p>
            </div>
          )}
        </div>

        {/* Photos */}
        {point.pictures && point.pictures.length > 0 && (
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-3">
              Photos ({point.pictures.length})
            </label>
            <div className="grid grid-cols-3 gap-3">
              {point.pictures.map((pic) => (
                <div
                  key={pic.id}
                  onClick={() => setSelectedImage(resolveImageSrc(pic.image))}
                  className="relative aspect-square rounded-lg overflow-hidden cursor-pointer hover:opacity-75 transition-opacity border border-gray-200"
                >
                  <img
                    src={resolveImageSrc(pic.image)}
                    alt={`Photo ${shortId(pic.id)}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer - Actions */}
      <div className="p-6 border-t border-gray-200 bg-gray-50">
        <button
          onClick={handleDelete}
          className="w-full bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-lg font-medium transition-colors"
        >
          Supprimer ce point
        </button>
      </div>

      {/* Image Modal */}
      {selectedImage && (
        <div
          onClick={() => setSelectedImage(null)}
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
        >
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute top-4 right-4 w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white text-2xl font-bold"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
          <img
            src={selectedImage}
            alt="Agrandie"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
