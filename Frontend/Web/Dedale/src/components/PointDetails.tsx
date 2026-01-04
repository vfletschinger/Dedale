import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState, useCallback } from "react";

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

export type ObstacleType = {
  id: number;
  name: string;
  description: string;
  width: number;
  length: number;
};

interface MergedObstacle {
  typeId: number;
  name: string;
  description: string;
  width: number;
  length: number;
  number: number;
  obstacleId: number | null;
}

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
  const [showObstaclesPopup, setShowObstaclesPopup] = useState(false);
  const [showDatesPopup, setShowDatesPopup] = useState(false);
  const [mergedObstacles, setMergedObstacles] = useState<MergedObstacle[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [editPose, setEditPose] = useState<string>("");
  const [editDepose, setEditDepose] = useState<string>("");

  // Fetch and merge obstacle types with the point's obstacles
  const fetchTypes = useCallback(async () => {
    if (!point) return;
    try {
      const types: ObstacleType[] = await invoke("fetch_obstacle_types");

      const merged = types.map((type) => {
        const existing = point.obstacles.find((o) => o.name === type.name);
        return {
          typeId: type.id,
          name: type.name,
          description: type.description,
          width: type.width,
          length: type.length,
          number: existing?.number ?? 0,
          obstacleId: existing?.id ?? null,
        };
      });
      setMergedObstacles(merged);
    } catch (error) {
      console.error("Failed to fetch obstacle types:", error);
    }
  }, [point]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (showDatesPopup && point) {
      setEditPose(point.pose || "");
      setEditDepose(point.depose || "");
    }
  }, [showDatesPopup, point]);
  /* eslint-enable react-hooks/set-state-in-effect */

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (showObstaclesPopup && point) {
      fetchTypes();
    }
  }, [showObstaclesPopup, point, fetchTypes]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function incrementObstacle(typeId: number) {
    setMergedObstacles((prev) =>
      prev.map((o) =>
        o.typeId === typeId ? { ...o, number: o.number + 1 } : o
      )
    );
  }

  function decrementObstacle(typeId: number) {
    setMergedObstacles((prev) =>
      prev.map((o) =>
        o.typeId === typeId ? { ...o, number: Math.max(0, o.number - 1) } : o
      )
    );
  }

  async function saveObstacles() {
    try {
      if (point) {
        //Convert camelCase to snake_case for backend
        const obstaclesSnakeCase = mergedObstacles.map((o) => ({
          type_id: o.typeId ?? null,
          obstacle_id: o.obstacleId ?? null,
          number: o.number ?? null,
          width: o.width ?? null,
          length: o.length ?? null,
          name: o.name ?? null,
          description: o.description ?? null,
        }));

        await invoke("insert_obstacles", {
          pointId: point.id,
          obstacles: obstaclesSnakeCase,
        });

        setShowObstaclesPopup(false);
        if (onRefresh) {
          onRefresh();
        }
      }
    } catch (error) {
      console.error("Failed to save obstacles:", error);
    }
  }

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

  async function saveDates() {
    // Validation : dépose ne peut pas être antérieure à pose
    if (editPose && editDepose) {
      const poseDate = new Date(editPose);
      const deposeDate = new Date(editDepose);
      if (deposeDate < poseDate) {
        alert("⚠️ La date de dépose ne peut pas être antérieure à la date de pose.");
        return;
      }
    }
    
    try {
      if (point) {
        await invoke("update_point_dates", {
          pointId: point.id,
          pose: editPose || null,
          depose: editDepose || null,
        });

        setShowDatesPopup(false);
        if (onRefresh) {
          onRefresh();
        }
      }
    } catch (error) {
      console.error("Failed to save dates:", error);
      alert("Erreur lors de la sauvegarde des dates.");
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
    <div className="h-full flex flex-col bg-gradient-to-b from-white to-gray-50">
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
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Dates Pose/Dépose Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 bg-gradient-to-r from-purple-50 to-pink-50 border-b border-purple-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">🕐</span>
              <span className="font-semibold text-gray-800">Dates Pose / Dépose</span>
            </div>
            <button
              onClick={() => setShowDatesPopup(true)}
              className="px-3 py-1.5 bg-purple-500 hover:bg-purple-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Modifier
            </button>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Pose :</span>
              <span className={`text-sm font-medium ${point.pose ? 'text-gray-800' : 'text-gray-400 italic'}`}>
                {formatDateTime(point.pose)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Dépose :</span>
              <span className={`text-sm font-medium ${point.depose ? 'text-gray-800' : 'text-gray-400 italic'}`}>
                {formatDateTime(point.depose)}
              </span>
            </div>
          </div>
        </div>

        {/* Obstacles Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-800">Obstacles</span>
              <span className="px-2 py-0.5 bg-orange-200 text-orange-800 text-xs font-medium rounded-full">
                {point.obstacles.length}
              </span>
            </div>
            <button
              onClick={() => setShowObstaclesPopup(true)}
              className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Modifier
            </button>
          </div>
          
          {point.obstacles.length === 0 ? (
            <div className="p-4 text-center text-gray-400">
              <div className="text-2xl mb-1">📭</div>
              <div className="text-sm">Aucun obstacle</div>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {point.obstacles.map((o) => (
                <div key={o.id} className="p-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-amber-500 rounded-xl flex items-center justify-center text-white font-bold shadow-sm">
                        {o.number ?? 0}
                      </div>
                      <div>
                        <div className="font-medium text-gray-800">{o.name ?? "Type inconnu"}</div>
                        <div className="text-xs text-gray-500">
                          {o.length ?? "-"}m × {o.width ?? "-"}m
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

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

      {/* Modal Modification Obstacles */}
      {showObstaclesPopup && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white flex items-center justify-between">
              <h3 className="font-bold text-lg">Modifier les obstacles</h3>
              <button
                onClick={() => setShowObstaclesPopup(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors"
              >
                ✕
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {mergedObstacles.map((o) => (
                <div 
                  key={o.typeId} 
                  className="p-3 bg-gray-50 rounded-xl border border-gray-100"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-800 truncate">{o.name ?? "Type inconnu"}</div>
                      <div className="text-xs text-gray-500 truncate">{o.description}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => decrementObstacle(o.typeId)}
                        className="w-9 h-9 flex items-center justify-center bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-lg transition-colors"
                      >
                        −
                      </button>
                      <div className="w-10 text-center font-bold text-lg text-gray-800">
                        {o.number}
                      </div>
                      <button
                        onClick={() => incrementObstacle(o.typeId)}
                        className="w-9 h-9 flex items-center justify-center bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-lg transition-colors"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="p-4 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setShowObstaclesPopup(false)}
                className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => saveObstacles()}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold rounded-xl transition-all"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Modification Dates Pose/Dépose */}
      {showDatesPopup && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white flex items-center justify-between">
              <h3 className="font-bold text-lg">Modifier les dates</h3>
              <button
                onClick={() => setShowDatesPopup(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors"
              >
                ✕
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date et heure de pose</label>
                <input
                  type="datetime-local"
                  value={editPose}
                  onChange={(e) => setEditPose(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-gray-50 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date et heure de dépose</label>
                <input
                  type="datetime-local"
                  value={editDepose}
                  onChange={(e) => setEditDepose(e.target.value)}
                  min={editPose || undefined}
                  className={`w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-gray-50 transition-all ${
                    editPose && editDepose && new Date(editDepose) < new Date(editPose)
                      ? 'border-red-400 bg-red-50'
                      : 'border-gray-200'
                  }`}
                />
                {editPose && editDepose && new Date(editDepose) < new Date(editPose) && (
                  <p className="text-red-500 text-xs mt-1">⚠️ La dépose doit être après la pose</p>
                )}
              </div>
            </div>
            
            <div className="p-4 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setShowDatesPopup(false)}
                className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => saveDates()}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold rounded-xl transition-all"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

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
