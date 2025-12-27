import { useState, useEffect } from "react";
// On garde juste le type, pas toute la librairie maplibre ici
import { SearchResult } from "../types/map"; // Assurez-vous que le chemin est bon

interface AddressSearchProps {
  onSelect: (result: SearchResult) => void;
}

export default function AddressSearch({ onSelect }: AddressSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);

  const handleSelect = (place: SearchResult) => {
    setQuery(place.display_name);
    setResults([]);
    onSelect(place);
  };

  useEffect(() => {

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
    }, 300);

    return () => clearTimeout(timeout);
  }, [query]);

  return (
    <div className="relative flex-1">
      <input
        type="text"
        placeholder="🔍 Rechercher un lieu..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onBlur={() => setTimeout(() => setResults([]), 200)}
        className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-800 font-semibold transition-all duration-200 hover:bg-gray-50 hover:shadow-md placeholder-gray-400 text-sm"
      />

      {/* Liste de suggestions */}
      <div
        className={`absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-xl border border-gray-200 max-h-60 overflow-y-auto transition-all duration-300 ease-out z-50 ${
          results.length > 0
            ? "opacity-100 translate-y-0"
            : "opacity-0 -translate-y-2 pointer-events-none h-0 mt-0"
        }`}
      >
        {results.map((r, i) => (
          <div
            key={i}
            className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-all duration-200 group"
            onClick={() => handleSelect(r)}
          >
            <div className="text-sm text-gray-800 font-medium flex items-center gap-2">
              <span className="text-lg group-hover:scale-125 transition-transform">
                📍
              </span>
              <span>{r.display_name}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}