import logoStrasbourg from "../assets/logo_strasbourg.png";
import type { PageKey } from "../hooks/useNavigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronLeft } from "@fortawesome/free-solid-svg-icons";

interface NavigationProps {
  currentPage: PageKey;
  onNavigate: (page: PageKey) => void;
  canGoBack?: boolean;
  onGoBack?: () => void;
  eventSelected: boolean;
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
  deselectEvent,
  eventName,
}: NavigationProps) {
  return (
    <nav className="sticky top-0 z-[100] w-full border-b border-gray-200 bg-slate-700 shadow-lg">
      {/* Barre d'accentuation supérieure */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary/60 to-transparent"></div>

      <div className="w-full px-2 sm:px-4">
        <div className="flex h-14 items-center gap-6">
          {/* Section Gauche : Terminal Branding */}
          <div className="flex items-center gap-6 flex-shrink-0">
            {canGoBack && onGoBack && (
              <button
                onClick={onGoBack}
                className="group flex h-8 w-8 items-center justify-center rounded-lg bg-slate-600 text-slate-300 hover:text-white transition-all border border-slate-500 hover:border-primary hover:bg-slate-500 cursor-pointer"
                aria-label="Retour"
              >
                <FontAwesomeIcon icon={faChevronLeft} className="h-4 w-4" />
              </button>
            )}

            <div
              className="flex items-center gap-3 cursor-pointer group"
              onClick={() => onNavigate("event")}
            >
              <div className="relative flex items-center justify-center">
                <div className="absolute inset-0 bg-primary/20 blur-md rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <img
                  src={logoStrasbourg}
                  alt="Logo"
                  className="relative h-7 w-auto object-contain brightness-110 group-hover:brightness-125 transition-all duration-300"
                />
              </div>
              <div className="flex flex-col leading-none">
                <span className="text-sm font-bold tracking-wider text-white uppercase">
                  Dedale
                </span>
                <span className="text-[9px] font-medium text-slate-400 tracking-wide uppercase mt-0.5">
                  Gestion Événements
                </span>
              </div>
            </div>
          </div>

          {/* Section Centre : Navigation */}
          <div className="flex-1 flex justify-center">
            <div className="flex items-center gap-2 px-2 py-1.5 bg-slate-800 rounded-lg border border-slate-600 shadow-md">
              {NAV_ITEMS.map(({ key, label }) => {
                const isActive = currentPage === key;
                const requiresEvent = key !== "event";
                const isDisabled = requiresEvent && !eventSelected;

                return (
                  <button
                    key={key}
                    onClick={() => onNavigate(key)}
                    disabled={isDisabled}
                    className={`relative px-4 py-2 text-[11px] font-semibold tracking-wide uppercase transition-all duration-200 rounded-md
                    ${isActive
                        ? "text-white bg-primary shadow-md"
                        : isDisabled
                          ? "text-slate-500 bg-slate-800 cursor-not-allowed opacity-50"
                          : "text-slate-300 hover:text-white hover:bg-slate-700"
                      }`}
                    title={isDisabled ? "Sélectionnez d'abord un événement" : ""}
                  >
                    <span className="relative z-10">{label}</span>
                    {isActive && (
                      <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent rounded-md"></div>
                    )}
                  </button>
                );
              })}
            </div>
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
