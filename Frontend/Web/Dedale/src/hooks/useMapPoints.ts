import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import maplibregl from "maplibre-gl";
import { MapInterest, MapPoint } from "../types/map";

export function useMapPoints(
  map: maplibregl.Map | null,
  selectedEventId: string | null,
  showInterests: boolean = true // Filtre de visibilité pour les points d'intérêt
) {
  // --- ÉTATS ---
  const [points, setPoints] = useState<MapPoint[]>([]);
  const pointsRef = useRef<MapPoint[]>([]);
  const [interests, setInterests] = useState<MapInterest[]>([]);
  const interestsRef = useRef<MapInterest[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<MapPoint | null>(null);

  // États pour l'ajout de point
  const [addingPointCoords, setAddingPointCoords] = useState<{ lng: number; lat: number } | null>(null);
  const [awaitingMapClick, setAwaitingMapClick] = useState(false);
  const awaitingMapClickRef = useRef(false);
  const tempMarkerRef = useRef<maplibregl.Marker | null>(null);

  // --- FONCTIONS UTILITAIRES ---

  const refreshPoints = useCallback(async () => {
    try {
      console.log("[Points] Chargement des points pour event_id:", selectedEventId);
      const freshPoints = await invoke<MapPoint[]>("fetch_points", {
        eventId: selectedEventId ? String(selectedEventId) : null,
      });

      console.log(`${freshPoints.length} point(s) récupéré(s)`);
      pointsRef.current = freshPoints;
      setPoints(freshPoints);

      // Mettre à jour la source de la carte directement
      if (map && map.getSource("db-points")) {
        const geojson: GeoJSON.FeatureCollection<GeoJSON.Point> = {
          type: "FeatureCollection",
          features: freshPoints.map((p) => ({
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [Number(p.x), Number(p.y)],
            },
            properties: {
              id: p.id,
              status: p.status,
              comment: p.comment,
              pictures: p.pictures,
            },
          })),
        };
        (map.getSource("db-points") as maplibregl.GeoJSONSource).setData(geojson);
      }
    } catch (err) {
      console.error("Erreur chargement points:", err);
    }
  }, [selectedEventId, map]);

  const refreshInterest = useCallback(async () => {
    try {
      console.log("[Points] Chargement des points d'intérêt pour event_id:", selectedEventId);
      const freshInterests = await invoke<MapInterest[]>("fetch_interest_points", {
        eventId: selectedEventId ? String(selectedEventId) : null,
      });

      console.log(`${freshInterests.length} point(s) d'intérêt récupéré(s)`);
      interestsRef.current = freshInterests;
      setInterests(freshInterests);

      // Mettre à jour la source de la carte directement
      if (map && map.getSource("db-interests")) {
        const geojson: GeoJSON.FeatureCollection<GeoJSON.Point> = {
          type: "FeatureCollection",
          features: freshInterests.map((p) => ({
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [Number(p.x), Number(p.y)],
            },
            properties: {
              id: p.id,
              description: p.description,
            },
          })),
        };
        (map.getSource("db-interests") as maplibregl.GeoJSONSource).setData(geojson);
      }
    } catch (err) {
      console.error("Erreur chargement points d'intérêt:", err);
    }
  }, [selectedEventId, map]);

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

  // Fonction pour annuler l'ajout de point
  const cancelAddPoint = useCallback(() => {
    setAwaitingMapClick(false);
    awaitingMapClickRef.current = false;
    setAddingPointCoords(null);
    // Supprimer le marqueur temporaire s'il existe
    if (tempMarkerRef.current) {
      tempMarkerRef.current.remove();
      tempMarkerRef.current = null;
    }
  }, []);

  // --- AJOUTER CE BLOC DANS useMapPoints.ts ---

  const addPoint = async (pointData: { x: number; y: number; obstacles?: string; comments?: string; pictures?: string }) => {

    // 1. Sécurité : On ne peut pas sauvegarder sans Event ID
    if (!selectedEventId) {
      console.error("Impossible d'ajouter un point : Aucun événement sélectionné.");
      alert("Erreur : Aucun événement n'est sélectionné.");
      return;
    }

    try {
      console.log("[Points] Sauvegarde du point pour l'event :", selectedEventId);

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
      // Supprimer le marqueur temporaire
      if (tempMarkerRef.current) {
        tempMarkerRef.current.remove();
        tempMarkerRef.current = null;
      }

    } catch (e) {
      console.error("❌ Erreur lors de l'ajout du point :", e);
      alert("Erreur lors de la sauvegarde : " + e);
    }
  };

  // --- EFFETS ---

  // 1. Initialisation des sources et layers
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

        // Ajouter la source pour les points d'intérêt
        if (!map.getSource("db-interests")) {
          map.addSource("db-interests", {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
          });

          // Ajouter le layer pour les points d'intérêt
          map.addLayer({
            id: "db-interests-layer",
            type: "symbol",
            source: "db-interests",
            layout: {
              "text-field": "!",
              "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
              "text-size": 18,
              "text-anchor": "center",
            },
            paint: {
              "text-color": "#9c27b0",
              "text-halo-color": "#fff",
              "text-halo-width": 2,
            },
          });

          // Interactions pour les points d'intérêt
          map.on("mouseenter", "db-interests-layer", () => (map.getCanvas().style.cursor = "pointer"));
          map.on("mouseleave", "db-interests-layer", () => (map.getCanvas().style.cursor = ""));

          // Clic sur un point d'intérêt existant
          map.on("click", "db-interests-layer", (e) => {
            const f = e.features?.[0];
            if (!f) return;

            const description = f.properties?.description || 'Aucune description';
            const coords = (f.geometry as GeoJSON.Point).coordinates as [number, number];

            // Fermer toute popup existante
            const existingPopups = document.querySelectorAll('.maplibregl-popup');
            existingPopups.forEach(popup => popup.remove());

            // Créer et afficher la popup
            new maplibregl.Popup({ closeOnClick: true, maxWidth: '300px' })
              .setLngLat(coords)
              .setHTML(`
                <div class="p-2">
                  <div class="font-bold text-purple-700 mb-2 flex items-center gap-1">
                    <span>Point d'intérêt</span>
                  </div>
                  <p class="text-sm text-gray-700">${description}</p>
                </div>
              `)
              .addTo(map);
          });
        }

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
          const features = map.queryRenderedFeatures(e.point, { layers: ["db-points-layer", "db-interests-layer"] });
          if (features.length > 0) return;

          // Désactiver le mode ajout
          awaitingMapClickRef.current = false;
          setAwaitingMapClick(false);

          // Créer un marqueur temporaire à l'emplacement du clic
          if (tempMarkerRef.current) {
            tempMarkerRef.current.remove();
          }
          const marker = new maplibregl.Marker({ color: '#FF5722' })
            .setLngLat([e.lngLat.lng, e.lngLat.lat])
            .addTo(map);
          tempMarkerRef.current = marker;

          // Ouvrir le formulaire
          setSelectedPoint(null);
          setAddingPointCoords({ lng: e.lngLat.lng, lat: e.lngLat.lat });
        });

        // Charger les points immédiatement après la création de la source
        if (selectedEventId) {
          console.log("[Points] Chargement initial des points pour event_id:", selectedEventId);
          invoke<MapPoint[]>("fetch_points", {
            eventId: String(selectedEventId),
          })
            .then((freshPoints) => {
              console.log(`${freshPoints.length} point(s) récupéré(s)`);
              pointsRef.current = freshPoints;
              setPoints(freshPoints);

              const geojson: GeoJSON.FeatureCollection<GeoJSON.Point> = {
                type: "FeatureCollection",
                features: freshPoints.map((p) => ({
                  type: "Feature",
                  geometry: {
                    type: "Point",
                    coordinates: [Number(p.x), Number(p.y)],
                  },
                  properties: {
                    id: p.id,
                    status: p.status,
                    comment: p.comment,
                    pictures: p.pictures,
                  },
                })),
              };
              (map.getSource("db-points") as maplibregl.GeoJSONSource).setData(geojson);
            })
            .catch((err) => console.error("Erreur chargement initial points:", err));

          // Charger les points d'intérêt immédiatement après la création de la source
          console.log("[Points] Chargement initial des points d'intérêt pour event_id:", selectedEventId);
          invoke<MapInterest[]>("fetch_interest_points", {
            eventId: String(selectedEventId),
          })
            .then((freshInterests) => {
              console.log(`${freshInterests.length} point(s) d'intérêt récupéré(s)`);
              interestsRef.current = freshInterests;
              setInterests(freshInterests);

              const geojson: GeoJSON.FeatureCollection<GeoJSON.Point> = {
                type: "FeatureCollection",
                features: freshInterests.map((p) => ({
                  type: "Feature",
                  geometry: {
                    type: "Point",
                    coordinates: [Number(p.x), Number(p.y)],
                  },
                  properties: {
                    id: p.id,
                    description: p.description,
                  },
                })),
              };
              (map.getSource("db-interests") as maplibregl.GeoJSONSource).setData(geojson);
            })
            .catch((err) => console.error("Erreur chargement initial points d'intérêt:", err));
        }

      } catch (error) {
        console.error("Erreur lors de l'initialisation des layers map:", error);
      }
    };

    // --- LOGIQUE DE CHARGEMENT DU STYLE ---
    if (map.isStyleLoaded()) {
      initializeMapResources();
    } else {
      map.once('load', initializeMapResources);
    }

    // Cleanup : on retire l'écouteur si le composant est démonté avant le chargement
    return () => {
      map.off('load', initializeMapResources);
    };

  }, [map, selectedEventId]); // Ajouter selectedEventId aux dépendances

  // 2. Charger les points quand l'événement change ou la source est prête
  useEffect(() => {
    if (!map || !map.getSource("db-points")) return;

    // Charger les points directement ici pour éviter le warning
    const loadPoints = async () => {
      try {
        console.log("[Points] Chargement des points pour event_id:", selectedEventId);
        const freshPoints = await invoke<MapPoint[]>("fetch_points", {
          eventId: selectedEventId ? String(selectedEventId) : null,
        });

        console.log(`${freshPoints.length} point(s) récupéré(s)`);
        pointsRef.current = freshPoints;
        setPoints(freshPoints);

        // Mettre à jour la source de la carte
        if (map && map.getSource("db-points")) {
          const geojson: GeoJSON.FeatureCollection<GeoJSON.Point> = {
            type: "FeatureCollection",
            features: freshPoints.map((p) => ({
              type: "Feature",
              geometry: {
                type: "Point",
                coordinates: [Number(p.x), Number(p.y)],
              },
              properties: {
                id: p.id,
                status: p.status,
                comment: p.comment,
                pictures: p.pictures,
              },
            })),
          };
          (map.getSource("db-points") as maplibregl.GeoJSONSource).setData(geojson);
        }
      } catch (err) {
        console.error("Erreur chargement points:", err);
      }
    };

    loadPoints();
  }, [selectedEventId, map]); // Seulement selectedEventId et map, pas selectedPoint ni updateMapSource

  // 2b. Charger les points d'intérêt
  useEffect(() => {
    if (!map || !map.getSource("db-interests")) return;

    // Appel asynchrone pour éviter le setState synchrone dans useEffect
    const loadInterests = async () => {
      await refreshInterest();
    };
    loadInterests();
  }, [selectedEventId, map, refreshInterest]);

  // 3. Gestion du curseur "crosshair" pour l'ajout
  useEffect(() => {
    if (!map) return;
    map.getCanvas().style.cursor = awaitingMapClick ? "crosshair" : "";
    return () => {
      // Petite sécurité ici aussi
      if (map && map.getCanvas()) map.getCanvas().style.cursor = "";
    };
  }, [awaitingMapClick, map]);

  // 4. Écoute des mises à jour temps réel
  useEffect(() => {
    const unlisten = listen<string>("points-updated", (event) => {
      console.log("[Points] Points mis à jour via socket, event_id:", event.payload);
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
      console.log("[Points] Changement d'événement, rechargement des points...");
      // Defer the refresh to avoid synchronous setState in effect
      const timeoutId = setTimeout(() => {
        refreshPoints();
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [selectedEventId, map, refreshPoints]);

  // 5. Recharger les points d'intérêt quand l'événement sélectionné change
  useEffect(() => {
    if (map && map.getSource("db-interests")) {
      console.log("[Points] Changement d'événement, rechargement des points d'intérêt...");
      // Defer the refresh to avoid synchronous setState in effect
      const timeoutId = setTimeout(() => {
        refreshInterest();
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [selectedEventId, map, refreshInterest]);

  // 6. Contrôler la visibilité du layer de points d'intérêt
  useEffect(() => {
    if (!map) return;

    const layer = map.getLayer("db-interests-layer");
    if (layer) {
      map.setLayoutProperty(
        "db-interests-layer",
        "visibility",
        showInterests ? "visible" : "none"
      );
    }
  }, [map, showInterests]);

  return {
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
    addPoint,
    cancelAddPoint,
    //updateMapSource, // Exposé pour permettre le filtrage externe
  };
}