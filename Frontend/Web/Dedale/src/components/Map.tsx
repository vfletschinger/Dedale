import React, { useRef, useEffect, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

function OfflineMapLibre() {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [currentMarker, setCurrentMarker] = useState<maplibregl.Marker | null>(null);

  // Initialisation de la carte
  useEffect(() => {
    if (!mapContainer.current) return;

    const mapInstance = new maplibregl.Map({
      container: mapContainer.current,
      style: 'http://localhost:8080/styles/basic-preview/style.json',
      center: [7.7635, 48.5465],
      zoom: 13,
    });

    const initialMarker = new maplibregl.Marker()
      .setLngLat([7.7635, 48.5465])
      .setPopup(new maplibregl.Popup().setText('Strasbourg !'))
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
          `http://localhost:8081/search?q=${encodeURIComponent(query)}&format=json&limit=5`
        );
        const data = await response.json();
        setResults(data);
      } catch (error) {
        console.error('Erreur recherche adresse :', error);
      }
    }, 300); // délai 300ms après la dernière frappe

    return () => clearTimeout(timeout);
  }, [query]);

  return (
    <div style={{ position: 'relative', height: '100vh', width: '100%' }}>
      {/* Barre de recherche */}
      <div
        style={{
          position: 'absolute',
          top: 10,
          left: 10,
          zIndex: 10,
          backgroundColor: 'white',
          padding: '5px',
          borderRadius: '4px',
          boxShadow: '0 0 5px rgba(0,0,0,0.3)',
          width: '300px',
        }}
      >
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher une adresse..."
          style={{ padding: '5px', width: '100%' }}
        />

        {/* Liste de suggestions */}
        {results.length > 0 && (
          <div style={{ marginTop: '5px', maxHeight: '150px', overflowY: 'auto' }}>
            {results.map((r, i) => (
              <div
                key={i}
                style={{
                  padding: '5px',
                  cursor: 'pointer',
                  borderBottom: '1px solid #ddd',
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
      <div ref={mapContainer} style={{ height: '100%', width: '100%' }} />
    </div>
  );
}

export default OfflineMapLibre;
