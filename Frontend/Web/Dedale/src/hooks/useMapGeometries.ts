import { useState, useRef, useEffect, useCallback } from "react";
import maplibregl from "maplibre-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import { invoke } from "@tauri-apps/api/core";
import { geoJSONtoWKT, parseWKTtoGeoJSON } from "../utils/maputils";
import { Zone, Parcours, Equipement } from "../types/map";

// Type utilitaire pour manipuler indifféremment une Zone ou un Parcours dans l'UI
export type GeometryItem = (Zone | Parcours) & { type: "zone" | "parcours" };

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
  selectedEventId: number | null // Si vos Event IDs sont aussi des strings, changez ici en string | null
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
  } | null>(null);

  const [isGeometryListOpen, setIsGeometryListOpen] = useState(false);

  // --- REFS ---
  const drawRef = useRef<MapboxDraw | null>(null);
  const selectedEventIdRef = useRef<number | null>(selectedEventId);
  const mountedRef = useRef(true);
  const drawingModeRef = useRef<"none" | "zone" | "parcours" | "interest" | "equipment">(
    "none"
  );

  useEffect(() => {
    selectedEventIdRef.current = selectedEventId;
  }, [selectedEventId]);

  useEffect(() => {
    drawingModeRef.current = drawingMode;
  }, [drawingMode]);

  // --- FONCTION : Rafraîchir l'affichage sur la carte ---
  const refreshGeometriesOnMap = useCallback(
    (
      mapObj: maplibregl.Map,
      currentZones: Zone[],
      currentParcours: Parcours[],
      currentEquipements: Equipement[] = []
    ) => {
      // Nettoyage
      const layersToRemove = [
        "event-geometries-fill",
        "event-geometries-line",
        "event-geometries-point",
        "event-equipements-line",
      ];
      layersToRemove.forEach((layer) => {
        if (mapObj.getLayer(layer)) mapObj.removeLayer(layer);
      });
      if (mapObj.getSource("event-geometries"))
        mapObj.removeSource("event-geometries");
      if (mapObj.getSource("event-equipements"))
        mapObj.removeSource("event-equipements");

      if (
        currentZones.length === 0 &&
        currentParcours.length === 0 &&
        currentEquipements.length === 0
      )
        return;

      // Conversion Zones -> GeoJSON
      const zoneFeatures = currentZones
        .map((z) => {
          const geometry = parseWKTtoGeoJSON(z.geometry_json);
          if (!geometry) return null;
          return {
            type: "Feature",
            geometry,
            properties: { id: z.id, type: "zone", event_id: z.event_id },
          } as GeoJSON.Feature;
        })
        .filter((f): f is GeoJSON.Feature => f !== null);

      // Conversion Parcours -> GeoJSON
      const parcoursFeatures = currentParcours
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
          paint: { "fill-color": "#6366f1", "fill-opacity": 0.3 },
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
          "line-color": [
            "case",
            ["==", ["get", "type"], "parcours"],
            "#ef4444", // Rouge Parcours
            "#4f46e5", // Bleu Zones
          ],
          "line-width": 3,
        },
      });
    }

      // Affichage des équipements
      if (currentEquipements.length > 0) {
        const equipementFeatures = currentEquipements
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
              "line-color": "#f97316", // Orange pour les équipements
              "line-width": 4,
              "line-dasharray": [3, 2],
            },
          });
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
          fetchedEquipements
        );
      }
    } catch (err) {
      console.error("Erreur chargement données:", err);
    }
  }, [map, selectedEventId, refreshGeometriesOnMap]);

  // ✅ CHARGE les géométries au démarrage ou quand l'événement change
  useEffect(() => {
    if (!map || !selectedEventId) return;
    loadGeometries();
  }, [map, selectedEventId]);

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
    map.on("draw.create", async (e: any) => {
      const feature = e.features[0];
      if (!feature) return;

      const currentEventId = selectedEventIdRef.current;
      const currentDrawingMode = drawingModeRef.current;
      if (!currentEventId) return;

      try {
        const wkt = geoJSONtoWKT(feature.geometry);
        const geomType = feature.geometry.type;

        if (geomType === "Polygon") {
          await invoke("create_zone", {
            eventId: String(currentEventId),
            geom: wkt,
            name: "Nouvelle Zone",
            color: "#6366f1",
          });
          draw.deleteAll();
          draw.changeMode("simple_select");
          await loadGeometries();
          setDrawingMode("none");
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
  };

  // --- EDIT ---
  const startEditGeometry = (item: GeometryItem) => {
    if (!drawRef.current || !map) return;

    // On sauvegarde l'ID ET le type pour savoir quelle fonction appeler au Save
    setEditingGeometry({ id: item.id, type: item.type });
    highlightGeometry(null);

    const geometry = parseWKTtoGeoJSON(item.geometry_json); // Utilisation du bon champ
    if (!geometry) return;

    drawRef.current.deleteAll();
    // On utilise l'ID tel quel (string UUID)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    drawRef.current.add({
      type: "Feature",
      id: item.id,
      geometry,
      properties: {},
    } as any);

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
        await invoke("update_zone", {
          geometry_id: editingGeometry.id,
          geom: wkt,
          name: "Zone",
          color: "#6366f1",
        });
      } else {
        await invoke("update_parcours", {
          geometry_id: editingGeometry.id,
          geom: wkt,
          name: "Parcours",
          color: "#ef4444",
          start_time: null,
          speed_low: null,
          speed_high: null,
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

  // Fonction pour sauvegarder l'équipement avec les détails du formulaire
  const saveEquipmentWithDetails = async (data: {
    type_id: string;
    length_per_unit: number;
    quantity: number;
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
    saveParcoursWithDetails,
    saveInterestWithDetails,
    cancelInterestForm,
    cancelParcoursForm,
    // Équipements
    pendingEquipmentData,
    saveEquipmentWithDetails,
    cancelEquipmentForm,
    handleDeleteEquipement,
  };

  // Cleanup du mounted ref au unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);
}
