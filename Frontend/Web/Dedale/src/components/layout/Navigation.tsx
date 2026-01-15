import logoStrasbourg from "../../../public/dedale.png";
import type { PageKey } from "../../hooks/useNavigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCalendarAlt, faTimes } from "@fortawesome/free-solid-svg-icons";

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
  { key: "team-person", label: "Équipes" },
  { key: "planning", label: "Planning" },
  { key: "data", label: "Données" },
];

export default function Navigation({
  currentPage,
  onNavigate,
  eventSelected,
  eventName,
  deselectEvent,
}: NavigationProps) {
  return (
    <nav className="sticky top-0 z-[100] w-full bg-gray-900 border-b border-gray-800 shadow-xl">
      <div className="w-full px-6">
        <div className="flex h-16 items-center justify-between">
          {/* Section Gauche : Logo & Branding */}
          <div className="flex items-center ">
            <div
              className="flex items-center cursor-pointer group"
              onClick={() => onNavigate("event")}
            >
              <img
                src={logoStrasbourg}
                alt="Logo"
                className="h-16 w-auto "
              />
              <span className="text-3xl font-bold text-white tracking-tight ">
                Dedale
              </span>
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
                      ? "text-secondary bg-white/5 border-b-2 border-secondary"
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
                className="flex items-center gap-2 px-5 py-2.5 bg-yellow-500  text-gray-900 font-bold rounded-lg transition-all cursor-pointer transform "
              >
                <FontAwesomeIcon icon={faCalendarAlt} className="text-sm" />
                <span className="text-sm">
                  Sélectionner un événement
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
