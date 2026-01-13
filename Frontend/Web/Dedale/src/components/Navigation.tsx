import logoStrasbourg from "../../public/dedale.png";
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
  eventName?: string;
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
  eventName,
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
          <div hidden={!eventSelected} className="flex items-center gap-2 px-2 py-1.5 bg-slate-800 rounded-lg border border-slate-600 shadow-md">
            <button onClick={deselectEvent} className={`relative px-4 py-2 text-[11px] font-semibold tracking-wide uppercase transition-all duration-200 rounded-md cursor-pointer text-slate-300 hover:text-white hover:bg-slate-700`}>
              {eventName || "Événement"}
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
