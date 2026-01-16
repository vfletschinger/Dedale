import { invoke } from "@tauri-apps/api/core";
import toast from "react-hot-toast";
import { useState } from "react";
import { GeometryData } from "../types/map";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDrawPolygon, faRoute, faPen, faRuler, faMapMarkerAlt, faTrash } from "@fortawesome/free-solid-svg-icons";

// Fonction pour extraire les coordonnées du WKT
function extractCoordinates(wkt: string): { lat: number; lng: number }[] {
  const coords: { lat: number; lng: number }[] = [];

  const coordsMatch = wkt.match(/[\d.-]+\s+[\d.-]+/g);
  if (coordsMatch) {
    coordsMatch.forEach((pair) => {
      const [lng, lat] = pair.trim().split(/\s+/).map(Number);
      if (!isNaN(lng) && !isNaN(lat)) {
        coords.push({ lat, lng });
      }
    });
  }

  return coords;
}

// Fonction pour calculer la longueur approximative d'une ligne (en mètres)
function calculateLength(coords: { lat: number; lng: number }[]): number {
  if (coords.length < 2) return 0;

  let totalLength = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const lat1 = coords[i].lat * Math.PI / 180;
    const lat2 = coords[i + 1].lat * Math.PI / 180;
    const dLat = (coords[i + 1].lat - coords[i].lat) * Math.PI / 180;
    const dLng = (coords[i + 1].lng - coords[i].lng) * Math.PI / 180;

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const R = 6371000;

    totalLength += R * c;
  }

  return totalLength;
}

// Fonction pour formater la longueur
function formatLength(length: number): string {
  if (length < 1000) {
    return `${length.toFixed(1)} m`;
  } else {
    return `${(length / 1000).toFixed(2)} km`;
  }
}

// Fonction pour déterminer le type de géométrie
function getGeometryType(wkt: string): "polygon" | "linestring" | "unknown" {
  const trimmed = wkt.trim().toUpperCase();
  if (trimmed.startsWith("POLYGON")) return "polygon";
  if (trimmed.startsWith("LINESTRING")) return "linestring";
  return "unknown";
}

interface GeometryDetailsProps {
  geometry: GeometryData | null;
  onClose?: () => void;
  onRefresh?: () => void;
}

export default function GeometryDetails({
  geometry,
  onClose,
  onRefresh,
}: GeometryDetailsProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");

  async function handleDelete() {
    if (!geometry) return;

    const geometryType = getGeometryType(geometry.geom);

    try {
      await invoke("delete_geometry", { geometryId: String(geometry.id) });
      toast.success(geometryType === "polygon" ? "Zone supprimée" : "Parcours supprimé");
      if (onClose) onClose();
      if (onRefresh) await onRefresh();
    } catch (error) {
      console.error("Failed to delete geometry:", error);
      toast.error("Erreur lors de la suppression.");
    }
  }

  async function handleSaveName() {
    if (!geometry) return;

    try {
      await invoke("update_geometry_name", {
        geometryId: String(geometry.id),
        name: editedName
      });
      setIsEditingName(false);
      if (onRefresh) await onRefresh();
      toast.success("Nom modifié");
    } catch (error) {
      console.error("Failed to update name:", error);
      toast.error("Erreur lors de la mise à jour du nom.");
    }
  }

  function startEditingName() {
    setEditedName(geometry?.name || "");
    setIsEditingName(true);
  }

  if (!geometry) {
    return (
      <div className="p-6 text-center">
        <div className="text-gray-400 text-lg">Aucune géométrie sélectionnée.</div>
        <button
          onClick={onClose}
          className="mt-4 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-medium transition-colors"
        >
          Fermer
        </button>
      </div>
    );
  }

  const geometryType = getGeometryType(geometry.geom);
  const coords = extractCoordinates(geometry.geom);
  const isParcours = geometryType === "linestring";
  const isZone = geometryType === "polygon";
  const typeLabel = isZone ? "Zone" : "Parcours";
  const displayName = geometry.name || `${typeLabel} sans nom`;

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-white to-gray-50 relative">
      {/* Header */}
      <div className={`p-4 bg-gradient-to-r ${isZone ? "from-indigo-500 to-purple-600" : "from-green-500 to-emerald-600"} text-white`}>
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg"><FontAwesomeIcon icon={isZone ? faDrawPolygon : faRoute} /></span>
              {isEditingName ? (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="text"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    className="flex-1 px-2 py-1 rounded text-gray-800 text-lg font-bold"
                    placeholder={`Nom du ${typeLabel.toLowerCase()}`}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveName();
                      if (e.key === "Escape") setIsEditingName(false);
                    }}
                  />
                  <button
                    onClick={handleSaveName}
                    className="px-2 py-1 bg-white/20 hover:bg-white/30 rounded text-sm"
                  >
                    ✓
                  </button>
                  <button
                    onClick={() => setIsEditingName(false)}
                    className="px-2 py-1 bg-white/20 hover:bg-white/30 rounded text-sm"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <h2 className="text-xl font-bold truncate">{displayName}</h2>
                  <button
                    onClick={startEditingName}
                    className="px-2 py-1 bg-white/20 hover:bg-white/30 rounded text-sm shrink-0"
                    title="Modifier le nom"
                  >
                    <FontAwesomeIcon icon={faPen} />
                  </button>
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onClose) onClose();
            }}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors cursor-pointer z-10 shrink-0 ml-2"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* Longueur (uniquement pour les parcours) */}
        {isParcours && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 bg-gradient-to-r from-green-50 to-emerald-50 border-b border-green-100 flex items-center gap-2">
              <span className="text-xl text-green-600"><FontAwesomeIcon icon={faRuler} /></span>
              <span className="font-semibold text-gray-800">Longueur</span>
            </div>
            <div className="p-4">
              <span className="text-2xl font-bold text-gray-800">{formatLength(calculateLength(coords))}</span>
            </div>
          </div>
        )}

        {/* Coordonnées */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className={`px-4 py-3 bg-gradient-to-r ${isZone ? "from-indigo-50 to-purple-50 border-indigo-100" : "from-green-50 to-emerald-50 border-green-100"} border-b flex items-center gap-2`}>
            <span className="text-xl text-gray-600"><FontAwesomeIcon icon={faMapMarkerAlt} /></span>
            <span className="font-semibold text-gray-800">Coordonnées</span>
            <span className={`px-2 py-0.5 ${isZone ? "bg-indigo-200 text-indigo-800" : "bg-green-200 text-green-800"} text-xs font-medium rounded-full`}>
              {coords.length} points
            </span>
          </div>

          <div className="max-h-64 overflow-y-auto">
            <div className="divide-y divide-gray-50">
              {coords.map((coord, index) => (
                <div key={index} className="px-4 py-2 hover:bg-gray-50 transition-colors flex items-center justify-between">
                  <span className="text-gray-500 text-xs font-medium">#{index + 1}</span>
                  <span className="font-mono text-sm text-gray-700">
                    {coord.lat.toFixed(6)}, {coord.lng.toFixed(6)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-gray-100 bg-white">
        <button
          onClick={handleDelete}
          className="w-full px-4 py-3 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white font-semibold rounded-xl transition-all shadow-sm hover:shadow-md"
        >
          <FontAwesomeIcon icon={faTrash} /> Supprimer {isZone ? "cette zone" : "ce parcours"}
        </button>
      </div>
    </div>
  );
}
