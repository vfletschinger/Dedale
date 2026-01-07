import { useState, useRef, useEffect, useCallback } from "react";
import maplibregl from "maplibre-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import { invoke } from "@tauri-apps/api/core";
import { geoJSONtoWKT, parseWKTtoGeoJSON } from "../utils/maputils";
import { GeometryData } from "../types/map";
export function useMapGeometries(
  map: maplibregl.Map | null,
  selectedEventId: string | number | null,
) {
  // --- ÉTATS ---
  const [geometries, setGeometries] = useState<GeometryData[]>([]);
  const [drawingMode, setDrawingMode] = useState<"none" | "polygon" | "line">(
    "none",
  );
  const [selectedGeometryId, setSelectedGeometryId] = useState<string | null>(
    null,
  );
  const [selectedGeometry, setSelectedGeometry] = useState<GeometryData | null>(
    null,
  );
  const [editingGeometryId, setEditingGeometryId] = useState<string | null>(
    null,
  );
  const [isGeometryListOpen, setIsGeometryListOpen] = useState(false);

  // --- REFS ---
  const drawRef = useRef<MapboxDraw | null>(null);
  // Ref pour accéder à l'ID dans les event listeners sans déclencher de re-render
  const selectedEventIdRef = useRef<string | number | null>(selectedEventId);
  // Ref pour accéder à loadGeometries dans les event listeners
  const loadGeometriesRef = useRef<() => Promise<void>>(() => Promise.resolve());
  // Ref pour accéder aux géométries dans les event listeners
  const geometriesRef = useRef<GeometryData[]>([]);

  useEffect(() => {
    selectedEventIdRef.current = selectedEventId;
  }, [selectedEventId]);

  useEffect(() => {
    geometriesRef.current = geometries;
  }, [geometries]);

  // --- FONCTION : Rafraîchir l'affichage sur la carte ---
  const refreshGeometriesOnMap = useCallback(
    (mapObj: maplibregl.Map, geoms: GeometryData[]) => {
      // Nettoyage des anciennes couches
      if (mapObj.getLayer("event-geometries-fill"))
        mapObj.removeLayer("event-geometries-fill");
      if (mapObj.getLayer("event-geometries-line"))
        mapObj.removeLayer("event-geometries-line");
      if (mapObj.getLayer("event-geometries-point"))
        mapObj.removeLayer("event-geometries-point");
      if (mapObj.getSource("event-geometries"))
        mapObj.removeSource("event-geometries");

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
        filter: [
          "any",
          ["==", ["geometry-type"], "LineString"],
          ["==", ["geometry-type"], "Polygon"],
        ],
        paint: {
          "line-color": "#4f46e5",
          "line-width": 3,
          "line-opacity": 0.8,
        },
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
    [],
  );

  // --- FONCTION : Charger les géométries depuis la DB ---
  const loadGeometries = useCallback(async () => {
    // On utilise selectedEventId directement ici car loadGeometries est dans les dépendances de l'effet
    if (!map || !selectedEventId) {
      setGeometries([]);
      setSelectedGeometry(null);
      if (map) refreshGeometriesOnMap(map, []);
      return;
    }

    try {
      console.log(
        "📐 Chargement des géométries pour event_id:",
        selectedEventId,
      );
      // Convertir en string si c'est un number
      const eventIdStr = String(selectedEventId);
      const geoms = await invoke<GeometryData[]>("fetch_geometries_for_event", {
        eventId: eventIdStr,
      });
      setGeometries(geoms);
      refreshGeometriesOnMap(map, geoms);
      
      // Mettre à jour selectedGeometry si elle existe avec les nouvelles données
      setSelectedGeometry((current) => {
        if (current) {
          const updated = geoms.find((g) => g.id === current.id);
          return updated || null;
        }
        return null;
      });
    } catch (err) {
      console.error("Erreur chargement géométries:", err);
    }
  }, [map, selectedEventId, refreshGeometriesOnMap]);

  // Mettre à jour la ref après chaque changement de loadGeometries
  useEffect(() => {
    loadGeometriesRef.current = loadGeometries;
  }, [loadGeometries]);

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

    // --- Gestionnaires de clic sur les géométries ---
    
    // Curseur pointer pour les géométries
    map.on("mouseenter", "event-geometries-fill", () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "event-geometries-fill", () => {
      map.getCanvas().style.cursor = "";
    });
    map.on("mouseenter", "event-geometries-line", () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "event-geometries-line", () => {
      map.getCanvas().style.cursor = "";
    });

    // Clic sur un polygone (zone)
    map.on("click", "event-geometries-fill", (e) => {
      const f = e.features?.[0];
      if (!f) return;
      const geomId = f.properties?.id;
      const clicked = geometriesRef.current.find((g) => String(g.id) === String(geomId));
      if (clicked) {
        setSelectedGeometry(clicked);
        setSelectedGeometryId(clicked.id);
      }
      // Empêcher la propagation pour éviter de déclencher d'autres clics
      e.preventDefault();
    });

    // Clic sur une ligne (parcours)
    map.on("click", "event-geometries-line", (e) => {
      const f = e.features?.[0];
      if (!f) return;
      const geomId = f.properties?.id;
      const clicked = geometriesRef.current.find((g) => String(g.id) === String(geomId));
      if (clicked) {
        setSelectedGeometry(clicked);
        setSelectedGeometryId(clicked.id);
      }
      // Empêcher la propagation
      e.preventDefault();
    });

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
        // Convertir en string si c'est un number
        const eventIdStr = String(currentEventId);
        await invoke("create_geometry", { eventId: eventIdStr, geom: wkt });
        console.log("✅ Géométrie sauvegardée");

        draw.delete(feature.id); // On retire du draw pour laisser la couche 'event-geometries' l'afficher
        loadGeometriesRef.current(); // Recharger depuis la DB (utilise la ref pour avoir la dernière version)
      } catch (err) {
        console.error("Erreur sauvegarde géométrie:", err);
        alert("Erreur lors de la sauvegarde");
        draw.delete(feature.id);
      }
    });
  }, [map]); // Retirer loadGeometries des dépendances car on utilise la ref

  // --- EFFET : Recharger les géométries quand l'événement change ---
  useEffect(() => {
    if (!map || !selectedEventId) return;

    const doLoad = () => {
      console.log("🔄 Chargement des géométries...");
      loadGeometries();
    };

    // Vérifier si la map est complètement chargée
    if (map.loaded() && map.isStyleLoaded()) {
      doLoad();
    } else {
      // Attendre que la map soit complètement chargée
      map.once('load', doLoad);
      return () => {
        map.off('load', doLoad);
      };
    }
  }, [selectedEventId, map, loadGeometries]);

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
    if (map.getLayer("highlight-geometry-fill"))
      map.removeLayer("highlight-geometry-fill");
    if (map.getLayer("highlight-geometry-line"))
      map.removeLayer("highlight-geometry-line");
    if (map.getSource("highlight-geometry"))
      map.removeSource("highlight-geometry");

    if (!geom) {
      setSelectedGeometryId(null);
      return;
    }

    setSelectedGeometryId(geom.id);
    const geometry = parseWKTtoGeoJSON(geom.geom);
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

  const startEditGeometry = (geom: GeometryData) => {
    if (!drawRef.current || !map) return;
    setEditingGeometryId(geom.id);
    highlightGeometry(null);

    const geometry = parseWKTtoGeoJSON(geom.geom);
    if (!geometry) return;

    drawRef.current.deleteAll();
    drawRef.current.add({
      type: "Feature",
      id: `edit-${geom.id}`,
      geometry,
      properties: {},
    } as GeoJSON.Feature);
    drawRef.current.changeMode("direct_select", {
      featureId: `edit-${geom.id}`,
    });

    // Masquer l'originale
    if (map.getLayer("event-geometries-fill"))
      map.setFilter("event-geometries-fill", ["!=", ["get", "id"], geom.id]);
    if (map.getLayer("event-geometries-line"))
      map.setFilter("event-geometries-line", [
        "all",
        [
          "any",
          ["==", ["geometry-type"], "LineString"],
          ["==", ["geometry-type"], "Polygon"],
        ],
        ["!=", ["get", "id"], geom.id],
      ]);
  };

  const cancelEditGeometry = () => {
    if (!drawRef.current || !map) return;
    drawRef.current.deleteAll();
    drawRef.current.changeMode("simple_select");
    setEditingGeometryId(null);

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
    if (!drawRef.current || !editingGeometryId) return;
    const features = drawRef.current.getAll();
    if (features.features.length === 0) return;

    try {
      const wkt = geoJSONtoWKT(
        features.features[0].geometry as GeoJSON.Geometry,
      );
      await invoke("update_geometry", {
        geometryId: String(editingGeometryId),
        geom: wkt,
      });
      console.log("✅ Géométrie mise à jour");
      loadGeometries();
      cancelEditGeometry();
    } catch (err) {
      console.error("Erreur update:", err);
    }
  };

  const handleDeleteGeometry = async (geometryId: string) => {
    if (!confirm("Supprimer cette géométrie ?")) return;
    try {
      await invoke("delete_geometry", { geometryId: String(geometryId) });
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
    selectedGeometry,
    setSelectedGeometry,
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
    loadGeometries,
  };
}
