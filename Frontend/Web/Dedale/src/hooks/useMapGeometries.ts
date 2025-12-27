import { useState, useRef, useEffect, useCallback } from "react";
import maplibregl from "maplibre-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import { invoke } from "@tauri-apps/api/core";
import { geoJSONtoWKT, parseWKTtoGeoJSON } from "../utils/maputils"; // Vérifiez la casse du fichier (mapUtils vs maputils)
import { GeometryData } from "../types/map"; // Vérifiez le chemin

export function useMapGeometries(
  map: maplibregl.Map | null,
  selectedEventId: number | null
) {
  // --- ÉTATS ---
  const [geometries, setGeometries] = useState<GeometryData[]>([]);
  const [drawingMode, setDrawingMode] = useState<"none" | "polygon" | "line">("none");
  const [selectedGeometryId, setSelectedGeometryId] = useState<number | null>(null);
  const [editingGeometryId, setEditingGeometryId] = useState<number | null>(null);
  const [isGeometryListOpen, setIsGeometryListOpen] = useState(false);

  // --- REFS ---
  const drawRef = useRef<MapboxDraw | null>(null);
  // Ref pour accéder à l'ID dans les event listeners sans déclencher de re-render
  const selectedEventIdRef = useRef<number | null>(selectedEventId);

  useEffect(() => {
    selectedEventIdRef.current = selectedEventId;
  }, [selectedEventId]);

  // --- FONCTION : Rafraîchir l'affichage sur la carte ---
  const refreshGeometriesOnMap = useCallback(
    (mapObj: maplibregl.Map, geoms: GeometryData[]) => {
      // Nettoyage des anciennes couches
      if (mapObj.getLayer("event-geometries-fill")) mapObj.removeLayer("event-geometries-fill");
      if (mapObj.getLayer("event-geometries-line")) mapObj.removeLayer("event-geometries-line");
      if (mapObj.getLayer("event-geometries-point")) mapObj.removeLayer("event-geometries-point");
      if (mapObj.getSource("event-geometries")) mapObj.removeSource("event-geometries");

      if (geoms.length === 0) return;

      // Conversion WKT -> GeoJSON
      const features = geoms
        .map((g) => {
          const geometry = parseWKTtoGeoJSON(g.geom);
          if (!geometry) return null;
          return {
            type: "Feature",
            geometry,
            properties: {
              id: g.id,
              event_id: g.event_id,
              geom_type: geometry.type,
            },
          } as GeoJSON.Feature;
        })
        .filter((f): f is GeoJSON.Feature => f !== null);

      if (features.length === 0) return;

      mapObj.addSource("event-geometries", {
        type: "geojson",
        data: { type: "FeatureCollection", features },
      });

      // Style Polygones (Remplissage)
      mapObj.addLayer({
        id: "event-geometries-fill",
        type: "fill",
        source: "event-geometries",
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: { "fill-color": "#6366f1", "fill-opacity": 0.3 },
      });

      // Style Lignes et Contours
      mapObj.addLayer({
        id: "event-geometries-line",
        type: "line",
        source: "event-geometries",
        filter: ["any", ["==", ["geometry-type"], "LineString"], ["==", ["geometry-type"], "Polygon"]],
        paint: { "line-color": "#4f46e5", "line-width": 3, "line-opacity": 0.8 },
      });

      // Style Points
      mapObj.addLayer({
        id: "event-geometries-point",
        type: "circle",
        source: "event-geometries",
        filter: ["==", ["geometry-type"], "Point"],
        paint: {
          "circle-radius": 10,
          "circle-color": "#8b5cf6",
          "circle-stroke-color": "#4f46e5",
          "circle-stroke-width": 3,
          "circle-opacity": 0.8,
        },
      });
    },
    []
  );

  // --- FONCTION : Charger les géométries depuis la DB ---
  const loadGeometries = useCallback(async () => {
    // On utilise selectedEventId directement ici car loadGeometries est dans les dépendances de l'effet
    if (!map || !selectedEventId) {
      setGeometries([]);
      if (map) refreshGeometriesOnMap(map, []);
      return;
    }

    try {
      console.log("📐 Chargement des géométries pour event_id:", selectedEventId);
      const geoms = await invoke<GeometryData[]>("fetch_geometries_for_event", {
        eventId: selectedEventId,
      });
      setGeometries(geoms);
      refreshGeometriesOnMap(map, geoms);
    } catch (err) {
      console.error("Erreur chargement géométries:", err);
    }
  }, [map, selectedEventId, refreshGeometriesOnMap]);

  // --- EFFET : Initialisation de MapboxDraw et Listeners ---
  useEffect(() => {
    if (!map) return;
    if (drawRef.current) return; // Déjà initialisé

    // Initialisation de l'instance Draw
    const draw = new MapboxDraw({
      displayControlsDefault: false,
      defaultMode: "simple_select",
      styles: [
        // Styles par défaut pour le dessin (simplifiés pour la lisibilité)
        {
          id: "gl-draw-polygon-fill",
          type: "fill",
          filter: ["all", ["==", "$type", "Polygon"], ["!=", "mode", "static"]],
          paint: { "fill-color": "#6366f1", "fill-opacity": 0.3 },
        },
        {
          id: "gl-draw-line",
          type: "line",
          filter: ["all", ["==", "$type", "LineString"], ["!=", "mode", "static"]],
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

    // Listener pour la CRÉATION (Sauvegarde)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    map.on("draw.create", async (e: any) => {
      const feature = e.features[0];
      if (!feature) return;

      const currentEventId = selectedEventIdRef.current;
      if (!currentEventId) {
        alert("⚠️ Veuillez sélectionner un événement avant de dessiner.");
        draw.delete(feature.id);
        return;
      }

      try {
        const wkt = geoJSONtoWKT(feature.geometry);
        await invoke("create_geometry", { eventId: currentEventId, geom: wkt });
        console.log("✅ Géométrie sauvegardée");
        
        draw.delete(feature.id); // On retire du draw pour laisser la couche 'event-geometries' l'afficher
        loadGeometries(); // Recharger depuis la DB
      } catch (err) {
        console.error("Erreur sauvegarde géométrie:", err);
        alert("Erreur lors de la sauvegarde");
        draw.delete(feature.id);
      }
    });

  }, [map, loadGeometries]);

  // --- ACTIONS ---

  const startDrawPolygon = () => {
    if (!drawRef.current) return;
    if (!selectedEventId) {
      alert("⚠️ Veuillez sélectionner un événement.");
      return;
    }
    setDrawingMode("polygon");
    drawRef.current.changeMode("draw_polygon");
  };

  const startDrawLine = () => {
    if (!drawRef.current) return;
    if (!selectedEventId) {
      alert("⚠️ Veuillez sélectionner un événement.");
      return;
    }
    setDrawingMode("line");
    drawRef.current.changeMode("draw_line_string");
  };

  const cancelDrawing = () => {
    if (!drawRef.current) return;
    setDrawingMode("none");
    drawRef.current.changeMode("simple_select");
    drawRef.current.deleteAll();
  };

  const highlightGeometry = (geom: GeometryData | null) => {
    if (!map) return;
    // Nettoyage highlight
    if (map.getLayer("highlight-geometry-fill")) map.removeLayer("highlight-geometry-fill");
    if (map.getLayer("highlight-geometry-line")) map.removeLayer("highlight-geometry-line");
    if (map.getSource("highlight-geometry")) map.removeSource("highlight-geometry");

    if (!geom) {
      setSelectedGeometryId(null);
      return;
    }

    setSelectedGeometryId(geom.id);
    const geometry = parseWKTtoGeoJSON(geom.geom);
    if (!geometry) return;

    map.addSource("highlight-geometry", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [{ type: "Feature", geometry, properties: {} }] },
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
      paint: { "line-color": "#f59e0b", "line-width": 5, "line-dasharray": [2, 2] },
    });
    
    // Zoom sur la géométrie (simplifié)
    // ... code de fitBounds si nécessaire ...
  };

  const startEditGeometry = (geom: GeometryData) => {
    if (!drawRef.current || !map) return;
    setEditingGeometryId(geom.id);
    highlightGeometry(null);

    const geometry = parseWKTtoGeoJSON(geom.geom);
    if (!geometry) return;

    drawRef.current.deleteAll();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    drawRef.current.add({ type: "Feature", id: `edit-${geom.id}`, geometry, properties: {} } as any);
    drawRef.current.changeMode("direct_select", { featureId: `edit-${geom.id}` });

    // Masquer l'originale
    if (map.getLayer("event-geometries-fill")) map.setFilter("event-geometries-fill", ["!=", ["get", "id"], geom.id]);
    if (map.getLayer("event-geometries-line")) map.setFilter("event-geometries-line", ["all", ["any", ["==", ["geometry-type"], "LineString"], ["==", ["geometry-type"], "Polygon"]], ["!=", ["get", "id"], geom.id]]);
  };

  const cancelEditGeometry = () => {
    if (!drawRef.current || !map) return;
    drawRef.current.deleteAll();
    drawRef.current.changeMode("simple_select");
    setEditingGeometryId(null);

    // Restaurer filtres
    if (map.getLayer("event-geometries-fill")) map.setFilter("event-geometries-fill", ["==", ["geometry-type"], "Polygon"]);
    if (map.getLayer("event-geometries-line")) map.setFilter("event-geometries-line", ["any", ["==", ["geometry-type"], "LineString"], ["==", ["geometry-type"], "Polygon"]]);
  };

  const saveEditGeometry = async () => {
    if (!drawRef.current || !editingGeometryId) return;
    const features = drawRef.current.getAll();
    if (features.features.length === 0) return;

    try {
      const wkt = geoJSONtoWKT(features.features[0].geometry as GeoJSON.Geometry);
      await invoke("update_geometry", { geometryId: editingGeometryId, geom: wkt });
      console.log("✅ Géométrie mise à jour");
      loadGeometries();
      cancelEditGeometry();
    } catch (err) {
      console.error("Erreur update:", err);
    }
  };

  const handleDeleteGeometry = async (geometryId: number) => {
    if (!confirm("Supprimer cette géométrie ?")) return;
    try {
      await invoke("delete_geometry", { geometryId });
      if (selectedGeometryId === geometryId) highlightGeometry(null);
      loadGeometries();
    } catch (err) {
      console.error(err);
    }
  };

  return {
    geometries,
    drawingMode,
    selectedGeometryId,
    editingGeometryId,
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
  };
}