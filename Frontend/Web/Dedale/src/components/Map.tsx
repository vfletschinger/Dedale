import React, { useRef, useEffect } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

function OfflineMapLibre() {
  const mapContainer = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!mapContainer.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: 'http://localhost:8080/styles/basic-preview/style.json',
      center: [7.7635, 48.5465],
      zoom: 13
    });

    new maplibregl.Marker()
      .setLngLat([7.7635, 48.5465])
      .setPopup(new maplibregl.Popup().setText('Strasbourg !'))
      .addTo(map);

    return () => map.remove();
  }, []);

  return <div ref={mapContainer} style={{ height: '100vh', width: '100%' }} />;
}

export default OfflineMapLibre;
