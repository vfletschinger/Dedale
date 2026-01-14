import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { EquipementType } from "../types/map";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { 
  faTools, 
  faCheck, 
  faTimes, 
  faCaretDown, 
  faFilter,
  faSquare,
  faRoute,
  faExclamationCircle 
} from "@fortawesome/free-solid-svg-icons";

// Types pour les filtres de visibilité
export interface VisibilityFilters {
  showZones: boolean;
  showParcours: boolean;
  showInterests: boolean;
  showEquipements: boolean;
}

interface EquipementTypeFilterProps {
  selectedTypes: string[] | null; // IDs des types sélectionnés (null = pas encore initialisé)
  onFilterChange: (selectedTypeIds: string[]) => void;
  variant?: "default" | "header"; // Variante de style
  visibilityFilters: VisibilityFilters;
  onVisibilityChange: (filters: VisibilityFilters) => void;
}

export default function EquipementTypeFilter({
  selectedTypes,
  onFilterChange,
  variant = "default",
  visibilityFilters,
  onVisibilityChange,
}: EquipementTypeFilterProps) {
  const [types, setTypes] = useState<EquipementType[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fermer le dropdown quand on clique en dehors
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Charger les types d'équipement au montage
  useEffect(() => {
    const loadTypes = async () => {
      try {
        setLoading(true);
        // Seed les types par défaut si nécessaire
        await invoke("seed_default_equipment_types");
        // Récupérer les types
        const fetchedTypes = await invoke<EquipementType[]>("fetch_equipment_types");
        setTypes(fetchedTypes);

        // Si le filtre n'est pas encore initialisé (null), sélectionner tous les types par défaut
        if (selectedTypes === null && fetchedTypes.length > 0) {
          onFilterChange(fetchedTypes.map((t) => t.id));
        }
      } catch (err) {
        console.error("Erreur chargement types équipements:", err);
      } finally {
        setLoading(false);
      }
    };
    loadTypes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Utiliser un tableau vide si selectedTypes est null pour les calculs internes
  const currentSelectedTypes = selectedTypes ?? [];

  const toggleType = (typeId: string) => {
    if (currentSelectedTypes.includes(typeId)) {
      // Désélectionner
      onFilterChange(currentSelectedTypes.filter((id) => id !== typeId));
    } else {
      // Sélectionner
      onFilterChange([...currentSelectedTypes, typeId]);
    }
  };

  const selectAll = () => {
    onFilterChange(types.map((t) => t.id));
  };

  const deselectAll = () => {
    onFilterChange([]);
  };

  const allSelected = types.length > 0 && currentSelectedTypes.length === types.length;
  const noneSelected = currentSelectedTypes.length === 0;
  const someSelected = !allSelected && !noneSelected;

  // Compter les filtres actifs (éléments masqués)
  const hiddenElementsCount = [
    !visibilityFilters.showZones,
    !visibilityFilters.showParcours,
    !visibilityFilters.showInterests,
    !visibilityFilters.showEquipements,
  ].filter(Boolean).length;

  const hasActiveFilters = hiddenElementsCount > 0 || someSelected || noneSelected;

  if (loading) {
    return (
      <div className={variant === "header" ? "text-slate-400 text-xs animate-pulse" : "bg-white rounded-lg shadow-lg border border-gray-200 p-2"}>
        <div className={variant === "header" ? "" : "text-xs text-gray-500 animate-pulse"}>Chargement...</div>
      </div>
    );
  }

  const isHeader = variant === "header";

  return (
    <div ref={dropdownRef} className={`relative ${isHeader ? "" : "bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden max-w-xs"}`}>
      {/* Header du filtre */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 transition-colors ${isHeader
            ? "px-3 py-2 text-sm font-semibold text-slate-300 hover:text-white"
            : "w-full px-3 py-2 text-sm font-semibold hover:bg-gray-50"
          }`}
      >
        <span className="flex items-center gap-2">
          <FontAwesomeIcon icon={faFilter} />
          <span>Filtres</span>
          {hasActiveFilters && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${isHeader ? "bg-orange-500 text-white" : "bg-orange-100 text-orange-700"
              }`}>
              Actif
            </span>
          )}
        </span>
        <span
          className={`transform transition-transform ${isOpen ? "rotate-180" : ""}`}
        >
          <FontAwesomeIcon icon={faCaretDown} />
        </span>
      </button>

      {/* Liste des filtres */}
      {isOpen && (
        <div className={`${isHeader
            ? "absolute right-0 top-full mt-1 w-72 bg-white rounded-lg shadow-xl border border-gray-200 z-50"
            : "border-t border-gray-200"
          } bg-gray-50`}>
          
          {/* Section : Visibilité des éléments */}
          <div className="border-b border-gray-200">
            <div className="px-3 py-2 bg-slate-100 text-xs font-bold text-slate-600 uppercase tracking-wider">
              Affichage des éléments
            </div>
            <div className="p-2 space-y-1">
              <label className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-gray-100 rounded transition-colors ${visibilityFilters.showZones ? "bg-blue-50" : ""}`}>
                <input
                  type="checkbox"
                  checked={visibilityFilters.showZones}
                  onChange={(e) => onVisibilityChange({ ...visibilityFilters, showZones: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <FontAwesomeIcon icon={faSquare} className="text-blue-600" />
                <span className="text-sm font-medium text-gray-700">Zones</span>
              </label>
              <label className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-gray-100 rounded transition-colors ${visibilityFilters.showParcours ? "bg-green-50" : ""}`}>
                <input
                  type="checkbox"
                  checked={visibilityFilters.showParcours}
                  onChange={(e) => onVisibilityChange({ ...visibilityFilters, showParcours: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                />
                <FontAwesomeIcon icon={faRoute} className="text-green-600" />
                <span className="text-sm font-medium text-gray-700">Parcours</span>
              </label>
              <label className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-gray-100 rounded transition-colors ${visibilityFilters.showInterests ? "bg-purple-50" : ""}`}>
                <input
                  type="checkbox"
                  checked={visibilityFilters.showInterests}
                  onChange={(e) => onVisibilityChange({ ...visibilityFilters, showInterests: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <FontAwesomeIcon icon={faExclamationCircle} className="text-purple-600" />
                <span className="text-sm font-medium text-gray-700">Points d'intérêt</span>
              </label>
              <label className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-gray-100 rounded transition-colors ${visibilityFilters.showEquipements ? "bg-orange-50" : ""}`}>
                <input
                  type="checkbox"
                  checked={visibilityFilters.showEquipements}
                  onChange={(e) => onVisibilityChange({ ...visibilityFilters, showEquipements: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                />
                <FontAwesomeIcon icon={faTools} className="text-orange-600" />
                <span className="text-sm font-medium text-gray-700">Équipements</span>
              </label>
            </div>
          </div>

          {/* Section : Types d'équipements (visible seulement si équipements sont affichés) */}
          {visibilityFilters.showEquipements && types.length > 0 && (
            <div>
              <div className="px-3 py-2 bg-orange-100 text-xs font-bold text-orange-700 uppercase tracking-wider flex items-center gap-2">
                <FontAwesomeIcon icon={faTools} />
                Types d'équipement
              </div>
              
              {/* Actions rapides */}
              <div className="px-3 py-2 flex gap-2 border-b border-gray-200 bg-white">
                <button
                  onClick={selectAll}
                  className={`flex-1 text-xs py-1 px-2 rounded transition-colors ${allSelected
                      ? "bg-green-100 text-green-700 cursor-default"
                      : "bg-gray-100 hover:bg-green-50 text-gray-600 hover:text-green-700"
                    }`}
                  disabled={allSelected}
                >
                  <FontAwesomeIcon icon={faCheck} /> Tous
                </button>
                <button
                  onClick={deselectAll}
                  className={`flex-1 text-xs py-1 px-2 rounded transition-colors ${noneSelected
                      ? "bg-red-100 text-red-700 cursor-default"
                      : "bg-gray-100 hover:bg-red-50 text-gray-600 hover:text-red-700"
                    }`}
                  disabled={noneSelected}
                >
                  <FontAwesomeIcon icon={faTimes} /> Aucun
                </button>
              </div>

              {/* Liste des types avec checkboxes */}
              <div className="max-h-36 overflow-y-auto">
                {types.map((type) => {
                  const isSelected = currentSelectedTypes.includes(type.id);
                  return (
                    <label
                      key={type.id}
                      className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-100 transition-colors ${isSelected ? "bg-orange-50" : ""
                        }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleType(type.id)}
                        className="w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                      />
                      <div className="flex-1">
                        <span className="text-sm font-medium text-gray-700">
                          {type.name}
                        </span>
                        {type.description && (
                          <p className="text-xs text-gray-500 truncate">
                            {type.description}
                          </p>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
