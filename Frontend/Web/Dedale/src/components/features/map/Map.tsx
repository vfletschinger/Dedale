import { useRef, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";

// Composants
import PointDetails from "../../PointDetails";
import AddPointForm from "../../AddPointForm";
import TimelineBar from "./TimelineBar";
import AddressSearch from "../../AdressSearch";
import ParcoursForm from "../../ParcoursForm";
import InterestForm from "../../InterestForm";
import EquipementForm from "../../EquipementForm";
import EquipementTypeFilter, { VisibilityFilters } from "../../EquipementTypeFilter";
import ZoneForm from "../../ZoneForm";

// Hooks personnalisés
import { useMapPoints } from "../../../hooks/useMapPoints";
import { useMapGeometries } from "../../../hooks/useMapGeometries";
import { useEvents } from "../../../hooks/useEvents";

// Types et Utils
import { SearchResult, MapEvent, Equipement, MapInterest } from "../../../types";
import { getMapStyle } from "../../../utils/mapStyles";
import { Protocol } from "pmtiles";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faMapMarkerAlt,
  faDrawPolygon,
  faRoute,
  faExclamationCircle,
  faTools,
  faTimes,
  faList,
  faCalendarAlt,
  faLayerGroup,
  faSquare,
  faWaveSquare,
  faEye,
  faTrash,
  faCamera,
  faCheck,
  faInbox,
  faSpinner
} from "@fortawesome/free-solid-svg-icons";

// Composant pour l'affichage d'un point dans la liste avec chargement d'adresse asynchrone
function PointListItem({ point, onClick, cachedAddress, onCacheAddress }: {
  point: import("../../../types").MapPoint;
  onClick: () => void;
  cachedAddress?: string;
  onCacheAddress: (id: string, address: string) => void;
}) {
  const [address, setAddress] = useState<string | null>(cachedAddress || null);
  const [loadingAddress, setLoadingAddress] = useState(!cachedAddress);

  useEffect(() => {
    // Si on a déjà l'adresse en cache, on ne fait rien (ou on met à jour si nécessaire)
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
            onCacheAddress(point.id, result);
          } else {
            setAddress(null);
          }
        }
      } catch (err) {
        console.error("Erreur reverse geocoding pour le point", point.id, err);
      } finally {
        if (mounted) setLoadingAddress(false);
      }
    };

    fetchAddress();

    return () => {
      mounted = false;
    };
  }, [point.x, point.y, point.id, cachedAddress, onCacheAddress]);

  return (
    <div
      onClick={onClick}
      className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm hover:shadow-md hover:border-primary transition-all cursor-pointer group"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3">
          <div className="mt-1 bg-red-50 text-red-500 p-2 rounded-full h-8 w-8 flex items-center justify-center shrink-0">
            <FontAwesomeIcon icon={faMapMarkerAlt} />
          </div>
          <div>
            <h4 className="font-bold text-gray-900 text-sm leading-tight">
              {point.name || "Point sans nom"}
            </h4>

            {/* Adresse récupérée dynamiquement */}
            <p className="text-xs text-gray-600 mt-1 flex items-center gap-1.5 font-medium">
              {loadingAddress ? (
                <span className="text-gray-400 italic flex items-center gap-1">
                  <FontAwesomeIcon icon={faSpinner} spin className="text-[10px]" /> Recherche adresse...
                </span>
              ) : address ? (
                <span>{address}</span>
              ) : (
                <span className="text-gray-400 italic">Adresse inconnue</span>
              )}
            </p>

            {/* Badges (Photos / Statut) - Plus discret */}
            <div className="flex flex-wrap gap-2 mt-2">
              {(point.pictures && point.pictures.length > 0) && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-100">
                  <FontAwesomeIcon icon={faCamera} /> {point.pictures.length}
                </span>
              )}
              {point.status && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-50 text-green-700 border border-green-100">
                  <FontAwesomeIcon icon={faCheck} /> Traité
                </span>
              )}
            </div>

            {/* Commentaire tronqué */}
            {point.comment && (
              <p className="text-xs text-slate-500 mt-1.5 line-clamp-1 pl-2 border-l-2 border-slate-200 italic">
                {point.comment}
              </p>
            )}
          </div>
        </div>

        {/* Bouton Voir (visible au survol du groupe) */}
        <button className="opacity-0 group-hover:opacity-100 transition-opacity bg-primary text-white p-1.5 rounded-md shadow-sm hover:bg-primary-dark">
          <FontAwesomeIcon icon={faEye} className="text-xs" />
        </button>
      </div>
    </div>
  );
}

function OfflineMapLibre({
  selectedEventId,
}: {
  selectedEventId: string | null;
}) {
  // --- ÉTATS GLOBAUX DU COMPOSANT ---
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const [pmtilesUrl, setPmtilesUrl] = useState<string | null>(null);

  // Gestion de l'affichage (Vue Carte vs Timeline vs Éléments)
  const [viewMode, setViewMode] = useState<"points" | "elements" | "timeline">("points");

  // Cache pour les adresses (ID Point -> Adresse) pour éviter le flickering
  const [addressCache, setAddressCache] = useState<Record<string, string>>({});

  // État pour le filtre spatial (limites visibles de la carte)
  const [mapBounds, setMapBounds] = useState<{ north: number; south: number; east: number; west: number } | null>(null);

  // État pour le filtre temporel de la timeline (date du curseur)
  const [timelineFilterDate, setTimelineFilterDate] = useState<Date | null>(null);

  // État pour le filtre des types d'équipements (IDs des types sélectionnés)
  // null = pas encore initialisé (afficher tous), [] = aucun sélectionné (afficher aucun)
  const [selectedEquipementTypes, setSelectedEquipementTypes] = useState<string[] | null>(null);

  // État pour les filtres de visibilité des éléments
  const [visibilityFilters, setVisibilityFilters] = useState<VisibilityFilters>({
    showZones: true,
    showParcours: true,
    showInterests: true,
    showEquipements: true,
  });

  // Gestion du marqueur d'adresse (Recherche)
  const [currentMarker, setCurrentMarker] = useState<maplibregl.Marker | null>(
    null
  );

  // 1. Logique des POINTS
  const {
    points,
    interests,
    selectedPoint,
    setSelectedPoint,
    addingPointCoords,
    awaitingMapClick,
    handleAddPointClick,
    refreshPoints,
    refreshInterest,
    openPopupForPoint,
    cancelAddPoint,
  } = useMapPoints(map, selectedEventId, visibilityFilters.showInterests);

  // 2. Logique des GÉOMÉTRIES (Zones & Parcours)
  const {
    zones,
    parcours,
    equipements,
    drawingMode,
    selectedGeometry,
    editingGeometry,
    startDrawPolygon,
    startDrawLine,
    startDrawInterest,
    startDrawEquipment,
    cancelDrawing,
    saveEditGeometry,
    cancelEditGeometry,
    highlightGeometry,
    pendingParcoursGeometry,
    pendingInterestGeometry,
    saveParcoursWithDetails,
    saveInterestWithDetails,
    cancelParcoursForm,
    cancelInterestForm,
    pendingEquipmentData,
    saveEquipmentWithDetails,
    cancelEquipmentForm,
    handleDeleteEquipement,
    pendingZoneGeometry,
    saveZoneWithDetails,
    cancelZoneForm,
  } = useMapGeometries(map, selectedEventId, timelineFilterDate, selectedEquipementTypes, visibilityFilters);

  // 3. Logique des ÉVÉNEMENTS
  const { events } = useEvents();
  const currentEvent: MapEvent | undefined = events.find(
    (e) => String(e.id) === String(selectedEventId)
  );

  // --- EFFETS (Chargement initial) ---

  // Récupération du chemin PMTiles au démarrage
  useEffect(() => {
    const loadPmtilesPath = async () => {
      try {
        // Appeler la commande Tauri pour obtenir le chemin du fichier
        const result = await invoke<{ path: string; url: string }>('get_pmtiles_file_path');

        // Utiliser convertFileSrc pour obtenir une URL accessible par le webview
        const { convertFileSrc } = await import('@tauri-apps/api/core');
        const assetUrl = convertFileSrc(result.path);
        setPmtilesUrl(assetUrl);
      } catch {
        // En mode dev (Vite sans Tauri), utiliser le chemin relatif vers public/
        setPmtilesUrl('/eurometropole_strasbourg.pmtiles');
      }
    };
    loadPmtilesPath();
  }, []);

  // Initialisation de la carte MapLibre (après obtention de l'URL PMTiles)
  useEffect(() => {
    if (map || !mapContainer.current || pmtilesUrl === null) return;

    // Enregistrer le protocole PMTiles
    const protocol = new Protocol();
    maplibregl.addProtocol("pmtiles", protocol.tile);

    // Utilisation du style externe avec l'URL dynamique du fichier PMTiles
    const mapStyle = getMapStyle(pmtilesUrl);

    const mapInstance = new maplibregl.Map({
      container: mapContainer.current,
      style: mapStyle,
      center: [7.7635, 48.5465],
      zoom: 17,
      minZoom: 13,
      maxZoom: 19,
      // Limites de la carte (Eurométropole de Strasbourg)
      maxBounds: [
        [7.55, 48.45], // Sud-Ouest [lng, lat]
        [7.90, 48.65], // Nord-Est [lng, lat]
      ],
    });

    setMap(mapInstance);

    return () => {
      maplibregl.removeProtocol("pmtiles");
      mapInstance.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pmtilesUrl]);

  // Mise à jour des limites visibles de la carte quand elle est déplacée/zoomée
  useEffect(() => {
    if (!map) return;

    const updateBounds = () => {
      const bounds = map.getBounds();
      setMapBounds({
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest(),
      });
    };

    // Mettre à jour au chargement
    updateBounds();

    // Ajouter les listeners pour les mouvements de la carte
    map.on("moveend", updateBounds);
    map.on("zoomend", updateBounds);
    map.on("resize", updateBounds);

    return () => {
      map.off("moveend", updateBounds);
      map.off("zoomend", updateBounds);
      map.off("resize", updateBounds);
    };
  }, [map]);

  // Forcer le recalcul des bounds quand la vue change (timeline ouverte/fermée)
  useEffect(() => {
    if (!map) return;

    // Attendre que le DOM soit mis à jour puis forcer le resize de la carte
    const timeout = setTimeout(() => {
      map.resize();
    }, 100);

    return () => clearTimeout(timeout);
  }, [map, viewMode]);

  // --- GESTIONNAIRES D'INTERFACE ---

  // Fonction pour centrer et zoomer la carte sur un équipement
  const focusOnEquipement = (equipement: Equipement) => {
    if (!map || !equipement.coordinates || equipement.coordinates.length === 0) return;

    // Calculer les bornes (bounding box) de l'équipement
    const coords = equipement.coordinates;
    let minLng = coords[0].x;
    let maxLng = coords[0].x;
    let minLat = coords[0].y;
    let maxLat = coords[0].y;

    coords.forEach((coord) => {
      minLng = Math.min(minLng, coord.x);
      maxLng = Math.max(maxLng, coord.x);
      minLat = Math.min(minLat, coord.y);
      maxLat = Math.max(maxLat, coord.y);
    });

    // Ajouter un peu de padding
    const padding = 0.001; // ~100m environ
    minLng -= padding;
    maxLng += padding;
    minLat -= padding;
    maxLat += padding;

    // Utiliser fitBounds pour centrer et zoomer
    map.fitBounds(
      [[minLng, minLat], [maxLng, maxLat]],
      {
        padding: 50,
        maxZoom: 18,
        duration: 1000
      }
    );
  };

  // Fonction pour centrer et afficher la popup d'un point d'intérêt
  const focusOnInterest = (interest: MapInterest) => {
    if (!map) return;

    // Fermer toute popup existante
    const existingPopups = document.querySelectorAll('.maplibregl-popup');
    existingPopups.forEach(popup => popup.remove());

    // Centrer la carte sur le point
    map.flyTo({
      center: [Number(interest.x), Number(interest.y)],
      zoom: 17,
      duration: 1000
    });

    // Créer et afficher la popup après le déplacement
    setTimeout(() => {
      new maplibregl.Popup({ closeOnClick: true, maxWidth: '300px' })
        .setLngLat([Number(interest.x), Number(interest.y)])
        .setHTML(`
          <div class="p-2">
            <div class="font-bold text-purple-700 mb-2 flex items-center gap-1">
              <span>Point d'intérêt</span>
            </div>
            <p class="text-sm text-gray-700">${interest.description || 'Aucune description'}</p>
          </div>
        `)
        .addTo(map);
    }, 1000);
  };

  const handleAddressSelect = (place: SearchResult) => {
    if (!map) return;
    const { lon, lat, display_name } = place;

    if (currentMarker) currentMarker.remove();

    const marker = new maplibregl.Marker()
      .setLngLat([parseFloat(lon), parseFloat(lat)])
      .setPopup(new maplibregl.Popup().setText(display_name))
      .addTo(map);

    setCurrentMarker(marker);
    map.flyTo({ center: [parseFloat(lon), parseFloat(lat)], zoom: 15 });
  };

  // --- RENDU ---
  return (
    <div className="h-full flex flex-col bg-gray-50 overflow-hidden">
      {/* --- HEADER --- */}
      <div className="bg-gray-900 shadow-lg shrink-0 relative z-30">
        <div className="p-4 pb-0">
          <div className="flex items-center gap-3">
            {/* Barre de recherche */}
            <AddressSearch onSelect={handleAddressSelect} />
          </div>
        </div>

        {/* Onglets Navigation */}
        <div className="flex items-center gap-2 px-4 mt-4 border-t border-gray-800">
          <button
            onClick={() => {
              setTimelineFilterDate(null); // Réinitialiser le filtre temporel
              setViewMode("points");
            }}
            className={`px-4 py-3 text-sm font-bold border-b-2 transition-all ${viewMode === "points"
              ? "text-secondary border-secondary bg-white/5"
              : "text-gray-400 border-transparent hover:text-white hover:bg-white/5"
              }`}
          >
            <span className="flex items-center gap-2">
              <FontAwesomeIcon icon={faList} />
              <span>Liste des points</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${viewMode === 'points' ? 'bg-secondary text-gray-900' : 'bg-gray-700 text-gray-300'}`}>
                {points.length}
              </span>
            </span>
          </button>
          <button
            onClick={() => setViewMode("elements")}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${viewMode === "elements"
              ? "text-white border-primary"
              : "text-slate-400 border-transparent hover:text-slate-200"
              }`}
          >
            <span className="flex items-center gap-2">
              <FontAwesomeIcon icon={faLayerGroup} />
              <span>Éléments</span>
              <span className="text-xs bg-slate-600 px-2 py-0.5 rounded-full">
                {(visibilityFilters.showZones ? zones.length : 0) +
                  (visibilityFilters.showParcours ? parcours.length : 0) +
                  (visibilityFilters.showInterests ? interests.length : 0) +
                  (visibilityFilters.showEquipements ? (
                    selectedEquipementTypes === null
                      ? equipements.length
                      : selectedEquipementTypes.length === 0
                        ? 0
                        : equipements.filter(eq => !eq.type_id || selectedEquipementTypes.includes(eq.type_id)).length
                  ) : 0)}
              </span>
            </span>
          </button>
          <button
            onClick={() => setViewMode("timeline")}
            className={`px-4 py-3 text-sm font-bold border-b-2 transition-all ${viewMode === "timeline"
              ? "text-secondary border-secondary bg-white/5"
              : "text-gray-400 border-transparent hover:text-white hover:bg-white/5"
              }`}
          >
            <span className="flex items-center gap-2">
              <FontAwesomeIcon icon={faCalendarAlt} />
              <span>Frise chronologique</span>
            </span>
          </button>

          {/* Filtre des types d'équipements - Aligné à droite */}
          <div className="ml-auto">
            <EquipementTypeFilter
              selectedTypes={selectedEquipementTypes}
              onFilterChange={setSelectedEquipementTypes}
              variant="header"
              visibilityFilters={visibilityFilters}
              onVisibilityChange={setVisibilityFilters}
            />
          </div>
        </div>
      </div>

      {/* --- CONTENU PRINCIPAL --- */}
      <div className="flex-1 flex overflow-hidden">
        {/* PANNEAU LATÉRAL - Liste des points */}
        {
          viewMode === "points" && (
            <div className="w-80 bg-white border-r border-gray-200 shadow-lg flex flex-col z-20">
              {addingPointCoords ? (
                // Mode: Ajout d'un point
                <div className="flex-1 overflow-y-auto">
                  <AddPointForm
                    initialCoords={addingPointCoords}
                    onClose={cancelAddPoint}
                    onSaved={() => {
                      cancelAddPoint();
                      refreshPoints();
                    }}
                    eventId={selectedEventId}
                  />
                </div>
              ) : selectedPoint ? (
                // Mode: Détails d'un point sélectionné
                <div className="flex-1 overflow-y-auto">
                  <PointDetails
                    point={selectedPoint}
                    onClose={() => setSelectedPoint(null)}
                    onRefresh={refreshPoints}
                    cachedAddress={addressCache[selectedPoint.id]}
                    onCacheAddress={(id, addr) => setAddressCache(prev => ({ ...prev, [id]: addr }))}
                  />
                </div>
              ) : (
                // Mode: Liste des points
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {points.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                      <p className="text-5xl mb-3"><FontAwesomeIcon icon={faInbox} className="text-gray-300" /></p>
                      <p className="font-semibold text-gray-700">Aucun point</p>
                      <p className="text-sm mt-2">
                        Sélectionnez un événement et ajoutez des points sur la
                        carte.
                      </p>
                    </div>
                  ) : (
                    points.map((p) => (
                      <PointListItem
                        key={p.id}
                        point={p}
                        onClick={() => openPopupForPoint(p)}
                        cachedAddress={addressCache[p.id]}
                        onCacheAddress={(id, addr) => setAddressCache(prev => ({ ...prev, [id]: addr }))}
                      />
                    ))
                  )}
                </div>
              )}
            </div>
          )
        }

        {/* PANNEAU LATÉRAL - Éléments (Zones, Parcours, Équipements, Points d'intérêt) */}
        {
          viewMode === "elements" && (
            <div className="w-80 bg-white border-r border-gray-200 shadow-lg flex flex-col z-20">
              <div className="flex-1 overflow-y-auto">
                {(() => {
                  // Calculer les éléments visibles selon les filtres
                  const visibleZones = visibilityFilters.showZones ? zones : [];
                  const visibleParcours = visibilityFilters.showParcours ? parcours : [];
                  const visibleInterests = visibilityFilters.showInterests ? interests : [];
                  const visibleEquipements = visibilityFilters.showEquipements
                    ? (selectedEquipementTypes === null
                      ? equipements
                      : selectedEquipementTypes.length === 0
                        ? []
                        : equipements.filter(eq => !eq.type_id || selectedEquipementTypes.includes(eq.type_id)))
                    : [];

                  const hasNoElements = visibleZones.length === 0 && visibleParcours.length === 0 && visibleEquipements.length === 0 && visibleInterests.length === 0;

                  if (hasNoElements) {
                    return (
                      <div className="text-center text-gray-500 py-8">
                        <p className="text-5xl mb-3"><FontAwesomeIcon icon={faLayerGroup} className="text-gray-300" /></p>
                        <p className="font-semibold text-gray-700">Aucun élément</p>
                        <p className="text-sm mt-2">
                          {zones.length + parcours.length + interests.length + equipements.length > 0
                            ? "Modifiez les filtres pour afficher des éléments."
                            : "Utilisez les outils sur la carte pour ajouter des zones, parcours, équipements ou points d'intérêt."}
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="divide-y divide-gray-200">
                      {/* --- SECTION ZONES --- */}
                      {visibleZones.length > 0 && (
                        <div>
                          <div className="px-4 py-2 bg-blue-50 text-sm font-bold text-blue-700 uppercase tracking-wider flex items-center gap-2">
                            <FontAwesomeIcon icon={faSquare} /> Zones ({visibleZones.length})
                          </div>
                          {visibleZones.map((zone) => {
                            const itemData = { ...zone, type: "zone" as const };
                            const isSelected =
                              selectedGeometry?.id === zone.id &&
                              selectedGeometry?.type === "zone";
                            const isEditing =
                              editingGeometry?.id === zone.id &&
                              editingGeometry?.type === "zone";

                            return (
                              <div
                                key={`zone-${zone.id}`}
                                className={`p-3 border-b border-gray-200 last:border-0 hover:bg-primary/10 cursor-pointer transition-colors ${isSelected
                                  ? "bg-primary/20 border-l-4"
                                  : isEditing
                                    ? "bg-amber-50"
                                    : ""
                                  }`}
                                style={isSelected ? { borderLeftColor: zone.color || '#6366f1' } : {}}
                                onClick={() =>
                                  highlightGeometry(
                                    isSelected ? null : itemData
                                  )
                                }
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-lg" style={{ color: zone.color || '#6366f1' }}><FontAwesomeIcon icon={faSquare} /></span>
                                  <span className="text-sm font-medium truncate flex-1">
                                    {zone.name ||
                                      `Zone #${zone.id.slice(0, 8)}`}
                                  </span>
                                  {isSelected && (
                                    <span className="text-sm" style={{ color: zone.color || '#6366f1' }}>
                                      <FontAwesomeIcon icon={faEye} />
                                    </span>
                                  )}
                                </div>

                                {isEditing && (
                                  <div className="flex gap-2 mt-2">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        saveEditGeometry();
                                      }}
                                      className="flex-1 bg-green-600 text-white text-xs py-1 rounded"
                                    >
                                      Sauver
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        cancelEditGeometry();
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
                      {visibleParcours.length > 0 && (
                        <div>
                          <div className="px-4 py-2 bg-green-50 text-sm font-bold text-green-700 uppercase tracking-wider flex items-center gap-2">
                            <FontAwesomeIcon icon={faWaveSquare} /> Parcours ({visibleParcours.length})
                          </div>
                          {visibleParcours.map((p) => {
                            const itemData = {
                              ...p,
                              type: "parcours" as const,
                            };
                            const isSelected =
                              selectedGeometry?.id === p.id &&
                              selectedGeometry?.type === "parcours";
                            const isEditing =
                              editingGeometry?.id === p.id &&
                              editingGeometry?.type === "parcours";

                            return (
                              <div
                                key={`parcours-${p.id}`}
                                className={`p-3 border-b border-gray-200 last:border-0 hover:bg-primary/10 cursor-pointer transition-colors ${isSelected
                                  ? "bg-primary/20 border-l-4"
                                  : isEditing
                                    ? "bg-amber-50"
                                    : ""
                                  }`}
                                style={isSelected ? { borderLeftColor: p.color || '#16a34a' } : {}}
                                onClick={() =>
                                  highlightGeometry(
                                    isSelected ? null : itemData
                                  )
                                }
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-lg" style={{ color: p.color || '#16a34a' }}><FontAwesomeIcon icon={faWaveSquare} /></span>
                                  <span className="text-sm font-medium truncate flex-1">
                                    {p.name || `Parcours #${p.id.slice(0, 8)}`}
                                  </span>
                                  {isSelected && (
                                    <span className="text-sm" style={{ color: p.color || '#16a34a' }}>
                                      <FontAwesomeIcon icon={faEye} />
                                    </span>
                                  )}
                                </div>

                                {isEditing && (
                                  <div className="flex gap-2 mt-2">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        saveEditGeometry();
                                      }}
                                      className="flex-1 bg-green-600 text-white text-xs py-1 rounded"
                                    >
                                      Sauver
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        cancelEditGeometry();
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
                      {visibleEquipements.length > 0 && (
                        <div>
                          <div className="px-4 py-2 bg-orange-50 text-sm font-bold text-orange-700 uppercase tracking-wider flex items-center gap-2">
                            <FontAwesomeIcon icon={faTools} /> Équipements ({visibleEquipements.length})
                          </div>
                          {visibleEquipements.map((eq) => (
                            <div
                              key={`equipement-${eq.id}`}
                              className="p-3 border-b border-gray-200 last:border-0 hover:bg-orange-50 cursor-pointer"
                              onClick={() => focusOnEquipement(eq)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 flex-1">
                                  <span className="text-lg text-orange-600"><FontAwesomeIcon icon={faTools} /></span>
                                  <div className="flex-1">
                                    <span className="text-sm font-medium text-gray-700">
                                      {eq.type_name || "Équipement"}
                                    </span>
                                    <div className="text-xs text-gray-500">
                                      {eq.length}m/unité • {eq.coordinates?.length || 0} points
                                    </div>
                                  </div>
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteEquipement(eq.id);
                                  }}
                                  className="p-1.5 text-red-600 hover:bg-red-100 rounded"
                                  title="Supprimer"
                                >
                                  <FontAwesomeIcon icon={faTrash} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* --- SECTION POINTS D'INTÉRÊT --- */}
                      {visibleInterests.length > 0 && (
                        <div>
                          <div className="px-4 py-2 bg-purple-50 text-sm font-bold text-purple-700 uppercase tracking-wider flex items-center gap-2">
                            <FontAwesomeIcon icon={faExclamationCircle} /> Points d'intérêt ({visibleInterests.length})
                          </div>
                          {visibleInterests.map((interest) => (
                            <div
                              key={`interest-${interest.id}`}
                              className="p-3 border-b border-gray-200 last:border-0 hover:bg-purple-50 cursor-pointer"
                              onClick={() => focusOnInterest(interest)}
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-lg text-purple-600"><FontAwesomeIcon icon={faExclamationCircle} /></span>
                                <span className="text-sm font-medium truncate flex-1 text-gray-700">
                                  {interest.description
                                    ? (interest.description.length > 40
                                      ? `${interest.description.slice(0, 40)}...`
                                      : interest.description)
                                    : `Point #${interest.id.slice(0, 8)}`}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          )
        }

        {/* TIMELINE */}
        {
          viewMode === "timeline" && (
            <div className="w-1/2 h-full bg-white border-r border-gray-200 shadow-lg flex flex-col z-20 overflow-hidden">
              {currentEvent ? (
                <TimelineBar
                  event={currentEvent}
                  points={points}
                  equipements={selectedEquipementTypes === null
                    ? equipements  // Pas encore initialisé = tous
                    : selectedEquipementTypes.length === 0
                      ? []  // Filtre vide = aucun
                      : equipements.filter(eq => !eq.type_id || selectedEquipementTypes.includes(eq.type_id))
                  }
                  onPointClick={openPopupForPoint}
                  onEquipementClick={focusOnEquipement}
                  onClose={() => {
                    setTimelineFilterDate(null); // Réinitialiser le filtre temporel
                    setViewMode("points");
                  }}
                  onDateChange={setTimelineFilterDate}
                  mapBounds={mapBounds}
                />
              ) : (
                <div className="p-4 bg-gray-100 text-center flex items-center justify-center h-full">
                  <div>
                    <p className="text-5xl mb-3"><FontAwesomeIcon icon={faCalendarAlt} className="text-gray-300" /></p>
                    <p className="font-semibold text-gray-700">Aucun événement sélectionné</p>
                    <p className="text-sm mt-2 text-gray-500">
                      Sélectionnez un événement pour voir la frise chronologique
                    </p>
                  </div>
                </div>
              )}
            </div>
          )
        }

        {/* CARTE */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          <div ref={mapContainer} className="flex-1 h-full" />

          {/* OUTILS FLOTTANTS (Sur la carte) */}
          {selectedEventId && (
            <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
              {/* Message d'aide */}
              {(drawingMode !== "none" || awaitingMapClick) && (
                <div className="bg-primary text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium animate-fade-in">
                  {awaitingMapClick
                    ? <span><FontAwesomeIcon icon={faMapMarkerAlt} /> Cliquez sur la carte pour placer le point</span>
                    : "Double-cliquez pour terminer le dessin"}
                </div>
              )}

              {/* Barre d'outils */}
              <div className="flex gap-2">
                <button
                  onClick={handleAddPointClick}
                  className={`px-2 py-2 rounded-lg shadow-lg flex items-center justify-center transition-all ${awaitingMapClick
                    ? "bg-amber-500 text-white animate-pulse"
                    : "bg-white hover:bg-gray-50 text-gray-700"
                    }`}
                  title="Ajouter un point"
                >
                  <span className="text-base"><FontAwesomeIcon icon={faMapMarkerAlt} /></span>
                </button>

                <button
                  onClick={startDrawPolygon}
                  className={`px-2 py-2 rounded-lg shadow-lg flex items-center justify-center transition-all ${drawingMode === "zone"
                    ? "bg-primary text-white"
                    : "bg-white hover:bg-gray-50 text-gray-700"
                    }`}
                  title="Zone (Polygone)"
                >
                  <span className="text-base"><FontAwesomeIcon icon={faDrawPolygon} /></span>
                </button>

                <button
                  onClick={startDrawLine}
                  className={`px-2 py-2 rounded-lg shadow-lg flex items-center justify-center transition-all ${drawingMode === "parcours"
                    ? "bg-red-500 text-white"
                    : "bg-white hover:bg-gray-50 text-gray-700"
                    }`}
                  title="Parcours (Ligne)"
                >
                  <span className="text-base"><FontAwesomeIcon icon={faRoute} /></span>
                </button>
                <button
                  onClick={startDrawInterest}
                  className={`px-2 py-2 rounded-lg shadow-lg flex items-center justify-center transition-all ${drawingMode === "interest"
                    ? "bg-purple-600 text-white"
                    : "bg-white hover:bg-gray-50 text-gray-700"
                    }`}
                  title="Point d'intérêt"
                >
                  <span className="text-base"><FontAwesomeIcon icon={faExclamationCircle} /></span>
                </button>

                <button
                  onClick={startDrawEquipment}
                  className={`px-2 py-2 rounded-lg shadow-lg flex items-center justify-center transition-all ${drawingMode === "equipment"
                    ? "bg-green-600 text-white"
                    : "bg-white hover:bg-gray-50 text-gray-700"
                    }`}
                  title="Équipement"
                >
                  <span className="text-base"><FontAwesomeIcon icon={faTools} /></span>
                </button>

                {(drawingMode !== "none" || awaitingMapClick) && (
                  <button
                    onClick={() => {
                      if (drawingMode !== "none") cancelDrawing();
                      if (awaitingMapClick) {
                        cancelAddPoint();
                      }
                    }}
                    className="px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg shadow-lg text-sm font-semibold flex items-center gap-1"
                  >
                    <span><FontAwesomeIcon icon={faTimes} /> Annuler</span>
                  </button>
                )}
              </div>
            </div >
          )
          }
        </div >
      </div >

      {/* Formulaire de création de parcours */}
      {pendingParcoursGeometry && (
        <ParcoursForm
          onSubmit={saveParcoursWithDetails}
          onCancel={cancelParcoursForm}
        />
      )}

      {/* Formulaire de création de zone */}
      {pendingZoneGeometry && (
        <ZoneForm
          onSubmit={saveZoneWithDetails}
          onCancel={cancelZoneForm}
        />
      )}

      {/* Formulaire de création de point d'intérêt */}
      {pendingInterestGeometry && (
        <InterestForm
          onSubmit={async (data) => {
            await saveInterestWithDetails(data);
            refreshInterest();
          }}
          onCancel={cancelInterestForm}
        />
      )}

      {/* Formulaire de création d'équipement */}
      {pendingEquipmentData && (
        <EquipementForm
          lineLength={pendingEquipmentData.lineLength}
          onSubmit={saveEquipmentWithDetails}
          onCancel={cancelEquipmentForm}
        />
      )}
    </div>
  );
}

export default OfflineMapLibre;
