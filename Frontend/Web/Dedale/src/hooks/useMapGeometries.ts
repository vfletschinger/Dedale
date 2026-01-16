import { useState, useRef, useEffect, useCallback } from "react";
import maplibregl from "maplibre-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import { invoke } from "@tauri-apps/api/core";
import { geoJSONtoWKT, parseWKTtoGeoJSON } from "../utils/maputils";
import { Zone, Parcours, Equipement } from "../types/map";

// Types pour les filtres de visibilité
export interface VisibilityFilters {
  showZones: boolean;
  showParcours: boolean;
  showInterests: boolean;
  showEquipements: boolean;
}

// Extend types to include description property
type ZoneWithDescription = Zone & { description?: string };
type ParcoursWithDescription = Parcours & { description?: string };

// Type utilitaire pour manipuler indifféremment une Zone ou un Parcours dans l'UI
export type GeometryItem = (ZoneWithDescription | ParcoursWithDescription) & { type: "zone" | "parcours" };

// Fonction utilitaire pour calculer la longueur d'une ligne en mètres (approximation Haversine)
function calculateLineLength(coordinates: [number, number][]): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371000; // Rayon de la Terre en mètres

  let totalLength = 0;
  for (let i = 0; i < coordinates.length - 1; i++) {
    const [lon1, lat1] = coordinates[i];
    const [lon2, lat2] = coordinates[i + 1];

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    totalLength += R * c;
  }

  return totalLength;
}

export function useMapGeometries(
  map: maplibregl.Map | null,
  selectedEventId: string | null,
  timelineFilterDate: Date | null = null,
  equipementTypeFilter: string[] | null = null, // Filtre par type d'équipement (IDs des types)
  visibilityFilters: VisibilityFilters = { showZones: true, showParcours: true, showInterests: true, showEquipements: true }, // Filtres de visibilité des éléments
) {
  // --- ÉTATS ---
  const [zones, setZones] = useState<Zone[]>([]);
  const [parcours, setParcours] = useState<Parcours[]>([]);
  const [equipements, setEquipements] = useState<Equipement[]>([]);
  const [drawingMode, setDrawingMode] = useState<
    "none" | "zone" | "parcours" | "interest" | "equipment"
  >("none");
  const [pendingParcoursGeometry, setPendingParcoursGeometry] = useState<
    string | null
  >(null);
  const [pendingInterestGeometry, setPendingInterestGeometry] = useState<
    string | null
  >(null);
  // État pour stocker la géométrie d'une zone en attente de validation
  const [pendingZoneGeometry, setPendingZoneGeometry] = useState<
    string | null
  >(null);
  // État pour stocker les coordonnées d'un équipement en attente de validation
  const [pendingEquipmentData, setPendingEquipmentData] = useState<{
    coordinates: [number, number][];
    lineLength: number;
  } | null>(null);

  // Changement : On stocke l'ID (string) ET le type pour savoir ce qu'on manipule
  const [selectedGeometry, setSelectedGeometry] = useState<{
    id: string;
    type: "zone" | "parcours";
  } | null>(null);
  const [editingGeometry, setEditingGeometry] = useState<{
    id: string;
    type: "zone" | "parcours";
    color?: string;
  } | null>(null);

  const [isGeometryListOpen, setIsGeometryListOpen] = useState(false);

  // --- REFS ---
  const drawRef = useRef<MapboxDraw | null>(null);
  // Ref pour accéder à l'ID dans les event listeners sans déclencher de re-render
  const selectedEventIdRef = useRef<string | null>(selectedEventId);
  const timelineFilterDateRef = useRef<Date | null>(timelineFilterDate);
  const mountedRef = useRef(true);
  const drawingModeRef = useRef<"none" | "zone" | "parcours" | "interest" | "equipment">(
    "none"
  );
  const popupRef = useRef<maplibregl.Popup | null>(null);

  useEffect(() => {
    selectedEventIdRef.current = selectedEventId;
  }, [selectedEventId]);

  useEffect(() => {
    timelineFilterDateRef.current = timelineFilterDate;
  }, [timelineFilterDate]);

  const equipementTypeFilterRef = useRef<string[] | null>(equipementTypeFilter);
  useEffect(() => {
    equipementTypeFilterRef.current = equipementTypeFilter;
  }, [equipementTypeFilter]);

  const visibilityFiltersRef = useRef<VisibilityFilters>(visibilityFilters);
  useEffect(() => {
    visibilityFiltersRef.current = visibilityFilters;
  }, [visibilityFilters]);

  useEffect(() => {
    drawingModeRef.current = drawingMode;
  }, [drawingMode]);

  // --- FONCTION : Rafraîchir l'affichage sur la carte ---
  const refreshGeometriesOnMap = useCallback(
    (
      mapObj: maplibregl.Map,
      currentZones: Zone[],
      currentParcours: Parcours[],
      currentEquipements: Equipement[] = [],
      filterDate: Date | null = null,
      typeFilter: string[] | null = null, // Filtre par type d'équipement
      visFilters: VisibilityFilters = { showZones: true, showParcours: true, showInterests: true, showEquipements: true } // Filtres de visibilité
    ) => {
      // Vérifier que le style est chargé avant de manipuler les sources/layers
      if (!mapObj.isStyleLoaded()) {
        return;
      }

      // Nettoyage
      const layersToRemove = [
        "event-geometries-fill",
        "event-geometries-line",
        "event-geometries-point",
        "event-equipements-line",
        "event-vehicules-symbol",
      ];
      layersToRemove.forEach((layer) => {
        if (mapObj.getLayer(layer)) mapObj.removeLayer(layer);
      });
      if (mapObj.getSource("event-geometries"))
        mapObj.removeSource("event-geometries");
      if (mapObj.getSource("event-equipements"))
        mapObj.removeSource("event-equipements");
      if (mapObj.getSource("event-vehicules"))
        mapObj.removeSource("event-vehicules");

      // Filtrer les zones et parcours selon les filtres de visibilité
      const filteredZones = visFilters.showZones ? currentZones : [];
      const filteredParcours = visFilters.showParcours ? currentParcours : [];
      const filteredEquipementsInput = visFilters.showEquipements ? currentEquipements : [];

      if (
        filteredZones.length === 0 &&
        filteredParcours.length === 0 &&
        filteredEquipementsInput.length === 0
      )
        return;

      // Conversion Zones -> GeoJSON
      const zoneFeatures = filteredZones
        .map((z) => {
          const geometry = parseWKTtoGeoJSON(z.geometry_json);
          if (!geometry) return null;
          return {
            type: "Feature",
            geometry,
            properties: { id: z.id, type: "zone", event_id: z.event_id, color: z.color || "#6366f1" },
          } as GeoJSON.Feature;
        })
        .filter((f): f is GeoJSON.Feature => f !== null);

      // Conversion Parcours -> GeoJSON
      const parcoursFeatures = filteredParcours
        .map((p) => {
          const geometry = parseWKTtoGeoJSON(p.geometry_json);
          if (!geometry) return null;
          return {
            type: "Feature",
            geometry,
            properties: { id: p.id, type: "parcours", event_id: p.event_id, color: p.color || "#ef4444" },
          } as GeoJSON.Feature;
        })
        .filter((f): f is GeoJSON.Feature => f !== null);

      const allFeatures = [...zoneFeatures, ...parcoursFeatures];

      // Ajout des zones et parcours seulement s'il y en a
      if (allFeatures.length > 0) {
        mapObj.addSource("event-geometries", {
          type: "geojson",
          data: { type: "FeatureCollection", features: allFeatures },
        });

        // Styles
        mapObj.addLayer({
          id: "event-geometries-fill",
          type: "fill",
          source: "event-geometries",
          filter: ["==", ["geometry-type"], "Polygon"],
          paint: { "fill-color": ["get", "color"], "fill-opacity": 0.3 },
        });

        mapObj.addLayer({
          id: "event-geometries-line",
          type: "line",
          source: "event-geometries",
          filter: [
            "any",
            ["==", ["geometry-type"], "LineString"],
            ["==", ["geometry-type"], "Polygon"],
          ],
          paint: {
            "line-color": ["get", "color"],
            "line-width": 3,
          },
        });
      }

      // Affichage des équipements (avec filtre temporel et filtre par type optionnels)
      if (filteredEquipementsInput.length > 0) {
        // D'abord filtrer par type si un filtre est actif et non-null
        // null = pas encore initialisé = afficher tous
        // [] = aucun sélectionné = afficher aucun
        // [...ids] = filtrer par les types sélectionnés
        let filteredEquipements: Equipement[];
        if (typeFilter === null) {
          // Pas de filtre défini = tous les équipements
          filteredEquipements = filteredEquipementsInput;
        } else if (typeFilter.length === 0) {
          // Filtre vide = aucun équipement
          filteredEquipements = [];
        } else {
          // Filtrer par les types sélectionnés
          filteredEquipements = filteredEquipementsInput.filter((eq) => {
            // Si l'équipement n'a pas de type_id, on l'affiche (équipement sans type)
            if (!eq.type_id) return true;
            return typeFilter.includes(eq.type_id);
          });
        }

        // Ensuite filtrer par date du curseur si un filtre temporel est actif
        if (filterDate) {
          filteredEquipements = filteredEquipements.filter((eq) => {
            // Fonction pour parser une date+heure depuis les champs de l'équipement
            const parseDateTime = (dateStr?: string, timeStr?: string): Date | null => {
              if (!dateStr) return null;
              if (dateStr.includes('T')) return new Date(dateStr);
              if (timeStr) return new Date(`${dateStr}T${timeStr}`);
              return new Date(`${dateStr}T00:00:00`);
            };

            const poseDate = parseDateTime(eq.date_pose, eq.hour_pose);
            const deposeDate = parseDateTime(eq.date_depose, eq.hour_depose);
            const cursor = filterDate.getTime();

            // Cas 1: L'équipement n'a ni date de pose ni de dépose -> on l'affiche toujours
            if (!poseDate && !deposeDate) return true;

            // Cas 2: Seulement date de pose -> l'équipement est visible si le curseur est >= date de pose
            if (poseDate && !deposeDate) {
              return cursor >= poseDate.getTime();
            }

            // Cas 3: Seulement date de dépose -> l'équipement est visible si le curseur est <= date de dépose
            if (!poseDate && deposeDate) {
              return cursor <= deposeDate.getTime();
            }

            // Cas 4: Les deux dates -> l'équipement est visible si le curseur est entre les deux
            if (poseDate && deposeDate) {
              return cursor >= poseDate.getTime() && cursor <= deposeDate.getTime();
            }

            return true;
          });
        }

        // Fonction pour déterminer l'épaisseur du trait selon le type d'équipement
        const getLineWidth = (typeName?: string): number => {
          if (!typeName) return 3;
          const name = typeName.toLowerCase();
          // Blocs de béton et glissières : trait épais
          if (name.includes("bloc") || name.includes("glissière") || name.includes("glissiere")) {
            return 5;
          }
          // Barrières : trait fin
          if (name.includes("barrière") || name.includes("barriere")) {
            return 2;
          }
          // Par défaut : trait moyen
          return 3;
        };

        // Fonction pour vérifier si un équipement est de type véhicule
        const isVehicule = (typeName?: string): boolean => {
          if (!typeName) return false;
          const name = typeName.toLowerCase();
          return name.includes("véhicule") || name.includes("vehicule") || name.includes("engin");
        };

        // Séparer les véhicules des autres équipements
        const vehiculeEquipements = filteredEquipements.filter((eq) => isVehicule(eq.type_name));
        const otherEquipements = filteredEquipements.filter((eq) => !isVehicule(eq.type_name));

        // Features pour les équipements non-véhicules (lignes)
        const equipementFeatures = otherEquipements
          .map((eq) => {
            if (!eq.coordinates || eq.coordinates.length < 2) return null;
            const coords = eq.coordinates
              .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
              .map((c) => [c.x, c.y]);
            return {
              type: "Feature",
              geometry: { type: "LineString", coordinates: coords },
              properties: {
                id: eq.id,
                type: "equipement",
                type_name: eq.type_name,
                line_width: getLineWidth(eq.type_name),
              },
            } as GeoJSON.Feature;
          })
          .filter((f): f is GeoJSON.Feature => f !== null);

        // Features pour les véhicules (points avec emoji)
        const vehiculeFeatures = vehiculeEquipements
          .map((eq) => {
            if (!eq.coordinates || eq.coordinates.length === 0) return null;
            const coords = eq.coordinates
              .sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
            // Prendre le point central du véhicule
            const midIndex = Math.floor(coords.length / 2);
            const centerCoord = coords[midIndex];
            return {
              type: "Feature",
              geometry: { type: "Point", coordinates: [centerCoord.x, centerCoord.y] },
              properties: {
                id: eq.id,
                type: "equipement",
                type_name: eq.type_name,
              },
            } as GeoJSON.Feature;
          })
          .filter((f): f is GeoJSON.Feature => f !== null);

        if (equipementFeatures.length > 0) {
          mapObj.addSource("event-equipements", {
            type: "geojson",
            data: { type: "FeatureCollection", features: equipementFeatures },
          });

          mapObj.addLayer({
            id: "event-equipements-line",
            type: "line",
            source: "event-equipements",
            paint: {
              "line-color": "#000000", // Noir pour tous les équipements
              "line-width": ["get", "line_width"], // Épaisseur variable selon le type
            },
          });
        }

        // Ajouter les véhicules comme symboles avec image
        if (vehiculeFeatures.length > 0) {
          // Fonction pour ajouter la source et le layer des véhicules
          const addVehiculesLayer = () => {
            if (mapObj.getSource("event-vehicules")) return;
            
            mapObj.addSource("event-vehicules", {
              type: "geojson",
              data: { type: "FeatureCollection", features: vehiculeFeatures },
            });

            mapObj.addLayer({
              id: "event-vehicules-symbol",
              type: "symbol",
              source: "event-vehicules",
              layout: {
                "icon-image": "vehicule-icon",
                "icon-size": 0.15,
                "icon-allow-overlap": true,
                "icon-ignore-placement": true,
              },
            });
          };

          // Charger l'image du véhicule si elle n'existe pas encore
          if (!mapObj.hasImage("vehicule-icon")) {
            const img = new Image();
            img.onload = () => {
              if (!mapObj.hasImage("vehicule-icon")) {
                mapObj.addImage("vehicule-icon", img);
              }
              addVehiculesLayer();
            };
            img.onerror = (err) => {
              console.error("Erreur chargement image véhicule:", err);
            };
            img.src = "/vehicule.png";
          } else {
            // L'image est déjà chargée, ajouter directement la source et le layer
            addVehiculesLayer();
          }
        }
      }
    },
    []
  );

  // --- Chargement des données ---
  const loadGeometries = useCallback(async () => {
    if (!map || !selectedEventId) {
      setZones([]);
      setParcours([]);
      setEquipements([]);
      return;
    }
    try {
      const [fetchedZones, fetchedParcours, fetchedEquipements] =
        await Promise.all([
          invoke<Zone[]>("fetch_zones_for_event", { eventId: selectedEventId }),
          invoke<Parcours[]>("fetch_parcours_for_event", {
            eventId: selectedEventId,
          }),
          invoke<Equipement[]>("fetch_equipements_for_event", {
            eventId: String(selectedEventId),
          }),
        ]);
      if (mountedRef.current) {
        setZones(fetchedZones);
        setParcours(fetchedParcours);
        setEquipements(fetchedEquipements);
        refreshGeometriesOnMap(
          map,
          fetchedZones,
          fetchedParcours,
          fetchedEquipements,
          timelineFilterDateRef.current,
          equipementTypeFilterRef.current,
          visibilityFiltersRef.current
        );
      }
    } catch (err) {
      console.error("Erreur chargement données:", err);
    }
  }, [map, selectedEventId, refreshGeometriesOnMap]);

  // ✅ CHARGE les géométries au démarrage ou quand l'événement change
  useEffect(() => {
    if (!map || !selectedEventId) return;

    const doLoad = () => {
      loadGeometries();
    };

    // Si le style est déjà chargé, charger immédiatement
    if (map.isStyleLoaded()) {
      const timeoutId = setTimeout(doLoad, 0);
      return () => clearTimeout(timeoutId);
    } else {
      // Sinon, attendre que le style soit chargé
      map.once("load", doLoad);
      return () => {
        map.off("load", doLoad);
      };
    }
  }, [map, selectedEventId, loadGeometries]);

  // ✅ Rafraîchir l'affichage quand le filtre temporel ou le filtre de type change
  useEffect(() => {
    if (!map) return;

    // Redessiner les géométries avec les nouveaux filtres
    refreshGeometriesOnMap(map, zones, parcours, equipements, timelineFilterDate, equipementTypeFilter, visibilityFilters);
  }, [map, timelineFilterDate, equipementTypeFilter, visibilityFilters, zones, parcours, equipements, refreshGeometriesOnMap]);

  // --- Initialisation Draw & Listeners ---
  useEffect(() => {
    if (!map) return;
    if (drawRef.current) return;

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      defaultMode: "simple_select",
      styles: [
        {
          id: "gl-draw-polygon-fill",
          type: "fill",
          filter: ["all", ["==", "$type", "Polygon"], ["!=", "mode", "static"]],
          paint: { "fill-color": "#6366f1", "fill-opacity": 0.3 },
        },
        {
          id: "gl-draw-line",
          type: "line",
          filter: [
            "all",
            ["==", "$type", "LineString"],
            ["!=", "mode", "static"],
          ],
          paint: { "line-color": "#ef4444", "line-width": 4 },
        },
        {
          id: "gl-draw-point-active",
          type: "circle",
          filter: ["all", ["==", "$type", "Point"], ["!=", "mode", "static"]],
          paint: {
            "circle-radius": 6,
            "circle-color": "#fff",
            "circle-stroke-color": "#4f46e5",
            "circle-stroke-width": 2,
          },
        },
      ],
    });

    map.addControl(draw as unknown as maplibregl.IControl, "top-right");
    drawRef.current = draw;

    // EVENT: CRÉATION

    map.on("draw.create", async (e: MapboxDraw.DrawCreateEvent) => {
      const feature = e.features[0];
      if (!feature) return;

      const currentEventId = selectedEventIdRef.current;
      const currentDrawingMode = drawingModeRef.current;
      if (!currentEventId) return;

      try {
        const wkt = geoJSONtoWKT(feature.geometry);
        const geomType = feature.geometry.type;

        if (geomType === "Polygon") {
          // Pour les zones, on stocke la géométrie et on attend le formulaire
          setPendingZoneGeometry(wkt);
          draw.deleteAll();
          draw.changeMode("simple_select");
        } else if (geomType === "LineString") {
          // Différencier entre parcours et équipement selon le mode de dessin
          if (currentDrawingMode === "equipment") {
            // Pour les équipements, on extrait les coordonnées et calcule la longueur
            const coordinates = feature.geometry.coordinates as [
              number,
              number
            ][];
            const lineLength = calculateLineLength(coordinates);
            setPendingEquipmentData({ coordinates, lineLength });
            draw.deleteAll();
            draw.changeMode("simple_select");
          } else {
            // Pour les parcours, on stocke la géométrie et on attend le formulaire
            setPendingParcoursGeometry(wkt);
            draw.deleteAll();
            draw.changeMode("simple_select");
          }
        } else if (geomType === "Point") {
          // Pour les points d'intérêt, on stocke la géométrie et on attend le formulaire
          setPendingInterestGeometry(wkt);
          draw.deleteAll();
          draw.changeMode("simple_select");
          setDrawingMode("none");
        }
      } catch (err) {
        console.error("Erreur save:", err);
        draw.changeMode("simple_select");
      }
    });
  }, [map, loadGeometries]);

  // --- ACTIONS ---

  const startDrawPolygon = () => {
    if (!drawRef.current || !selectedEventId)
      return alert("⚠️ Sélectionnez un événement.");
    setDrawingMode("zone");
    drawRef.current.changeMode("draw_polygon");
  };

  const startDrawLine = () => {
    if (!drawRef.current || !selectedEventId)
      return alert("⚠️ Sélectionnez un événement.");
    setDrawingMode("parcours");
    drawRef.current.changeMode("draw_line_string");
  };

  const startDrawInterest = () => {
    if (!drawRef.current || !selectedEventId) return alert("⚠️ Sélectionnez un événement.");
    setDrawingMode("interest");
    drawRef.current.changeMode("draw_point");
  };

  const cancelDrawing = () => {
    if (!drawRef.current) return;
    setDrawingMode("none");
    drawRef.current.changeMode("simple_select");
    drawRef.current.deleteAll();
  };

  const startDrawEquipment = () => {
    if (!drawRef.current || !selectedEventId)
      return alert("⚠️ Sélectionnez un événement.");
    setDrawingMode("equipment");
    drawRef.current.changeMode("draw_line_string");
  };

  // --- HIGHLIGHT ---
  const highlightGeometry = (item: GeometryItem | null) => {
    if (!map) return;

    // Nettoyage du popup existant
    if (popupRef.current) {
      popupRef.current.remove();
      popupRef.current = null;
    }

    // Nettoyage
    if (map.getLayer("highlight-geometry-fill"))
      map.removeLayer("highlight-geometry-fill");
    if (map.getLayer("highlight-geometry-line"))
      map.removeLayer("highlight-geometry-line");
    if (map.getSource("highlight-geometry"))
      map.removeSource("highlight-geometry");

    if (!item) {
      setSelectedGeometry(null);
      return;
    }

    // Mise à jour state : ID + Type
    setSelectedGeometry({ id: item.id, type: item.type });

    const geometry = parseWKTtoGeoJSON(item.geometry_json);
    if (!geometry) return;

    map.addSource("highlight-geometry", {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [{ type: "Feature", geometry, properties: {} }],
      },
    });

    if (geometry.type === "Polygon") {
      map.addLayer({
        id: "highlight-geometry-fill",
        type: "fill",
        source: "highlight-geometry",
        paint: { "fill-color": "#fbbf24", "fill-opacity": 0.5 },
      });
    }

    map.addLayer({
      id: "highlight-geometry-line",
      type: "line",
      source: "highlight-geometry",
      paint: {
        "line-color": "#f59e0b",
        "line-width": 5,
        "line-dasharray": [2, 2],
      },
    });

    // Calculer le centre de la géométrie pour placer le popup
    let centerCoords: [number, number] = [0, 0];

    if (geometry.type === "Polygon" && geometry.coordinates && geometry.coordinates[0]) {
      const coords = geometry.coordinates[0] as [number, number][];
      const sumLng = coords.reduce((acc, c) => acc + c[0], 0);
      const sumLat = coords.reduce((acc, c) => acc + c[1], 0);
      centerCoords = [sumLng / coords.length, sumLat / coords.length];
    } else if (geometry.type === "LineString" && geometry.coordinates) {
      const coords = geometry.coordinates as [number, number][];
      const midIndex = Math.floor(coords.length / 2);
      centerCoords = coords[midIndex] || coords[0];
    } else if (geometry.type === "Point" && geometry.coordinates) {
      centerCoords = geometry.coordinates as [number, number];
    }

    // Créer le contenu du popup avec boutons d'action
    const name = item.name || `${item.type === "zone" ? "Zone" : "Parcours"} #${item.id.slice(0, 8)}`;
    const description = item.description || "Aucune description";
    const itemId = item.id;
    const itemType = item.type;
    const itemColor = item.color || (item.type === "zone" ? "#6366f1" : "#16a34a");

    const popupContent = `
      <div style="min-width: 240px; font-family: system-ui, -apple-system, sans-serif; padding: 4px;">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
          <div style="width: 40px; height: 40px; background: ${item.type === "zone" ? "#dbeafe" : "#dcfce7"}; border-radius: 10px; display: flex; align-items: center; justify-content: center;">
            <span style="font-size: 18px; color: ${itemColor};">${item.type === "zone" ? "◼" : "━"}</span>
          </div>
          <div style="flex: 1;">
            <div style="font-weight: 700; font-size: 15px; color: #1e293b; line-height: 1.2;">${name}</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 2px;">${item.type === "zone" ? "Zone" : "Parcours"}</div>
          </div>
        </div>
        <div style="background: #f8fafc; border-radius: 8px; padding: 10px; margin-bottom: 14px;">
          <div style="font-size: 12px; color: #475569; line-height: 1.5;">
            ${description}
          </div>
        </div>
        <div style="background: #f8fafc; border-radius: 8px; padding: 10px; margin-bottom: 14px; display: flex; align-items: center; gap: 10px;">
          <label style="font-size: 12px; color: #475569; font-weight: 600;">Couleur :</label>
          <input 
            type="color" 
            id="geo-color-picker"
            data-id="${itemId}"
            data-type="${itemType}"
            value="${itemColor}"
            style="width: 32px; height: 32px; border: 2px solid #e2e8f0; border-radius: 6px; cursor: pointer; padding: 0;"
          />
          <span id="geo-color-value" style="font-size: 12px; color: #64748b; font-family: monospace;">${itemColor}</span>
        </div>
        <div style="display: flex; gap: 8px;">
          <button 
            id="geo-edit-btn" 
            data-id="${itemId}" 
            data-type="${itemType}"
            style="flex: 1; padding: 10px 14px; background: #2563eb; color: white; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; transition: background 0.2s;"
            onmouseover="this.style.background='#1d4ed8'"
            onmouseout="this.style.background='#2563eb'"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Modifier tracé
          </button>
          <button 
            id="geo-delete-btn" 
            data-id="${itemId}" 
            data-type="${itemType}"
            style="flex: 1; padding: 10px 14px; background: #ef4444; color: white; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; transition: background 0.2s;"
            onmouseover="this.style.background='#dc2626'"
            onmouseout="this.style.background='#ef4444'"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            Supprimer
          </button>
        </div>
      </div>
    `;

    // Créer et afficher le popup
    popupRef.current = new maplibregl.Popup({
      closeButton: true,
      closeOnClick: false,
      maxWidth: "320px",
    })
      .setLngLat(centerCoords)
      .setHTML(popupContent)
      .addTo(map);

    // Ajouter les event listeners aux boutons après que le popup soit affiché
    setTimeout(() => {
      const editBtn = document.getElementById("geo-edit-btn");
      const deleteBtn = document.getElementById("geo-delete-btn");
      const colorPicker = document.getElementById("geo-color-picker") as HTMLInputElement;
      const colorValue = document.getElementById("geo-color-value");

      if (colorPicker) {
        colorPicker.addEventListener("input", (e) => {
          const newColor = (e.target as HTMLInputElement).value;
          if (colorValue) colorValue.textContent = newColor;
        });
        
        colorPicker.addEventListener("change", async (e) => {
          const newColor = (e.target as HTMLInputElement).value;
          const id = colorPicker.dataset.id;
          const type = colorPicker.dataset.type as "zone" | "parcours";
          
          if (id && type) {
            if (type === "zone") {
              const zone = zones.find(z => z.id === id);
              if (zone) {
                try {
                  await invoke("update_zone", {
                    geometryId: id,
                    geom: zone.geometry_json,
                    name: zone.name || "Zone",
                    color: newColor,
                  });
                  loadGeometries();
                } catch (err) {
                  console.error("Erreur mise à jour couleur zone:", err);
                }
              }
            } else {
              const p = parcours.find(p => p.id === id);
              if (p) {
                try {
                  await invoke("update_parcours", {
                    geometryId: id,
                    geom: p.geometry_json,
                    name: p.name || "Parcours",
                    color: newColor,
                    startTime: p.start_time ? new Date(p.start_time).getTime() : null,
                    speedLow: p.speed_low,
                    speedHigh: p.speed_high,
                  });
                  loadGeometries();
                } catch (err) {
                  console.error("Erreur mise à jour couleur parcours:", err);
                }
              }
            }
          }
        });
      }

      if (editBtn) {
        editBtn.addEventListener("click", () => {
          if (popupRef.current) popupRef.current.remove();
          startEditGeometry(item);
        });
      }

      if (deleteBtn) {
        deleteBtn.addEventListener("click", () => {
          if (popupRef.current) popupRef.current.remove();
          handleDeleteGeometry(itemId, itemType);
        });
      }
    }, 50);

    // Quand le popup est fermé, désélectionner la géométrie
    popupRef.current.on("close", () => {
      setSelectedGeometry(null);
      // Nettoyage highlight
      if (map.getLayer("highlight-geometry-fill"))
        map.removeLayer("highlight-geometry-fill");
      if (map.getLayer("highlight-geometry-line"))
        map.removeLayer("highlight-geometry-line");
      if (map.getSource("highlight-geometry"))
        map.removeSource("highlight-geometry");
    });

    // Centrer la carte sur la géométrie
    map.flyTo({
      center: centerCoords,
      zoom: Math.max(map.getZoom(), 15),
      duration: 500,
    });
  };

  // --- EDIT ---
  const startEditGeometry = (item: GeometryItem) => {
    if (!drawRef.current || !map) return;

    // On sauvegarde l'ID, le type ET la couleur pour savoir quelle fonction appeler au Save
    const itemColor = item.color || (item.type === "zone" ? "#6366f1" : "#16a34a");
    setEditingGeometry({ id: item.id, type: item.type, color: itemColor });
    highlightGeometry(null);

    const geometry = parseWKTtoGeoJSON(item.geometry_json); // Utilisation du bon champ
    if (!geometry) return;

    // Mettre à jour les styles de MapboxDraw avec la couleur de l'élément
    const drawStyles = [
      {
        id: "gl-draw-polygon-fill",
        type: "fill",
        filter: ["all", ["==", "$type", "Polygon"], ["!=", "mode", "static"]],
        paint: { "fill-color": itemColor, "fill-opacity": 0.3 },
      },
      {
        id: "gl-draw-line",
        type: "line",
        filter: [
          "all",
          ["==", "$type", "LineString"],
          ["!=", "mode", "static"],
        ],
        paint: { "line-color": itemColor, "line-width": 4 },
      },
      {
        id: "gl-draw-polygon-stroke",
        type: "line",
        filter: ["all", ["==", "$type", "Polygon"], ["!=", "mode", "static"]],
        paint: { "line-color": itemColor, "line-width": 3 },
      },
      {
        id: "gl-draw-point-active",
        type: "circle",
        filter: ["all", ["==", "$type", "Point"], ["!=", "mode", "static"]],
        paint: {
          "circle-radius": 6,
          "circle-color": "#fff",
          "circle-stroke-color": itemColor,
          "circle-stroke-width": 2,
        },
      },
    ];
    
    // Recréer MapboxDraw avec les nouveaux styles
    map.removeControl(drawRef.current as unknown as maplibregl.IControl);
    const newDraw = new MapboxDraw({
      displayControlsDefault: false,
      defaultMode: "simple_select",
      styles: drawStyles,
    });
    map.addControl(newDraw as unknown as maplibregl.IControl, "top-right");
    drawRef.current = newDraw;

    drawRef.current.deleteAll();
    // On utilise l'ID tel quel (string UUID)
    drawRef.current.add({
      type: "Feature",
      id: item.id,
      geometry,
      properties: {},
    } as GeoJSON.Feature);

    drawRef.current.changeMode("direct_select", { featureId: item.id });

    // Masquer l'originale sur la carte principale
    if (map.getLayer("event-geometries-fill"))
      map.setFilter("event-geometries-fill", ["!=", ["get", "id"], item.id]);
    if (map.getLayer("event-geometries-line"))
      map.setFilter("event-geometries-line", [
        "all",
        [
          "any",
          ["==", ["geometry-type"], "LineString"],
          ["==", ["geometry-type"], "Polygon"],
        ],
        ["!=", ["get", "id"], item.id],
      ]);
  };

  const cancelEditGeometry = () => {
    if (!drawRef.current || !map) return;
    drawRef.current.deleteAll();
    drawRef.current.changeMode("simple_select");
    setEditingGeometry(null);

    // Restaurer les styles par défaut de MapboxDraw
    map.removeControl(drawRef.current as unknown as maplibregl.IControl);
    const defaultDraw = new MapboxDraw({
      displayControlsDefault: false,
      defaultMode: "simple_select",
      styles: [
        {
          id: "gl-draw-polygon-fill",
          type: "fill",
          filter: ["all", ["==", "$type", "Polygon"], ["!=", "mode", "static"]],
          paint: { "fill-color": "#6366f1", "fill-opacity": 0.3 },
        },
        {
          id: "gl-draw-line",
          type: "line",
          filter: [
            "all",
            ["==", "$type", "LineString"],
            ["!=", "mode", "static"],
          ],
          paint: { "line-color": "#16a34a", "line-width": 4 },
        },
        {
          id: "gl-draw-point-active",
          type: "circle",
          filter: ["all", ["==", "$type", "Point"], ["!=", "mode", "static"]],
          paint: {
            "circle-radius": 6,
            "circle-color": "#fff",
            "circle-stroke-color": "#4f46e5",
            "circle-stroke-width": 2,
          },
        },
      ],
    });
    map.addControl(defaultDraw as unknown as maplibregl.IControl, "top-right");
    drawRef.current = defaultDraw;

    // Restaurer filtres
    if (map.getLayer("event-geometries-fill"))
      map.setFilter("event-geometries-fill", [
        "==",
        ["geometry-type"],
        "Polygon",
      ]);
    if (map.getLayer("event-geometries-line"))
      map.setFilter("event-geometries-line", [
        "any",
        ["==", ["geometry-type"], "LineString"],
        ["==", ["geometry-type"], "Polygon"],
      ]);
  };

  const saveEditGeometry = async () => {
    if (!drawRef.current || !editingGeometry) return;
    const features = drawRef.current.getAll();
    if (features.features.length === 0) return;

    try {
      const wkt = geoJSONtoWKT(
        features.features[0].geometry as GeoJSON.Geometry
      );

      // On redirige vers la bonne commande Rust selon le type
      if (editingGeometry.type === "zone") {
        // Récupérer la zone existante pour conserver ses propriétés
        const existingZone = zones.find(z => z.id === editingGeometry.id);
        await invoke("update_zone", {
          geometryId: editingGeometry.id,
          geom: wkt,
          name: existingZone?.name || "Zone",
          color: existingZone?.color || "#6366f1",
        });
      } else {
        // Récupérer le parcours existant pour conserver ses propriétés
        const existingParcours = parcours.find(p => p.id === editingGeometry.id);
        await invoke("update_parcours", {
          geometryId: editingGeometry.id,
          geom: wkt,
          name: existingParcours?.name || "Parcours",
          color: existingParcours?.color || "#16a34a",
          startTime: existingParcours?.start_time ? new Date(existingParcours.start_time).getTime() : null,
          speedLow: existingParcours?.speed_low ?? null,
          speedHigh: existingParcours?.speed_high ?? null,
        });
      }

      console.log("✅ Géométrie mise à jour");
      loadGeometries();
      cancelEditGeometry();
    } catch (err) {
      console.error("Erreur update:", err);
      alert("Erreur lors de la mise à jour");
    }
  };

  // --- DELETE ---
  // Correction de la signature : on prend l'ID et le TYPE
  const handleDeleteGeometry = async (
    id: string,
    type: "zone" | "parcours"
  ) => {
    if (!confirm("Supprimer cette géométrie ?")) return;
    try {
      if (type === "zone") {
        await invoke("delete_zone", { geometryId: id });
      } else {
        await invoke("delete_parcours", { geometryId: id });
      }

      if (selectedGeometry?.id === id) highlightGeometry(null);
      loadGeometries();
    } catch (err) {
      console.error(err);
    }
  };
  const saveInterestWithDetails = async (data: {
    description: string;
  }) => {
    if (!pendingInterestGeometry || !selectedEventId) return;
    try {
      // Extraire les coordonnées du WKT Point (format: "POINT(x y)")
      const match = pendingInterestGeometry.match(/POINT\(([^ ]+)\s+([^ ]+)\)/);
      if (!match) {
        alert("Erreur: coordonnées invalides");
        return;
      }
      const x = parseFloat(match[1]);
      const y = parseFloat(match[2]);

      await invoke("create_interest_point", {
        eventId: String(selectedEventId),
        x,
        y,
        description: data.description,
      });
      setPendingInterestGeometry(null);
      setDrawingMode("none");
      // ✅ Appeler refreshInterest au lieu de loadGeometries
    } catch (err) {
      console.error("Erreur création point d'intérêt:", err);
      alert("Erreur lors de la création du point d'intérêt");
    }

  }

  // Fonction pour sauvegarder le parcours avec les détails du formulaire
  const saveParcoursWithDetails = async (data: {
    name: string;
    color: string;
    start_time: string;
    speed_low: number;
    speed_high: number;
  }) => {
    if (!pendingParcoursGeometry || !selectedEventId) return;

    try {
      // Convertir la date/heure en timestamp (millisecondes)
      const timestamp = data.start_time
        ? new Date(data.start_time).getTime()
        : null;

      await invoke("create_parcours", {
        eventId: String(selectedEventId),
        geom: pendingParcoursGeometry,
        name: data.name,
        color: data.color,
        startTime: timestamp,
        speedLow: data.speed_low,
        speedHigh: data.speed_high,
      });

      setPendingParcoursGeometry(null);
      setDrawingMode("none");
      loadGeometries();
    } catch (err) {
      console.error("Erreur création parcours:", err);
      alert("Erreur lors de la création du parcours");
    }
  };

  const cancelParcoursForm = () => {
    setPendingParcoursGeometry(null);
    setDrawingMode("none");
  };
  const cancelInterestForm = () => {
    setPendingInterestGeometry(null);
    setDrawingMode("none");
  };

  // Fonction pour sauvegarder la zone avec les détails du formulaire
  const saveZoneWithDetails = async (data: {
    name: string;
    color: string;
    description: string;
  }) => {
    if (!pendingZoneGeometry || !selectedEventId) return;

    try {
      await invoke("create_zone", {
        eventId: String(selectedEventId),
        geom: pendingZoneGeometry,
        name: data.name,
        color: data.color,
        description: data.description || null,
      });

      setPendingZoneGeometry(null);
      setDrawingMode("none");
      loadGeometries();
    } catch (err) {
      console.error("Erreur création zone:", err);
      alert("Erreur lors de la création de la zone");
    }
  };

  const cancelZoneForm = () => {
    setPendingZoneGeometry(null);
    setDrawingMode("none");
  };

  // Fonction pour sauvegarder l'équipement avec les détails du formulaire
  const saveEquipmentWithDetails = async (data: {
    type_id: string;
    length_per_unit: number;
    quantity: number;
    description: string;
    date_pose: string;
    date_depose: string;
  }) => {
    if (!pendingEquipmentData || !selectedEventId) return;

    try {
      await invoke("create_equipement", {
        eventId: String(selectedEventId),
        typeId: data.type_id,
        quantity: data.quantity,
        lengthPerUnit: data.length_per_unit,
        description: data.description || null,
        datePose: data.date_pose,
        dateDepose: data.date_depose,
        coordinates: pendingEquipmentData.coordinates.map(([x, y]) => [x, y]),
      });

      setPendingEquipmentData(null);
      setDrawingMode("none");
      loadGeometries();
    } catch (err) {
      console.error("Erreur création équipement:", err);
      alert("Erreur lors de la création de l'équipement");
    }
  };

  const cancelEquipmentForm = () => {
    setPendingEquipmentData(null);
    setDrawingMode("none");
  };

  // Supprimer un équipement
  const handleDeleteEquipement = async (id: string) => {
    if (!confirm("Supprimer cet équipement ?")) return;
    try {
      await invoke("delete_equipement", { equipementId: id });
      loadGeometries();
    } catch (err) {
      console.error("Erreur suppression équipement:", err);
    }
  };

  // Modifier la couleur d'une zone
  const updateZoneColor = async (zoneId: string, newColor: string) => {
    try {
      const zone = zones.find(z => z.id === zoneId);
      if (!zone) return;
      
      await invoke("update_zone", {
        geometryId: zoneId,
        geom: zone.geometry_json,
        name: zone.name || "Zone",
        color: newColor,
      });
      loadGeometries();
    } catch (err) {
      console.error("Erreur mise à jour couleur zone:", err);
    }
  };

  // Modifier la couleur d'un parcours
  const updateParcoursColor = async (parcoursId: string, newColor: string) => {
    try {
      const p = parcours.find(p => p.id === parcoursId);
      if (!p) return;
      
      await invoke("update_parcours", {
        geometryId: parcoursId,
        geom: p.geometry_json,
        name: p.name || "Parcours",
        color: newColor,
        startTime: p.start_time ? new Date(p.start_time).getTime() : null,
        speedLow: p.speed_low,
        speedHigh: p.speed_high,
      });
      loadGeometries();
    } catch (err) {
      console.error("Erreur mise à jour couleur parcours:", err);
    }
  };

  return {
    zones,
    parcours,
    equipements,
    drawingMode,
    selectedGeometry, // Renvoie l'objet {id, type}
    editingGeometry, // Renvoie l'objet {id, type}
    isGeometryListOpen,
    setIsGeometryListOpen,
    startDrawPolygon,
    startDrawLine,
    startDrawInterest,
    startDrawEquipment,
    cancelDrawing,
    saveEditGeometry,
    handleDeleteGeometry,
    startEditGeometry,
    cancelEditGeometry,
    highlightGeometry,
    pendingParcoursGeometry,
    pendingInterestGeometry,
    pendingZoneGeometry,
    saveParcoursWithDetails,
    saveInterestWithDetails,
    saveZoneWithDetails,
    cancelInterestForm,
    cancelParcoursForm,
    cancelZoneForm,
    // Équipements
    pendingEquipmentData,
    saveEquipmentWithDetails,
    cancelEquipmentForm,
    handleDeleteEquipement,
    // Modification couleurs
    updateZoneColor,
    updateParcoursColor,
  };

}
