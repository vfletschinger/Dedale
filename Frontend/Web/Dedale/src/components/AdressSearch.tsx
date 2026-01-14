import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { SearchResult } from "../types/map";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMapMarkerAlt, faSearch, faTimes } from "@fortawesome/free-solid-svg-icons";

interface AddressSearchProps {
  onSelect: (result: SearchResult) => void;
}

export default function AddressSearch({ onSelect }: AddressSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const isSelectingRef = useRef(false);

  const handleSelect = (place: SearchResult) => {
    isSelectingRef.current = true;
    setQuery(place.display_name);
    setResults([]);
    onSelect(place);
  };

  const clearSearch = () => {
    setQuery("");
    setResults([]);
    inputRef.current?.focus();
  };

  useEffect(() => {
    if (isSelectingRef.current) {
      isSelectingRef.current = false;
      return;
    }

    const timeout = setTimeout(async () => {
      if (query.trim().length < 2) {
        setResults([]);
        return;
      }

      try {
        // Appel à la commande Tauri de géocodage local
        const data = await invoke<SearchResult[]>("search_address", { query });
        setResults(data);
      } catch (error) {
        console.error("Erreur recherche adresse :", error);
        setResults([]);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [query]);

  return (
    <div className="relative w-full z-50">
      {/* Container style Google Maps */}
      <div
        className={`flex items-center w-full bg-white rounded-full shadow-md transition-all duration-200 border border-transparent ${isFocused ? "shadow-lg ring-2 ring-blue-500/50" : "hover:shadow-lg"
          }`}
      >
        <div className="pl-4 text-gray-400">
          <FontAwesomeIcon icon={faSearch} className="h-5 w-5" />
        </div>

        <input
          ref={inputRef}
          type="text"
          placeholder="Rechercher un lieu, une adresse..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setIsFocused(false);
            // Petit délai pour permettre le clic sur la liste
            setTimeout(() => setResults([]), 200);
          }}
          className="flex-1 w-full px-3 py-3 bg-transparent border-none rounded-full focus:outline-none focus:ring-0 text-gray-700 text-base placeholder-gray-400"
        />

        {/* Bouton Effacer (affiché seulement si texte) */}
        {query.length > 0 && (
          <button
            onClick={clearSearch}
            className="pr-4 text-gray-400 hover:text-gray-600 focus:outline-none transition-colors"
            title="Effacer la recherche"
          >
            <FontAwesomeIcon icon={faTimes} className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Liste de suggestions */}
      {results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 max-h-80 overflow-y-auto py-2 z-50 animate-fade-in-down">
          {results.map((r, i) => (
            <button
              key={i}
              className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 transition-colors duration-150 group"
              onClick={() => handleSelect(r)}
            >
              <div className="bg-gray-100 p-2 rounded-full group-hover:bg-blue-100 transition-colors">
                <span className="text-lg text-gray-600"><FontAwesomeIcon icon={faMapMarkerAlt} /></span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-800 truncate">
                  {r.display_name.split(",")[0]}
                </div>
                <div className="text-xs text-gray-500 truncate">
                  {r.display_name}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
