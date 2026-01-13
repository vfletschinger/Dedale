import logoStrasbourg from "../assets/logo_strasbourg.png";
import type { PageKey } from "../hooks/useNavigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronLeft, faCalendarAlt, faTimes } from "@fortawesome/free-solid-svg-icons";

interface NavigationProps {
  currentPage: PageKey;
  onNavigate: (page: PageKey) => void;
  canGoBack?: boolean;
  onGoBack?: () => void;
  eventSelected: boolean;
  eventName?: string;
  deselectEvent: () => void;
}

const NAV_ITEMS: { key: PageKey; label: string }[] = [
  { key: "event", label: "Événements" },
  { key: "map", label: "Carte" },
  { key: "team", label: "Équipes" },
  { key: "person", label: "Personnes" },
  { key: "planning", label: "Planning" },
  { key: "data", label: "Données" },
];

export default function Navigation({
  currentPage,
  onNavigate,
  canGoBack,
  onGoBack,
  eventSelected,
  eventName,
  deselectEvent,
}: NavigationProps) {
  return (
    <nav className="sticky top-0 z-[100] w-full bg-gray-900 border-b border-gray-800 shadow-xl">
      <div className="w-full px-6">
        <div className="flex h-16 items-center justify-between">
          {/* Section Gauche : Logo & Branding */}
          <div className="flex items-center gap-5 flex-shrink-0">
            {canGoBack && onGoBack && (
              <button
                onClick={onGoBack}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:text-yellow-400 hover:bg-white/5 transition-all cursor-pointer"
                aria-label="Retour"
              >
                <FontAwesomeIcon icon={faChevronLeft} className="h-4 w-4" />
              </button>
            )}

            <div
              className="flex items-center gap-3 cursor-pointer group"
              onClick={() => onNavigate("event")}
            >
              <div className="relative">
                <img
                  src={logoStrasbourg}
                  alt="Logo"
                  className="h-9 w-auto object-contain brightness-0 invert"
                />
                <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-yellow-500 rounded-full border border-gray-900"></div>
              </div>
              <div className="flex flex-col leading-none">
                <span className="text-lg font-bold text-white tracking-tight group-hover:text-yellow-400 transition-colors">
                  Dedale
                </span>
                <span className="text-[10px] font-bold text-yellow-500 uppercase tracking-widest bg-yellow-500/10 px-1 py-0.5 rounded-sm w-fit mt-0.5">
                  Gestion Événements
                </span>
              </div>
            </div>
          </div>

          {/* Section Centre : Navigation */}
          <div className="flex items-center gap-1 h-full">
            {NAV_ITEMS.map(({ key, label }) => {
              const isActive = currentPage === key;
              const requiresEvent = key !== "event";
              const isDisabled = requiresEvent && !eventSelected;

              return (
                <button
                  key={key}
                  onClick={() => onNavigate(key)}
                  disabled={isDisabled}
                  className={`relative h-full px-5 text-sm font-medium transition-all duration-200 flex items-center justify-center
                  ${isActive
                      ? "text-yellow-400 bg-white/5 border-b-2 border-yellow-500"
                      : isDisabled
                        ? "text-gray-600 cursor-not-allowed"
                        : "text-gray-300 hover:text-white hover:bg-white/5 border-b-2 border-transparent"
                    }`}
                  title={isDisabled ? "Sélectionnez d'abord un événement" : ""}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Section Droite : Event Selection */}
          <div className="flex items-center flex-shrink-0">
            {eventSelected ? (
              <div className="flex items-center group relative">
                <div className="flex items-center gap-3 px-5 py-2 bg-gray-800 border border-gray-700 rounded-full pr-12 transition-all hover:border-yellow-500/50">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                  <FontAwesomeIcon icon={faCalendarAlt} className="text-yellow-500 text-sm" />
                  <span className="text-sm font-medium text-gray-200 max-w-[180px] truncate">
                    {eventName || "Événement"}
                  </span>
                </div>
                <button
                  onClick={deselectEvent}
                  className="absolute right-1 w-8 h-8 flex items-center justify-center rounded-full bg-gray-700 hover:bg-red-500/20 text-gray-400 hover:text-red-500 transition-all cursor-pointer"
                  title="Désélectionner l'événement"
                >
                  <FontAwesomeIcon icon={faTimes} className="text-xs" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => onNavigate("event")}
                className="flex items-center gap-2 px-5 py-2.5 bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-bold rounded-lg shadow-lg hover:shadow-yellow-500/20 transition-all cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0"
              >
                <FontAwesomeIcon icon={faCalendarAlt} className="text-sm" />
                <span className="text-sm">
                  Créer un événement
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
