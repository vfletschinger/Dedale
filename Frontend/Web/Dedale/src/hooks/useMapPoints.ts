import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import maplibregl from "maplibre-gl";
import { MapPoint } from "../types/map";

export function useMapPoints(
  map: maplibregl.Map | null,
  selectedEventId: string | number | null
) {
  // --- ÉTATS ---
  const [points, setPoints] = useState<MapPoint[]>([]);
  const pointsRef = useRef<MapPoint[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<MapPoint | null>(null);
  
  // États pour l'ajout de point
  const [addingPointCoords, setAddingPointCoords] = useState<{ lng: number; lat: number } | null>(null);
  const [awaitingMapClick, setAwaitingMapClick] = useState(false);
  const awaitingMapClickRef = useRef(false);

  // --- FONCTIONS UTILITAIRES ---

  const updateMapSource = useCallback((currentPoints: MapPoint[]) => {
    // Sécurité : si la source n'est pas encore créée (style pas chargé), on ne fait rien
    if (!map || !map.getSource("db-points")) return;

    const geojson: GeoJSON.FeatureCollection<GeoJSON.Point> = {
      type: "FeatureCollection",
      features: currentPoints.map((p) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [Number(p.x), Number(p.y)],
        },
        properties: {
          id: p.id,
          obstacles: p.obstacles,
          comments: p.comments,
          pictures: p.pictures,
        },
      })),
    };

    (map.getSource("db-points") as maplibregl.GeoJSONSource).setData(geojson);
  }, [map]);

  const refreshPoints = useCallback(async () => {
    try {
      console.log("🔄 Chargement des points pour event_id:", selectedEventId);
      const freshPoints = await invoke<MapPoint[]>("get_points", {
        eventId: selectedEventId || null,
      });
      
      console.log(`${freshPoints.length} point(s) récupéré(s)`);
      pointsRef.current = freshPoints;
      setPoints(freshPoints);
      updateMapSource(freshPoints);

      // Utiliser une ref pour éviter la boucle infinie
      setSelectedPoint((currentSelected) => {
        if (currentSelected) {
          const updated = freshPoints.find((p) => p.id === currentSelected.id);
          return updated || null;
        }
        return null;
      });
    } catch (err) {
      console.error("Erreur chargement points:", err);
    }
  }, [selectedEventId, updateMapSource]);

  const openPopupForPoint = (point: MapPoint) => {
    if (!map) return;
    map.flyTo({ center: [Number(point.x), Number(point.y)], zoom: 15 });
    setSelectedPoint(point);
  };

  const handleAddPointClick = () => {
    if (!map) {
      alert("Carte non initialisée");
      return;
    }
    setAwaitingMapClick(true);
    awaitingMapClickRef.current = true;
  };

  // --- AJOUTER CE BLOC DANS useMapPoints.ts ---

  const addPoint = async (pointData: { x: number; y: number; obstacles?: string; comments?: string; pictures?: string }) => {
    
    // 1. Sécurité : On ne peut pas sauvegarder sans Event ID
    if (!selectedEventId) {
      console.error("Impossible d'ajouter un point : Aucun événement sélectionné.");
      alert("Erreur : Aucun événement n'est sélectionné.");
      return;
    }

    try {
      console.log("💾 Sauvegarde du point pour l'event :", selectedEventId);

      // 2. Appel au Backend Rust
      // Assurez-vous que les noms des champs correspondent à votre struct Rust
      await invoke("add_point", {
        point: {
          ...pointData,
          event_id: selectedEventId, // <--- C'EST ICI LA CORRECTION CRITIQUE
          // Si votre backend attend des champs optionnels, assurez-vous de les gérer
          obstacles: pointData.obstacles || "",
          comments: pointData.comments || "",
          pictures: pointData.pictures || ""
        }
      });

      // 3. Rafraîchir la carte et fermer le mode ajout
      await refreshPoints();
      setAddingPointCoords(null); // Ferme le formulaire
      
    } catch (e) {
      console.error("❌ Erreur lors de l'ajout du point :", e);
      alert("Erreur lors de la sauvegarde : " + e);
    }
  };

  // --- EFFETS ---

  // 1. Initialisation des sources et layers (LA CORRECTION EST ICI)
  useEffect(() => {
    if (!map) return;

    // Fonction encapsulée pour initialiser les ressources
    const initializeMapResources = () => {
      // Vérification doublon
      if (map.getSource("db-points")) return;

      try {
        // Ajouter la source
        map.addSource("db-points", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
          cluster: true,
          clusterRadius: 50,
        });

        // Ajouter le layer
        map.addLayer({
          id: "db-points-layer",
          type: "circle",
          source: "db-points",
          paint: {
            "circle-radius": 6,
            "circle-color": "#FF5722",
            "circle-stroke-color": "#fff",
            "circle-stroke-width": 1,
          },
        });

        // --- Gestionnaires d'événements liés aux layers ---
        
        // Curseur pointer
        map.on("mouseenter", "db-points-layer", () => (map.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", "db-points-layer", () => (map.getCanvas().style.cursor = ""));

        // Clic sur un point existant
        map.on("click", "db-points-layer", (e) => {
          const f = e.features?.[0];
          if (!f) return;
          const pointId = f.properties?.id;
          const clicked = pointsRef.current.find((p) => String(p.id) === String(pointId));
          if (clicked) setSelectedPoint(clicked);
        });

        // Clic sur la carte (pour ajouter un point)
        map.on("click", (e) => {
          if (!awaitingMapClickRef.current) return;

          // Vérifier qu'on n'a pas cliqué sur un point existant
          const features = map.queryRenderedFeatures(e.point, { layers: ["db-points-layer"] });
          if (features.length > 0) return;

          // Désactiver le mode ajout
          awaitingMapClickRef.current = false;
          setAwaitingMapClick(false);

          // Ouvrir le formulaire
          setSelectedPoint(null);
          setAddingPointCoords({ lng: e.lngLat.lng, lat: e.lngLat.lat });
        });

        // Une fois tout initialisé, on charge les données initiales
        refreshPoints();

      } catch (error) {
        console.error("Erreur lors de l'initialisation des layers map:", error);
      }
    };

    // --- LOGIQUE DE CHARGEMENT DU STYLE ---
    if (map.isStyleLoaded()) {
      initializeMapResources();
    } else {
      map.once('style.load', initializeMapResources);
    }

    // Cleanup : on retire l'écouteur si le composant est démonté avant le chargement
    return () => {
      map.off('style.load', initializeMapResources);
    };

  }, [map, refreshPoints]); // On a retiré refreshPoints des deps ici pour éviter boucle infinie, on l'appelle dans initializeMapResources

  // 2. Gestion du curseur "crosshair" pour l'ajout
  useEffect(() => {
    if (!map) return;
    map.getCanvas().style.cursor = awaitingMapClick ? "crosshair" : "";
    return () => { 
        // Petite sécurité ici aussi
        if(map && map.getCanvas()) map.getCanvas().style.cursor = ""; 
    };
  }, [awaitingMapClick, map]);

  // 3. (J'ai renommé 4 en 3) Écoute des mises à jour temps réel
  useEffect(() => {
    const unlisten = listen<number>("points-updated", (event) => {
      console.log("📥 Points mis à jour via socket, event_id:", event.payload);
      if (!selectedEventId || selectedEventId === event.payload) {
         if (map) refreshPoints();
      }
    });

    return () => {
      unlisten.then((f) => f());
    };
  }, [selectedEventId, map, refreshPoints]);

  // 4. Recharger les points quand l'événement sélectionné change
  useEffect(() => {
    if (map && map.getSource("db-points")) {
      console.log("🔄 Changement d'événement, rechargement des points...");
      refreshPoints();
    }
  }, [selectedEventId, map, refreshPoints]);

  return {
    points,
    selectedPoint,
    setSelectedPoint,
    addingPointCoords,
    setAddingPointCoords,
    awaitingMapClick,
    handleAddPointClick,
    refreshPoints,
    openPopupForPoint,
    addPoint,
  };
}