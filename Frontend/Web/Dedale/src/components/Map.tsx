import { useRef, useEffect, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { invoke } from "@tauri-apps/api/core";
import PointDetails from "./PointDetails";
import ReactDOM from "react-dom/client";

// Local style constants to avoid inline clutter in JSX
const LEFT_PANEL_STYLE: React.CSSProperties = {
  width: 320,
  background: "#fff",
  padding: 8,
  overflowY: "auto",
  boxShadow: "2px 0 6px rgba(0,0,0,0.06)",
  zIndex: 12,
};


// Create GeoJSON from points array
function formatPointsGeoJSON(points: any[]) {
  return {
    type: "FeatureCollection",
    features: points.map((p: any) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [Number(p.x), Number(p.y)] as [number, number],
      },
      properties: {
        id: p.id,
        obstacles: p.obstacles,
        comments: p.comments,
        pictures: p.pictures,
      },
    })),
  } as GeoJSON.FeatureCollection<GeoJSON.Point, any>;
}

function OfflineMapLibre() {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [points, setPoints] = useState<any[]>([]);
  const [currentMarker, setCurrentMarker] = useState<maplibregl.Marker | null>(
    null
  );
  const [currentPopup, setCurrentPopup] = useState<maplibregl.Popup | null>(null);
  const pointsRef = useRef<any[]>([]);

  // Initialisation de la carte
  useEffect(() => {
    if (map || !mapContainer.current) return;

    const mapInstance = new maplibregl.Map({
      container: mapContainer.current,
      style: "http://localhost:8080/styles/basic-preview/style.json",
      center: [7.7635, 48.5465],
      zoom: 13,
    });

    // Récupère les points via la commande Tauri `get_points`
    const fetchAndDisplayPoints = async (mapObj: maplibregl.Map) => {
      try {
        const points = await invoke<any[]>("get_points");

        pointsRef.current = points;
        setPoints(points);

        const geojson = formatPointsGeoJSON(points);

        if (!mapObj.getSource("db-points")) {
          mapObj.addSource("db-points", {
            type: "geojson",
            data: geojson,
            cluster: true,
            clusterRadius: 50,
          });

          mapObj.addLayer({
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

          // --- CLICK LISTENER START ---
          mapObj.on("click", "db-points-layer", async (e: any) => {
            const f = e.features?.[0];
            if (!f) return;
            const coords = (f.geometry as any).coordinates.slice();
            const pointId = f.properties?.id;

            // Use shared popup helper and pass a refresh function
            createPopup(mapObj, coords, pointId, async () => {
              await fetchAndDisplayPoints(mapObj);
            });
          });
          // --- CLICK LISTENER END ---

          // Mouse cursors
          mapObj.on("mouseenter", "db-points-layer", () => (mapObj.getCanvas().style.cursor = "pointer"));
          mapObj.on("mouseleave", "db-points-layer", () => (mapObj.getCanvas().style.cursor = ""));

        } else {
          (mapObj.getSource("db-points") as maplibregl.GeoJSONSource).setData(geojson);
        }
      } catch (err) {
        console.error("fetchAndDisplayPoints error", err);
      }
    };

    mapInstance.on("load", () => {
      fetchAndDisplayPoints(mapInstance);
    });

    // expose for later refreshes (debug helper)
    (window as any).__fetchAndDisplayPoints = fetchAndDisplayPoints;

    const initialMarker = new maplibregl.Marker()
      .setLngLat([7.7635, 48.5465])
      .setPopup(new maplibregl.Popup().setText("Strasbourg !"))
      .addTo(mapInstance);

    setCurrentMarker(initialMarker);
    setMap(mapInstance);

    return () => mapInstance.remove();
  }, []);

  // Helper pour créer et afficher un popup pour un point (réutilisé)
  const createPopup = (
    mapInstance: maplibregl.Map,
    coords: [number, number],
    pointId: string | number,
    refreshFn?: () => Promise<void>
  ) => {
    // retire l'éventuel popup précédent
    if (currentPopup) {
      currentPopup.remove();
      setCurrentPopup(null);
    }

    // DOM Setup
    const container = document.createElement("div");
    container.style.maxWidth = "600px";
    container.style.maxHeight = "450px";
    container.style.width = "350px";
    container.style.minHeight = "200px";
    container.style.overflow = "auto";
    container.style.padding = "8px";

    const popup = new maplibregl.Popup({
      offset: 12,
      closeButton: false,
      className: "custom-popup",
    })
      .setLngLat(coords)
      .setDOMContent(container)
      .addTo(mapInstance);

    setCurrentPopup(popup);
    const root = ReactDOM.createRoot(container);

    const handleClose = () => popup.remove();

    const renderPopupUI = () => {
      const freshPoint = pointsRef.current.find(
        (p) => String(p.id) === String(pointId)
      );

      // If point was deleted, close the popup
      if (!freshPoint) {
        handleClose();
        return;
      }

      root.render(
        <PointDetails
          point={freshPoint}
          onClose={handleClose}
          onRefresh={async () => {
            try {
              if (refreshFn) await refreshFn();
              renderPopupUI();
            } catch (err) {
              console.error("refresh in popup error", err);
            }
          }}
        />
      );
    };

    // Initial render
    renderPopupUI();

    // Cleanup
    popup.on("close", () => {
      setTimeout(() => root.unmount(), 0);
      setCurrentPopup(null);
    });
  };

  // Ouvre un popup pour un point (utilisé par la liste à gauche)
  const openPopupForPoint = async (point: any) => {
    if (!map || !point) return;

    const coords: [number, number] = [Number(point.x), Number(point.y)];

    // recentre la carte
    map.flyTo({ center: coords, zoom: 15 });

    // utilise le helper partagé; refresh mettra à jour la source et l'état `points`
    createPopup(map, coords, point.id, async () => {
      try {
        const fresh = await invoke<any[]>("get_points");
        pointsRef.current = fresh;
        setPoints(fresh);
        if (map.getSource("db-points")) {
          const geojson = {
            type: "FeatureCollection",
            features: fresh.map((p: any) => ({
              type: "Feature",
              geometry: { type: "Point", coordinates: [Number(p.x), Number(p.y)] },
              properties: { id: p.id, obstacles: p.obstacles, comments: p.comments, pictures: p.pictures },
            })),
          } as GeoJSON.FeatureCollection<GeoJSON.Point, any>;
          (map.getSource("db-points") as maplibregl.GeoJSONSource).setData(geojson);
        }
      } catch (err) {
        console.error("refresh in openPopupForPoint error", err);
      }
    });
  };

  // Fonction pour sélectionner une suggestion
  const handleSelect = (place: any) => {
    if (!map) return;

    const { lon, lat, display_name } = place;

    if (currentMarker) currentMarker.remove();

    const marker = new maplibregl.Marker()
      .setLngLat([parseFloat(lon), parseFloat(lat)])
      .setPopup(new maplibregl.Popup().setText(display_name))
      .addTo(map);

    setCurrentMarker(marker);

    map.flyTo({ center: [parseFloat(lon), parseFloat(lat)], zoom: 15 });

    setQuery(display_name);
    setResults([]);
  };

  // Debounce pour limiter les appels à Nominatim
  useEffect(() => {
    if (!query) {
      setResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        const response = await fetch(
          `http://localhost:8081/search?q=${encodeURIComponent(
            query
          )}&format=json&limit=5`
        );
        const data = await response.json();
        setResults(data);
      } catch (error) {
        console.error("Erreur recherche adresse :", error);
      }
    }, 300); // délai 300ms après la dernière frappe

    return () => clearTimeout(timeout);
  }, [query]);

  return (
    <div style={{ display: "flex", height: "100vh", width: "100%" }}>
      {/* Panneau gauche: liste des points */}
      <div className="left-panel" style={LEFT_PANEL_STYLE}>
        <div className="panel-header" style={{ marginBottom: 6 }}>
          <h3 style={{ margin: 0 }}>Points</h3>
          <button
            className="add-btn"
            onClick={() => {
              // placeholder action: ouvrir l'UI d'ajout plus tard
              try {
                // eslint-disable-next-line no-alert
                alert("Ajouter un point — fonctionnalité non implémentée");
              } catch (err) {
                console.error(err);
              }
            }}
            aria-label="Ajouter"
          >
            Ajouter
          </button>
        </div>

        {points.length === 0 && <div style={{ color: "#666" }}>Aucun point</div>}
        <div>
          {points.map((p: any) => (
            <div
              key={p.id}
              className="list-item"
              onClick={() => openPopupForPoint(p)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === "Enter" ? openPopupForPoint(p) : null)}
            >
              <div className="title">Point #{p.id}</div>
              <div className="meta">{p.obstacles?.length ?? 0} obstacles</div>
            </div>
          ))}
        </div>
      </div>

      {/* Zone carte à droite */}
      <div style={{ flex: 1, position: "relative" }}>
      {/* Barre de recherche */}
      <div
        style={{
          position: "absolute",
          top: 10,
          left: 10,
          zIndex: 10,
          backgroundColor: "white",
          padding: "5px",
          borderRadius: "4px",
          boxShadow: "0 0 5px rgba(0,0,0,0.3)",
          width: "300px",
        }}
      >
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher une adresse..."
          style={{ padding: "5px", width: "100%" }}
        />

        {/* Liste de suggestions */}
        {results.length > 0 && (
          <div
            style={{ marginTop: "5px", maxHeight: "150px", overflowY: "auto" }}
          >
            {results.map((r, i) => (
              <div
                key={i}
                style={{
                  padding: "5px",
                  cursor: "pointer",
                  borderBottom: "1px solid #ddd",
                }}
                onClick={() => handleSelect(r)}
              >
                {r.display_name}
              </div>
            ))}
          </div>
        )}
      </div>

        {/* Conteneur de la carte */}
        <div ref={mapContainer} style={{ height: "100%", width: "100%" }} />
      </div>
    </div>
  );
}

export default OfflineMapLibre;
