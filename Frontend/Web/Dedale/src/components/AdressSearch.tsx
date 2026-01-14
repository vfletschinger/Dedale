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
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            placeholder="Rechercher un lieu..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => {
              setIsFocused(false);
              // Petit délai pour permettre le clic sur la liste
              setTimeout(() => setResults([]), 200);
            }}
            className={`w-full pl-4 pr-10 py-2.5 bg-gray-800 border-2 rounded-lg text-white placeholder-gray-500 focus:outline-none transition-all ${isFocused
              ? "border-secondary shadow-lg shadow-secondary/10"
              : "border-gray-700 hover:border-gray-600"
              }`}
          />

          {/* Bouton Effacer */}
          {query.length > 0 && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
              title="Effacer"
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
          )}
        </div>

        <button
          className="px-4 py-2.5 bg-secondary hover:bg-secondary/80 text-gray-900 rounded-lg shadow-lg hover:shadow-secondary/20 font-bold transition-all flex items-center justify-center shrink-0"
        >
          <FontAwesomeIcon icon={faSearch} />
        </button>
      </div>

      {/* Liste de suggestions */}
      {results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-gray-800 rounded-xl shadow-xl border border-gray-700 max-h-80 overflow-y-auto py-2 z-50">
          {results.map((r, i) => (
            <button
              key={i}
              className="w-full text-left px-4 py-3 hover:bg-gray-700 flex items-center gap-3 transition-colors duration-150 group border-b border-gray-700/50 last:border-0"
              onClick={() => handleSelect(r)}
            >
              <div className="bg-gray-700 p-2 rounded-full group-hover:bg-secondary/20 group-hover:text-secondary transition-colors text-gray-400">
                <span className="text-sm"><FontAwesomeIcon icon={faMapMarkerAlt} /></span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-gray-200 truncate group-hover:text-white transition-colors">
                  {r.display_name.split(",")[0]}
                </div>
                <div className="text-xs text-gray-500 truncate group-hover:text-gray-400">
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
