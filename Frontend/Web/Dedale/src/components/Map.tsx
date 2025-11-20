import { useRef, useEffect, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { invoke } from "@tauri-apps/api/core";
import PointDetails from "./PointDetails";
import ReactDOM from "react-dom/client";

function OfflineMapLibre() {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [currentMarker, setCurrentMarker] = useState<maplibregl.Marker | null>(
    null
  );
  const [currentPopup, setCurrentPopup] = useState<maplibregl.Popup | null>(null);

  // Initialisation de la carte
  useEffect(() => {
    if (map || !mapContainer.current) return;

    const mapInstance = new maplibregl.Map({
      container: mapContainer.current,
      style: "http://localhost:8080/styles/basic-preview/style.json",
      center: [7.7635, 48.5465],
      zoom: 13,
    });

    // Récupère les points via la commande Tauri `get_points` et les ajoute en source GeoJSON
    const fetchAndDisplayPoints = async (mapObj: maplibregl.Map) => {
      try {
        const points = await invoke<any[]>("get_points"); // [{ id, x, y, obstacles, comments, pictures }, ...]

        const geojson = {
          type: "FeatureCollection",
          features: points.map((p: any) => ({
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [Number(p.x), Number(p.y)] as [number, number], // lon, lat
            },
            properties: {
              id: p.id,
              obstacles: p.obstacles,
              comments: p.comments,
              pictures: p.pictures,
            },
          })),
        } as GeoJSON.FeatureCollection<GeoJSON.Point, any>;

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

          mapObj.on("click", "db-points-layer", async (e: any) => {
            const f = e.features?.[0];
            if (!f) return;
            const coords = (f.geometry as any).coordinates.slice();
            const props = f.properties;
            const pointId = props?.id;

            // remove previous popup if any
            if (currentPopup) {
              currentPopup.remove();
              setCurrentPopup(null);
            }

            // Crée un conteneur DOM pour le Popup et le composant React
            const container = document.createElement("div");
            // style minimal afin que le popup ait une taille raisonnable
            container.style.maxWidth = "600px";         // agrandi
            container.style.maxHeight = "600px";        // agrandi
            container.style.width = "350px";            // taille par défaut
            container.style.height = "450px";
            container.style.overflow = "auto";
            container.style.boxSizing = "border-box";
            container.style.padding = "8px";
            container.style.background = "white";

            const popup = new maplibregl.Popup({ offset: 12, closeButton: false, className: "custom-popup" })
              .setLngLat(coords)
              .setDOMContent(container)
              .addTo(mapObj);
            setCurrentPopup(popup);

            // Monte le composant React dans le container
            const root = ReactDOM.createRoot(container);

            // Fonction de fermeture pour le bouton "Fermer" dans le composant
            const handleClose = () => {
              popup.remove();
            };

            try {
              // Appel Tauri pour récupérer tous les points, puis filtrage par id
              const point =
                points.find((p) => String(p.id) === String(pointId)) ?? null;

              root.render(<PointDetails point={point} onClose={handleClose} />);
            } catch (err) {
              // En cas d'erreur, afficher l'erreur dans le popup
              root.render(
                <div style={{ padding: 12 }}>
                  Erreur: {String(err)}
                  <br />
                  <button onClick={handleClose}>Fermer</button>
                </div>
              );
            }

            // Quand le popup est fermé par l'utilisateur, démonter React
            popup.on("close", () => {
              try {
                root.unmount();
              } catch (_) {
                /* ignore */
              }
              setCurrentPopup(null);
            });
          });

          mapObj.on(
            "mouseenter",
            "db-points-layer",
            () => (mapObj.getCanvas().style.cursor = "pointer")
          );
          mapObj.on(
            "mouseleave",
            "db-points-layer",
            () => (mapObj.getCanvas().style.cursor = "")
          );
        } else {
          (mapObj.getSource("db-points") as maplibregl.GeoJSONSource).setData(
            geojson
          );
        }
      } catch (err) {
        console.error("fetchAndDisplayPoints error", err);
      }
    };

    mapInstance.on("load", () => {
      fetchAndDisplayPoints(mapInstance);
    });

    const initialMarker = new maplibregl.Marker()
      .setLngLat([7.7635, 48.5465])
      .setPopup(new maplibregl.Popup().setText("Strasbourg !"))
      .addTo(mapInstance);

    setCurrentMarker(initialMarker);
    setMap(mapInstance);

    return () => mapInstance.remove();
  }, []);

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
    <div style={{ position: "relative", height: "100vh", width: "100%" }}>
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
  );
}

export default OfflineMapLibre;
