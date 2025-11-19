import React, { useRef, useEffect, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

function OfflineMapLibre() {
  const mapContainer = useRef<HTMLDivElement | null>(null);

  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);

  let [inputValue, setInputValue] = useState("");
  let [location, setLocation] = useState([7.7635, 48.5465]); 

  //Création de la map et du marker une seule fois
  useEffect(() => {
    if (mapRef.current || !mapContainer.current) return; 

    // Création de la carte
    mapRef.current = new maplibregl.Map({
      container: mapContainer.current,
      style: "http://localhost:8080/styles/basic-preview/style.json",
      center: [location[0], location[1]],
      zoom: 13,
    });
    
    // Création du marker une seule foisb
    markerRef.current = new maplibregl.Marker()
      .setLngLat([location[0], location[1]])
      .setPopup(new maplibregl.Popup().setText("Strasbourg !"))
      .addTo(mapRef.current);

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []); 
  
  // Mise à jour de la position du marker et du centre de la map à chaque changement de location
  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;
    markerRef.current.setLngLat([location[0], location[1]]);
    mapRef.current.setCenter([location[0], location[1]]);
  }, [location]);

  const getLocation = (value: string) => {
    setLocation([7.6, 48.5]);
  };

  return (
    <div className="flex flex-col w-full h-screen">
      {" "}
      {/* Input au-dessus de la map */}{" "}
      <div className="p-4 bg-white shadow-md z-10">
        {" "}
        <form
          onSubmit={(e) => {
            e.preventDefault(); // Empêche le refresh
            getLocation(inputValue);
          }}
        >
          {" "}
          <input
            type="text"
            placeholder="search"
            className="w-full p-2 border border-black-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />{" "}
        </form>{" "}
      </div>{" "}
      {/* Map */} 
      <div ref={mapContainer} className="flex-1 h-full" />{" "}
    </div>
  );
}

export default OfflineMapLibre;
