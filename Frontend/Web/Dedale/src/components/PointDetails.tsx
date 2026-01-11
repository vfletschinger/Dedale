import { invoke } from "@tauri-apps/api/core";
import { useState } from "react";

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
}: {
  point: Point | null;
  onClose?: () => void;
  onRefresh?: () => void;
}) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [editingComment, setEditingComment] = useState(false);
  const [newComment, setNewComment] = useState(point?.comment || "");
  const [updatingStatus, setUpdatingStatus] = useState(false);

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
    } catch (error) {
      console.error("Erreur lors de la mise à jour du statut:", error);
      alert("Erreur lors de la mise à jour du statut.");
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
    } catch (error) {
      console.error("Erreur lors de la sauvegarde du commentaire:", error);
      alert("Erreur lors de la sauvegarde du commentaire.");
    }
  }

  async function handleDelete() {
    if (!point) return;
    if (!confirm(`Supprimer le point #${shortId(point.id)} ?`)) return;

    try {
      await invoke("delete_point", { pointId: point.id });
      if (onClose) onClose();
      if (onRefresh) await onRefresh();
    } catch (error) {
      console.error("Erreur lors de la suppression:", error);
      alert("Erreur lors de la suppression du point.");
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
    <div className="h-full flex flex-col bg-gradient-to-b from-white to-gray-50 relative">
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">
              {point.name || `Point #${shortId(point.id)}`}
            </h2>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onClose) onClose();
            }}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors cursor-pointer z-10"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Statut */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 bg-gradient-to-r from-green-50 to-emerald-50 border-b border-green-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">✓</span>
              <span className="font-bold text-gray-800">Statut</span>
            </div>
            <button
              onClick={toggleStatus}
              disabled={updatingStatus}
              className={`px-4 py-1.5 rounded-lg font-medium transition-colors ${
                point.status
                  ? "bg-green-600 text-white hover:bg-green-700"
                  : "bg-gray-300 text-gray-700 hover:bg-gray-400"
              }`}
            >
              {updatingStatus ? "..." : point.status ? "Traité" : "Non traité"}
            </button>
          </div>
        </div>

        {/* Commentaire */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">💬</span>
              <span className="font-bold text-gray-800">Commentaire</span>
            </div>
            {!editingComment && (
              <button
                onClick={() => {
                  setEditingComment(true);
                  setNewComment(point.comment || "");
                }}
                className="text-blue-600 hover:bg-blue-100 px-3 py-1 rounded-lg text-sm font-medium transition-colors"
              >
                ✏️ Modifier
              </button>
            )}
          </div>
          <div className="p-4">
            {editingComment ? (
              <div className="space-y-3">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={4}
                  placeholder="Ajouter un commentaire..."
                />
                <div className="flex gap-2">
                  <button
                    onClick={saveComment}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium transition-colors"
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
              <div className="text-gray-700">
                {point.comment || (
                  <span className="text-gray-400 italic">
                    Aucun commentaire
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Photos */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 bg-gradient-to-r from-purple-50 to-pink-50 border-b border-purple-100 flex items-center gap-2">
            <span className="text-lg">📷</span>
            <span className="font-bold text-gray-800">Photos</span>
            <span className="text-sm text-gray-500">
              ({point.pictures?.length || 0})
            </span>
          </div>
          <div className="p-4">
            {point.pictures && point.pictures.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {point.pictures.map((pic) => (
                  <div
                    key={pic.id}
                    onClick={() => setSelectedImage(resolveImageSrc(pic.image))}
                    className="relative aspect-square rounded-lg overflow-hidden cursor-pointer hover:opacity-75 transition-opacity border-2 border-gray-200 hover:border-purple-400"
                  >
                    <img
                      src={resolveImageSrc(pic.image)}
                      alt={`Photo ${shortId(pic.id)}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-400 py-4">Aucune photo</div>
            )}
          </div>
        </div>
      </div>

      {/* Footer - Actions */}
      <div className="p-4 bg-white border-t border-gray-200">
        <button
          onClick={handleDelete}
          className="w-full bg-red-500 hover:bg-red-600 text-white py-3 rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
        >
          <span>🗑️</span>
          <span>Supprimer ce point</span>
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
            ✕
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
