import React from "react";
import { Zone, Parcours, Equipement } from "../types/map";

// On définit des types locaux pour simplifier les props
type GeometryType = "zone" | "parcours";

// Union type compatible avec ce que useMapGeometries attend (Zone/Parcours + type + description optionnelle)
export type GeometryItem =
  | (Zone & { type: "zone"; description?: string })
  | (Parcours & { type: "parcours"; description?: string });

interface MapGeometryListProps {
  zones: Zone[];
  parcours: Parcours[];
  equipements: Equipement[];
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  selectedGeometry: { id: string; type: GeometryType } | null;
  editingGeometry: { id: string; type: GeometryType } | null;
  onHighlight: (item: GeometryItem | null) => void;
  onStartEdit: (item: GeometryItem) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDeleteGeometry: (id: string, type: GeometryType) => void;
  onDeleteEquipement: (id: string) => void;
}

const MapGeometryList: React.FC<MapGeometryListProps> = ({
  zones,
  parcours,
  equipements,
  isOpen,
  setIsOpen,
  selectedGeometry,
  editingGeometry,
  onHighlight,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDeleteGeometry,
  onDeleteEquipement,
}) => {
  if (zones.length === 0 && parcours.length === 0 && equipements.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden max-w-sm mt-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2 flex justify-between items-center text-sm font-semibold hover:bg-gray-50"
      >
        <span>
          📐 {zones.length + parcours.length + equipements.length} élément(s)
        </span>
        <span
          className={`transform transition-transform ${isOpen ? "rotate-180" : ""}`}
        >
          ▼
        </span>
      </button>

      {isOpen && (
        <div className="max-h-60 overflow-y-auto bg-gray-50 border-t border-gray-200">
          {/* --- SECTION ZONES --- */}
          {zones.length > 0 && (
            <div>
              <div className="px-3 py-1 bg-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider">
                Zones
              </div>
              {zones.map((zone) => {
                const itemData: GeometryItem = { ...zone, type: "zone" };
                const isSelected =
                  selectedGeometry?.id === zone.id &&
                  selectedGeometry?.type === "zone";
                const isEditing =
                  editingGeometry?.id === zone.id &&
                  editingGeometry?.type === "zone";

                return (
                  <div
                    key={`zone-${zone.id}`}
                    className={`p-2 border-b border-gray-200 last:border-0 hover:bg-blue-50 cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-blue-100 border-l-4 border-l-blue-500"
                        : isEditing
                          ? "bg-amber-50"
                          : ""
                    }`}
                    onClick={() => onHighlight(isSelected ? null : itemData)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">🟦</span>
                      <span className="text-xs font-medium truncate flex-1">
                        {zone.name || `Zone #${zone.id}`}
                      </span>
                      {isSelected && (
                        <span className="text-blue-500 text-xs">👁️</span>
                      )}

                      {!isEditing && (
                        <div className="flex gap-1 ml-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onStartEdit(itemData);
                            }}
                            className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                            title="Modifier"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteGeometry(zone.id, "zone");
                            }}
                            className="p-1 text-red-600 hover:bg-red-100 rounded"
                            title="Supprimer"
                          >
                            🗑️
                          </button>
                        </div>
                      )}
                    </div>

                    {isEditing && (
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSaveEdit();
                          }}
                          className="flex-1 bg-green-600 text-white text-xs py-1 rounded"
                        >
                          Sauver
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onCancelEdit();
                          }}
                          className="flex-1 bg-gray-500 text-white text-xs py-1 rounded"
                        >
                          Annuler
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* --- SECTION PARCOURS --- */}
          {parcours.length > 0 && (
            <div>
              <div className="px-3 py-1 bg-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider border-t border-gray-200">
                Parcours
              </div>
              {parcours.map((p) => {
                const itemData: GeometryItem = { ...p, type: "parcours" };
                const isSelected =
                  selectedGeometry?.id === p.id &&
                  selectedGeometry?.type === "parcours";
                const isEditing =
                  editingGeometry?.id === p.id &&
                  editingGeometry?.type === "parcours";

                return (
                  <div
                    key={`parcours-${p.id}`}
                    className={`p-2 border-b border-gray-200 last:border-0 hover:bg-blue-50 cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-blue-100 border-l-4 border-l-green-500"
                        : isEditing
                          ? "bg-amber-50"
                          : ""
                    }`}
                    onClick={() => onHighlight(isSelected ? null : itemData)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">〰️</span>
                      <span className="text-xs font-medium truncate flex-1">
                        {p.name || `Parcours #${p.id}`}
                      </span>
                      {isSelected && (
                        <span className="text-green-500 text-xs">👁️</span>
                      )}

                      {!isEditing && (
                        <div className="flex gap-1 ml-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onStartEdit(itemData);
                            }}
                            className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteGeometry(p.id, "parcours");
                            }}
                            className="p-1 text-red-600 hover:bg-red-100 rounded"
                            title="Supprimer"
                          >
                            🗑️
                          </button>
                        </div>
                      )}
                    </div>

                    {isEditing && (
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSaveEdit();
                          }}
                          className="flex-1 bg-green-600 text-white text-xs py-1 rounded"
                        >
                          Sauver
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onCancelEdit();
                          }}
                          className="flex-1 bg-gray-500 text-white text-xs py-1 rounded"
                        >
                          Annuler
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* --- SECTION ÉQUIPEMENTS --- */}
          {equipements.length > 0 && (
            <div>
              <div className="px-3 py-1 bg-orange-100 text-xs font-bold text-orange-700 uppercase tracking-wider">
                🚧 Équipements
              </div>
              {equipements.map((eq) => (
                <div
                  key={`equipement-${eq.id}`}
                  className="p-2 border-b border-gray-200 last:border-0 hover:bg-orange-50"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <span className="text-sm font-medium text-gray-700">
                        {eq.type_name || "Équipement"}
                      </span>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {eq.length}m/unité • {eq.coordinates?.length || 0}{" "}
                        points
                      </div>
                    </div>
                    <button
                      onClick={() => onDeleteEquipement(eq.id)}
                      className="p-1 text-red-600 hover:bg-red-100 rounded"
                      title="Supprimer"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MapGeometryList;
