import { useRef, useEffect, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { invoke } from "@tauri-apps/api/core";
import PointDetails from "./PointDetails";
import AddPointForm from "./AddPointForm";

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
  // popups replaced by drawer UI; keep ref for markers only
  // const [currentPopup, setCurrentPopup] = useState<maplibregl.Popup | null>(null);
  const pointsRef = useRef<any[]>([]);
  const [awaitingMapClick, setAwaitingMapClick] = useState(false);
  // Drawer state to show details or add form on the left side
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"details" | "add" | null>(null);
  const [drawerPoint, setDrawerPoint] = useState<any | null>(null);
  const [drawerRefreshFn, setDrawerRefreshFn] = useState<(() => Promise<void>) | null>(null);
  const [addInitialCoords, setAddInitialCoords] = useState<[number, number] | null>(null);

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
            const pointId = f.properties?.id;

            // Open details in drawer and provide refresh function
            openDrawerForPoint(pointId, async () => {
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

  // When awaiting a user click to add a point, show a special cursor on the map
  useEffect(() => {
    if (!map) return;
    try {
      const canvas = map.getCanvas();
      if (awaitingMapClick) {
        canvas.style.cursor = "crosshair";
      } else {
        canvas.style.cursor = "";
      }
    } catch (err) {
      // ignore
    }

    return () => {
      try {
        if (map) map.getCanvas().style.cursor = "";
      } catch (e) {}
    };
  }, [awaitingMapClick, map]);

  // Open the left drawer showing PointDetails
  const openDrawerForPoint = (pointId: string | number, refreshFn?: () => Promise<void>) => {
    const freshPoint = pointsRef.current.find((p) => String(p.id) === String(pointId));
    if (!freshPoint) return;
    setDrawerPoint(freshPoint);
    setDrawerRefreshFn(() => refreshFn ?? null);
    setDrawerMode("details");
    setDrawerOpen(true);
  };

  // Ouvre un popup pour un point (utilisé par la liste à gauche)
  const openPopupForPoint = async (point: any) => {
    if (!map || !point) return;

    const coords: [number, number] = [Number(point.x), Number(point.y)];

    // recentre la carte
    map.flyTo({ center: coords, zoom: 15 });

    // open details in drawer and refresh will update points
    openDrawerForPoint(point.id, async () => {
      try {
        const fresh = await invoke<any[]>("get_points");
        pointsRef.current = fresh;
        setPoints(fresh);
        if (map.getSource("db-points")) {
          const geojson = formatPointsGeoJSON(fresh);
          (map.getSource("db-points") as maplibregl.GeoJSONSource).setData(geojson);
        }
      } catch (err) {
        console.error("refresh in openPopupForPoint error", err);
      }
    });
  };

  // Add form is now shown in the drawer (state-driven)

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
              if (!map) {
                alert("Carte non initialisée");
                return;
              }

              setAwaitingMapClick(true);
              // one-time click on the map to pick coordinates
              map.once("click", (e: any) => {
                if (!e || !e.lngLat) {
                  setAwaitingMapClick(false);
                  return;
                }
                const lngLat = [e.lngLat.lng, e.lngLat.lat] as [number, number];
                // open add form in drawer
                setAddInitialCoords(lngLat);
                setDrawerMode("add");
                setDrawerOpen(true);
                setAwaitingMapClick(false);
              });
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

      {/* Drawer is rendered inside the map container to stay below top nav and align to the right of the map. */}

      {/* Zone carte à droite */}
      <div style={{ flex: 1, position: "relative" }}>
      {/* Drawer: render inside the map container so it sits to the right of the map and under the navbar */}
      {drawerOpen && (
        <div
          className="drawer"
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            height: "100%",
            width: 380,
            zIndex: 20,
            background: "#fff",
            boxShadow: "-2px 0 12px rgba(0,0,0,0.12)",
            overflow: "auto",
          }}
        >
          <div style={{ padding: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 700 }}>{drawerMode === "details" ? `Point #${drawerPoint?.id}` : "Nouveau point"}</div>
              <button className="pp-close" onClick={() => setDrawerOpen(false)} aria-label="Fermer">✕</button>
            </div>

            <div style={{ marginTop: 8 }}>
              {drawerMode === "details" && drawerPoint && (
                <PointDetails
                  point={drawerPoint}
                  onClose={() => setDrawerOpen(false)}
                  onRefresh={async () => {
                    try {
                      if (drawerRefreshFn) await drawerRefreshFn();
                      const fresh = await invoke<any[]>("get_points");
                      pointsRef.current = fresh;
                      setPoints(fresh);
                      if (map && map.getSource("db-points")) {
                        (map.getSource("db-points") as maplibregl.GeoJSONSource).setData(formatPointsGeoJSON(fresh));
                      }

                      // Update the drawerPoint to the refreshed version so PointDetails
                      // receives the latest obstacles/comments/pictures without re-opening.
                      if (fresh && drawerPoint) {
                        const updated = fresh.find((p) => String(p.id) === String(drawerPoint.id));
                        if (updated) {
                          setDrawerPoint(updated);
                        }
                      }
                    } catch (err) {
                      console.error(err);
                    }
                  }}
                />
              )}

              {drawerMode === "add" && addInitialCoords && (
                <AddPointForm
                  initialCoords={{ lng: addInitialCoords[0], lat: addInitialCoords[1] }}
                  onClose={() => setDrawerOpen(false)}
                  onSaved={async () => {
                    try {
                      const fresh = await invoke<any[]>("get_points");
                      pointsRef.current = fresh;
                      setPoints(fresh);
                      if (map && map.getSource("db-points")) {
                        (map.getSource("db-points") as maplibregl.GeoJSONSource).setData(formatPointsGeoJSON(fresh));
                      }
                    } catch (err) {
                      console.error(err);
                    }
                    setDrawerOpen(false);
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}
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
