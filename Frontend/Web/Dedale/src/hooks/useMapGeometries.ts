import { useState, useRef, useEffect, useCallback } from "react";
import maplibregl from "maplibre-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import { invoke } from "@tauri-apps/api/core";
import { geoJSONtoWKT, parseWKTtoGeoJSON } from "../utils/maputils";
import { Zone, Parcours } from "../types/map";

// Type utilitaire pour manipuler indifféremment une Zone ou un Parcours dans l'UI
export type GeometryItem = (Zone | Parcours) & { type: "zone" | "parcours" };

export function useMapGeometries(
  map: maplibregl.Map | null,
  selectedEventId: number | null // Si vos Event IDs sont aussi des strings, changez ici en string | null
) {
  // --- ÉTATS ---
  const [zones, setZones] = useState<Zone[]>([]);
  const [parcours, setParcours] = useState<Parcours[]>([]);
  const [drawingMode, setDrawingMode] = useState<"none" | "zone" | "parcours">("none");
  const [pendingParcoursGeometry, setPendingParcoursGeometry] = useState<string | null>(null);
  
  // Changement : On stocke l'ID (string) ET le type pour savoir ce qu'on manipule
  const [selectedGeometry, setSelectedGeometry] = useState<{ id: string; type: "zone" | "parcours" } | null>(null);
  const [editingGeometry, setEditingGeometry] = useState<{ id: string; type: "zone" | "parcours" } | null>(null);
  
  const [isGeometryListOpen, setIsGeometryListOpen] = useState(false);

  // --- REFS ---
  const drawRef = useRef<MapboxDraw | null>(null);
  const selectedEventIdRef = useRef<number | null>(selectedEventId);

  useEffect(() => {
    selectedEventIdRef.current = selectedEventId;
  }, [selectedEventId]);

  // --- FONCTION : Rafraîchir l'affichage sur la carte ---
  const refreshGeometriesOnMap = useCallback(
    (mapObj: maplibregl.Map, currentZones: Zone[], currentParcours: Parcours[]) => {
      // Nettoyage
      const layersToRemove = ["event-geometries-fill", "event-geometries-line", "event-geometries-point"];
      layersToRemove.forEach((layer) => {
        if (mapObj.getLayer(layer)) mapObj.removeLayer(layer);
      });
      if (mapObj.getSource("event-geometries")) mapObj.removeSource("event-geometries");

      if (currentZones.length === 0 && currentParcours.length === 0) return;

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
            properties: { id: p.id, type: "parcours", event_id: p.event_id },
          } as GeoJSON.Feature;
        })
        .filter((f): f is GeoJSON.Feature => f !== null);

      const allFeatures = [...zoneFeatures, ...parcoursFeatures];
      if (allFeatures.length === 0) return;

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
        paint: { "fill-color":"#6366f1", "fill-opacity": 0.3 },
      });

      mapObj.addLayer({
        id: "event-geometries-line",
        type: "line",
        source: "event-geometries",
        filter: ["any", ["==", ["geometry-type"], "LineString"], ["==", ["geometry-type"], "Polygon"]],
        paint: {
          "line-color": [
            "case",
            ["==", ["get", "type"], "parcours"], "#ef4444", // Rouge Parcours
            "#4f46e5" // Bleu Zones
          ],
          "line-width": 3
        },
      });
    },
    [],
  );

  // --- Chargement des données ---
  const loadGeometries = useCallback(async () => {
    if (!map || !selectedEventId) {
      setZones([]);
      setParcours([]);
      return;
    }
    try {
      const [fetchedZones, fetchedParcours] = await Promise.all([
        invoke<Zone[]>("fetch_zones_for_event", { eventId: selectedEventId }),
        invoke<Parcours[]>("fetch_parcours_for_event", { eventId: selectedEventId }),
      ]);
      setZones(fetchedZones);
      setParcours(fetchedParcours);
      refreshGeometriesOnMap(map, fetchedZones, fetchedParcours);
    } catch (err) {
      console.error("Erreur chargement données:", err);
    }
  }, [map, selectedEventId, refreshGeometriesOnMap]);

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
          paint: { "line-color": "#22c55e", "line-width": 4 },
        },
        {
            id: "gl-draw-point-active",
            type: "circle",
            filter: ["all", ["==", "$type", "Point"], ["!=", "mode", "static"]],
            paint: { "circle-radius": 6, "circle-color": "#fff", "circle-stroke-color": "#4f46e5", "circle-stroke-width": 2 },
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
      if (!currentEventId) return;

      try {
        const wkt = geoJSONtoWKT(feature.geometry);
        const geomType = feature.geometry.type;

        if (geomType === "Polygon") {
          await invoke("create_zone", { eventId: String(currentEventId), geom: wkt, name: "Nouvelle Zone", color: "#6366f1" });
          draw.deleteAll();
          draw.changeMode("simple_select");
          await loadGeometries();
          setDrawingMode("none");
        } else if (geomType === "LineString") {
          // Pour les parcours, on stocke la géométrie et on attend le formulaire
          setPendingParcoursGeometry(wkt);
          draw.deleteAll();
          draw.changeMode("simple_select");
        }
      } catch (err) {
        console.error("Erreur save:", err);
        draw.changeMode("simple_select");
      }
    });
  }, [map, loadGeometries]);

  // --- ACTIONS ---

  const startDrawPolygon = () => {
    if (!drawRef.current || !selectedEventId) return alert("⚠️ Sélectionnez un événement.");
    setDrawingMode("zone");
    drawRef.current.changeMode("draw_polygon");
  };

  const startDrawLine = () => {
    if (!drawRef.current || !selectedEventId) return alert("⚠️ Sélectionnez un événement.");
    setDrawingMode("parcours");
    drawRef.current.changeMode("draw_line_string");
  };

  const cancelDrawing = () => {
    if (!drawRef.current) return;
    setDrawingMode("none");
    drawRef.current.changeMode("simple_select");
    drawRef.current.deleteAll();
  };

  // --- HIGHLIGHT ---
  const highlightGeometry = (item: GeometryItem | null) => {
    if (!map) return;

    // Nettoyage
    if (map.getLayer("highlight-geometry-fill")) map.removeLayer("highlight-geometry-fill");
    if (map.getLayer("highlight-geometry-line")) map.removeLayer("highlight-geometry-line");
    if (map.getSource("highlight-geometry")) map.removeSource("highlight-geometry");

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
    drawRef.current.add({ type: "Feature", id: item.id, geometry, properties: {} } as any);
    
    drawRef.current.changeMode("direct_select", { featureId: item.id });

    // Masquer l'originale sur la carte principale
    if (map.getLayer("event-geometries-fill")) map.setFilter("event-geometries-fill", ["!=", ["get", "id"], item.id]);
    if (map.getLayer("event-geometries-line")) map.setFilter("event-geometries-line", ["all", 
        ["any", ["==", ["geometry-type"], "LineString"], ["==", ["geometry-type"], "Polygon"]], 
        ["!=", ["get", "id"], item.id]
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
      const wkt = geoJSONtoWKT(features.features[0].geometry as GeoJSON.Geometry);
      
      // On redirige vers la bonne commande Rust selon le type
      if (editingGeometry.type === "zone") {
        await invoke("update_zone", { geometry_id: editingGeometry.id, geom: wkt, name: "Zone", color: "#6366f1" });
      } else {
        await invoke("update_parcours", { geometry_id: editingGeometry.id, geom: wkt, name: "Parcours", color: "#ef4444", start_time: null, speed_low: null, speed_high: null });
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
  const handleDeleteGeometry = async (id: string, type: "zone" | "parcours") => {
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
      const timestamp = data.start_time ? new Date(data.start_time).getTime() : null;

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

  return {
    zones,
    parcours,
    drawingMode,
    selectedGeometry, // Renvoie l'objet {id, type}
    editingGeometry,  // Renvoie l'objet {id, type}
    isGeometryListOpen,
    setIsGeometryListOpen,
    startDrawPolygon,
    startDrawLine,
    cancelDrawing,
    saveEditGeometry,
    handleDeleteGeometry,
    startEditGeometry,
    cancelEditGeometry,
    highlightGeometry,
    pendingParcoursGeometry,
    saveParcoursWithDetails,
    cancelParcoursForm,
  };
}