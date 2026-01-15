import { useState, useRef, useEffect, useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown, faSearch, faTimes, faCheck } from "@fortawesome/free-solid-svg-icons";

export interface SearchableSelectOption {
    value: string;
    label: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data?: any;
}

interface SearchableSelectProps {
    options: SearchableSelectOption[];
    value: string | null;
    onChange: (value: string) => void;
    placeholder?: string;
    searchPlaceholder?: string;
    className?: string;
    renderOption?: (option: SearchableSelectOption) => React.ReactNode;
}

export default function SearchableSelect({
    options,
    value,
    onChange,
    placeholder = "Sélectionner...",
    searchPlaceholder = "Rechercher...",
    className = "",
    renderOption
}: SearchableSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const filteredOptions = useMemo(() => {
        if (!search) return options;
        const lowerSearch = search.toLowerCase();
        return options.filter(opt => opt.label.toLowerCase().includes(lowerSearch));
    }, [options, search]);

    const selectedOption = useMemo(() =>
        options.find(opt => opt.value === value),
        [options, value]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setSearch("");
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            {/* TRIGGER BUTTON */}
            <button
                type="button"
                onClick={() => {
                    if (isOpen) setSearch("");
                    setIsOpen(!isOpen);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all ${isOpen ? 'ring-2 ring-primary/20 border-primary/50' : 'hover:border-gray-300'}`}
            >
                <div className="flex-1 text-left truncate">
                    {selectedOption ? (
                        <span className="text-gray-800 font-medium">{selectedOption.label}</span>
                    ) : (
                        <span className="text-gray-400">{placeholder}</span>
                    )}
                </div>
                <FontAwesomeIcon icon={faChevronDown} className={`text-gray-400 text-xs ml-2 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* DROPDOWN MENU */}
            {isOpen && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 origin-top">
                    {/* SEARCH INPUT */}
                    <div className="p-2 border-b border-gray-50 bg-gray-50/50">
                        <div className="relative">
                            <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
                            <input
                                ref={inputRef}
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder={searchPlaceholder}
                                className="w-full pl-8 pr-8 py-1.5 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                            />
                            {search && (
                                <button
                                    onClick={() => setSearch("")}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                                >
                                    <FontAwesomeIcon icon={faTimes} className="text-xs" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* OPTIONS LIST */}
                    <div className="max-h-48 overflow-y-auto custom-scrollbar p-1">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((opt) => (
                                <button
                                    key={opt.value}
                                    onClick={() => {
                                        onChange(opt.value);
                                        setIsOpen(false);
                                        setSearch("");
                                    }}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between group transition-colors ${value === opt.value ? 'bg-primary/5 text-primary' : 'text-gray-700 hover:bg-gray-50'}`}
                                >
                                    <span className="truncate flex-1">
                                        {renderOption ? renderOption(opt) : opt.label}
                                    </span>
                                    {value === opt.value && <FontAwesomeIcon icon={faCheck} className="text-primary text-xs ml-2" />}
                                </button>
                            ))
                        ) : (
                            <div className="px-3 py-4 text-center text-gray-400 text-xs">
                                Aucun résultat trouvé
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
