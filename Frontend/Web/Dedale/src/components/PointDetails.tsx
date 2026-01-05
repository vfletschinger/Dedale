import { invoke } from "@tauri-apps/api/core";
import { useState } from "react";

// Fonction pour afficher un ID court (8 premiers caractères)
const shortId = (id: string | number): string => {
  const str = String(id);
  return str.length > 8 ? str.substring(0, 8) : str;
};

export type Obstacle = {
  id: number;
  name?: string | null;
  number?: number | null;
  description?: string | null;
  width?: number | null;
  length?: number | null;
};

export type Picture = {
  id: number;
  image: string;
};

export type CommentItem = {
  id: number;
  value: string;
};

export type Point = {
  id: number;
  x: number;
  y: number;
  name?: string | null;
  pose?: string | null;
  depose?: string | null;
  obstacles: Obstacle[];
  comments: CommentItem[];
  pictures: Picture[];
};

// Resolve image src helper (support data:image or base64 string)
function resolveImageSrc(image: string) {
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

  async function handleDelete() {
    if (!point) return;

    if (!confirm(`Supprimer le point #${shortId(point.id)} ?`)) return;

    try {
      await invoke("delete_point", { pointId: point.id });
      // Fermer d'abord le panneau, puis rafraîchir
      if (onClose) onClose();
      if (onRefresh) await onRefresh();
    } catch (error) {
      console.error("Failed to delete point:", error);
      alert("Erreur lors de la suppression du point.");
    }
  }

  // Helper pour formater les dates pour l'affichage
  function formatDateTime(dateStr: string | null | undefined): string {
    if (!dateStr) return "Non défini";
    try {
      const date = new Date(dateStr);
      return date.toLocaleString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  }

  if (!point) {
    return (
      <div className="p-6 text-center">
        <div className="text-gray-400 text-lg">Aucune donnée pour ce point.</div>
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
            <h2 className="text-xl font-bold">{point.name || `Point #${shortId(point.id)}`}</h2>
            <div className="text-white/80 text-sm mt-1 flex items-center gap-2">
              <span>📍</span>
              <span>{point.x.toFixed(5)}, {point.y.toFixed(5)}</span>
            </div>
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
        {/* Comments Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100 flex items-center gap-2">
            <span className="text-xl">💬</span>
            <span className="font-semibold text-gray-800">Commentaires</span>
            <span className="px-2 py-0.5 bg-blue-200 text-blue-800 text-xs font-medium rounded-full">
              {point.comments.length}
            </span>
          </div>
          
          {point.comments.length === 0 ? (
            <div className="p-4 text-center text-gray-400">
              <div className="text-2xl mb-1">💭</div>
              <div className="text-sm">Aucun commentaire</div>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {point.comments.map((c) => (
                <div key={c.id} className="p-3 hover:bg-gray-50 transition-colors">
                  <p className="text-gray-700 text-sm leading-relaxed">{c.value}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Photos Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 bg-gradient-to-r from-green-50 to-emerald-50 border-b border-green-100 flex items-center gap-2">
            <span className="text-xl">📸</span>
            <span className="font-semibold text-gray-800">Photos</span>
            <span className="px-2 py-0.5 bg-green-200 text-green-800 text-xs font-medium rounded-full">
              {point.pictures.length}
            </span>
          </div>
          
          {point.pictures.length === 0 ? (
            <div className="p-4 text-center text-gray-400">
              <div className="text-2xl mb-1">🖼️</div>
              <div className="text-sm">Aucune photo</div>
            </div>
          ) : (
            <div className="p-3 grid grid-cols-2 gap-2">
              {point.pictures.map((p) => (
                <div 
                  key={p.id} 
                  className="aspect-square rounded-xl overflow-hidden bg-gray-100 cursor-pointer hover:opacity-90 transition-opacity shadow-sm"
                  onClick={() => setSelectedImage(resolveImageSrc(p.image))}
                >
                  <img
                    alt={`pic-${p.id}`}
                    src={resolveImageSrc(p.image)}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-gray-100 bg-white">
        <button
          onClick={handleDelete}
          className="w-full px-4 py-3 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white font-semibold rounded-xl transition-all shadow-sm hover:shadow-md"
        >
          🗑️ Supprimer ce point
        </button>
      </div>

      {/* Modal Image Fullscreen */}
      {selectedImage && (
        <div 
          className="absolute inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4 cursor-pointer"
          onClick={() => setSelectedImage(null)}
        >
          <img
            src={selectedImage}
            alt="Fullscreen"
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
          />
          <button
            className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center bg-white/20 hover:bg-white/30 text-white rounded-full transition-colors"
            onClick={() => setSelectedImage(null)}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
