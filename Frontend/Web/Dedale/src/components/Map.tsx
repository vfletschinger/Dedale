import { useRef, useEffect, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";

// Composants
import PointDetails from "./PointDetails";
import AddPointForm from "./AddPointForm";
import TimelineBar from "./TimelineBar";
import AddressSearch from "./AdressSearch";
import ParcoursForm from "./ParcoursForm";
import InterestForm from "./InterestForm";
import EquipementForm from "./EquipementForm";
import EquipementTypeFilter from "./EquipementTypeFilter";
import ZoneForm from "./ZoneForm";

// Hooks personnalisés
import { useMapPoints } from "../hooks/useMapPoints";
import { useMapGeometries } from "../hooks/useMapGeometries";
import { useEvents } from "../hooks/useEvents";

// Types et Utils
import { SearchResult, MapEvent, Equipement, MapInterest } from "../types/map";
import { getMapStyle } from "../utils/mapStyles";
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
  faComment,
  faCaretDown,
  faInbox
} from "@fortawesome/free-solid-svg-icons";

function OfflineMapLibre({
  selectedEventId,
}: {
  selectedEventId: string | null;
}) {
  // --- ÉTATS GLOBAUX DU COMPOSANT ---
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const [map, setMap] = useState<maplibregl.Map | null>(null);

  // Gestion de l'affichage (Vue Carte vs Timeline vs Éléments)
  const [viewMode, setViewMode] = useState<"points" | "elements" | "timeline">("points");

  // État pour le filtre spatial (limites visibles de la carte)
  const [mapBounds, setMapBounds] = useState<{ north: number; south: number; east: number; west: number } | null>(null);

  // État pour le filtre temporel de la timeline (date du curseur)
  const [timelineFilterDate, setTimelineFilterDate] = useState<Date | null>(null);

  // État pour le filtre des types d'équipements (IDs des types sélectionnés)
  // null = pas encore initialisé (afficher tous), [] = aucun sélectionné (afficher aucun)
  const [selectedEquipementTypes, setSelectedEquipementTypes] = useState<string[] | null>(null);

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
    setAddingPointCoords,
    awaitingMapClick,
    handleAddPointClick,
    refreshPoints,
    refreshInterest,
    openPopupForPoint,
  } = useMapPoints(map, selectedEventId);

  // 2. Logique des GÉOMÉTRIES (Zones & Parcours)
  const {
    zones,
    parcours,
    equipements,
    drawingMode,
    selectedGeometry,
    editingGeometry,
    isGeometryListOpen,
    setIsGeometryListOpen,
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
  } = useMapGeometries(map, selectedEventId, timelineFilterDate, selectedEquipementTypes);

  // 3. Logique des ÉVÉNEMENTS
  const { events } = useEvents();
  const currentEvent: MapEvent | undefined = events.find(
    (e) => String(e.id) === String(selectedEventId)
  );

  // --- EFFETS (Chargement initial) ---

  // Initialisation de la carte MapLibre
  useEffect(() => {
    if (map || !mapContainer.current) return;
    // Enregistrer le protocole PMTiles
    const protocol = new Protocol();
    maplibregl.addProtocol("pmtiles", protocol.tile);

    // Utilisation du style externe avec les nouvelles couleurs
    const mapStyle = getMapStyle();

    const mapInstance = new maplibregl.Map({
      container: mapContainer.current,
      style: mapStyle,
      center: [7.7635, 48.5465],
      zoom: 17, // Zoom initial plus proche pour voir le détail
      minZoom: 13, // Zoom minimum
      maxZoom: 19, // Permettre le zoom très proche
    });

    setMap(mapInstance);

    return () => {
      maplibregl.removeProtocol("pmtiles");
      mapInstance.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      <div className="bg-slate-700 shadow-lg shrink-0">
        <div className="p-4 pb-0">
          <div className="flex items-center gap-3">
            {/* Barre de recherche */}
            <AddressSearch onSelect={handleAddressSelect} />
          </div>
        </div>

        {/* Onglets Navigation */}
        <div className="flex items-center gap-2 px-4 mt-3 border-t border-slate-600">
          <button
            onClick={() => {
              setTimelineFilterDate(null); // Réinitialiser le filtre temporel
              setViewMode("points");
            }}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${viewMode === "points"
              ? "text-white border-primary"
              : "text-slate-400 border-transparent hover:text-slate-200"
              }`}
          >
            <span className="flex items-center gap-2">
              <FontAwesomeIcon icon={faList} />
              <span>Liste des points</span>
              <span className="text-xs bg-slate-600 px-2 py-0.5 rounded-full">
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
                {zones.length + parcours.length + equipements.length + interests.length}
              </span>
            </span>
          </button>
          <button
            onClick={() => setViewMode("timeline")}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${viewMode === "timeline"
              ? "text-white border-primary"
              : "text-slate-400 border-transparent hover:text-slate-200"
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
            />
          </div>
        </div>
      </div>

      {/* --- CONTENU PRINCIPAL --- */}
      <div className="flex-1 flex overflow-hidden">
        {/* PANNEAU LATÉRAL - Liste des points */}
        {
          viewMode === "points" && (
            <div className="w-96 bg-white border-r border-gray-200 shadow-lg flex flex-col z-20">
              {addingPointCoords ? (
                // Mode: Ajout d'un point
                <div className="flex-1 overflow-y-auto">
                  <AddPointForm
                    initialCoords={addingPointCoords}
                    onClose={() => setAddingPointCoords(null)}
                    onSaved={() => {
                      setAddingPointCoords(null);
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
                      <div
                        key={p.id}
                        onClick={() => openPopupForPoint(p)}
                        className="p-3 bg-white rounded-lg border border-gray-200 hover:border-primary hover:shadow-md cursor-pointer group"
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-bold text-gray-800 text-sm flex gap-2 items-center">
                            <FontAwesomeIcon icon={faMapMarkerAlt} className="text-red-500" /> {p.name || `Point #${p.id.slice(0, 8)}`}
                          </span>
                          <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1 border border-primary/20">
                            <FontAwesomeIcon icon={faEye} /> Voir
                          </span>
                        </div>
                        <div className="flex gap-2 text-xs">
                          <span className="bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200 flex items-center gap-1">
                            <FontAwesomeIcon icon={faCamera} /> {p.pictures?.length || 0}
                          </span>
                          {p.status && (
                            <span className="bg-green-50 text-green-700 px-1.5 py-0.5 rounded border border-green-200 flex items-center gap-1">
                              <FontAwesomeIcon icon={faCheck} /> Traité
                            </span>
                          )}
                        </div>
                        {p.comment && (
                          <div className="text-xs text-gray-500 mt-2 line-clamp-1 flex items-center gap-1">
                            <FontAwesomeIcon icon={faComment} /> {p.comment}
                          </div>
                        )}
                      </div>
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
            <div className="w-96 bg-white border-r border-gray-200 shadow-lg flex flex-col z-20">
              <div className="flex-1 overflow-y-auto">
                {(zones.length === 0 && parcours.length === 0 && equipements.length === 0 && interests.length === 0) ? (
                  <div className="text-center text-gray-500 py-8">
                    <p className="text-5xl mb-3"><FontAwesomeIcon icon={faLayerGroup} className="text-gray-300" /></p>
                    <p className="font-semibold text-gray-700">Aucun élément</p>
                    <p className="text-sm mt-2">
                      Utilisez les outils sur la carte pour ajouter des zones, parcours, équipements ou points d'intérêt.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {/* --- SECTION ZONES --- */}
                    {zones.length > 0 && (
                      <div>
                        <div className="px-4 py-2 bg-blue-50 text-sm font-bold text-blue-700 uppercase tracking-wider flex items-center gap-2">
                          <FontAwesomeIcon icon={faSquare} /> Zones ({zones.length})
                        </div>
                        {zones.map((zone) => {
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
                                ? "bg-primary/20 border-l-4 border-l-primary"
                                : isEditing
                                  ? "bg-amber-50"
                                  : ""
                                }`}
                              onClick={() =>
                                highlightGeometry(
                                  isSelected ? null : itemData
                                )
                              }
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-lg text-primary"><FontAwesomeIcon icon={faSquare} /></span>
                                <span className="text-sm font-medium truncate flex-1">
                                  {zone.name ||
                                    `Zone #${zone.id.slice(0, 8)}`}
                                </span>
                                {isSelected && (
                                  <span className="text-primary text-sm">
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
                    {parcours.length > 0 && (
                      <div>
                        <div className="px-4 py-2 bg-green-50 text-sm font-bold text-green-700 uppercase tracking-wider flex items-center gap-2">
                          <FontAwesomeIcon icon={faWaveSquare} /> Parcours ({parcours.length})
                        </div>
                        {parcours.map((p) => {
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
                                ? "bg-primary/20 border-l-4 border-l-green-500"
                                : isEditing
                                  ? "bg-amber-50"
                                  : ""
                                }`}
                              onClick={() =>
                                highlightGeometry(
                                  isSelected ? null : itemData
                                )
                              }
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-lg text-green-600"><FontAwesomeIcon icon={faWaveSquare} /></span>
                                <span className="text-sm font-medium truncate flex-1">
                                  {p.name || `Parcours #${p.id.slice(0, 8)}`}
                                </span>
                                {isSelected && (
                                  <span className="text-green-500 text-sm">
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
                    {equipements.length > 0 && (
                      <div>
                        <div className="px-4 py-2 bg-orange-50 text-sm font-bold text-orange-700 uppercase tracking-wider flex items-center gap-2">
                          <FontAwesomeIcon icon={faTools} /> Équipements ({equipements.length})
                        </div>
                        {equipements.map((eq) => (
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
                    {interests.length > 0 && (
                      <div>
                        <div className="px-4 py-2 bg-purple-50 text-sm font-bold text-purple-700 uppercase tracking-wider flex items-center gap-2">
                          <FontAwesomeIcon icon={faExclamationCircle} /> Points d'intérêt ({interests.length})
                        </div>
                        {interests.map((interest) => (
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
                )}
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
                        setAddingPointCoords(null);
                        window.dispatchEvent(new Event("cancel-map-action"));
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
