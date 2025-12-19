import logoStrasbourg from "../assets/logo_strasbourg.png";
import type { PageKey } from "../hooks/useNavigation";

interface NavigationProps {
  currentPage: PageKey;
  onNavigate: (page: PageKey) => void;
  canGoBack?: boolean;
  onGoBack?: () => void;
}

const NAV_ITEMS: { key: PageKey; label: string }[] = [
  { key: "event", label: "Événements" },
  { key: "map", label: "Carte" },
  { key: "team", label: "Équipes" },
  { key: "person", label: "Personnes" },
  { key: "data", label: "Données" },
];

export default function Navigation({
  currentPage,
  onNavigate,
  canGoBack,
  onGoBack,
}: NavigationProps) {
  return (
    <nav className="sticky top-0 z-[100] w-full border-b border-gray-200 bg-slate-700 shadow-lg">
      {/* Barre d'accentuation supérieure */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-blue-500/60 to-transparent"></div>

      <div className="mx-auto max-w-[1600px] px-4 sm:px-6">
        <div className="flex h-14 items-center justify-between">
          {/* Section Gauche : Terminal Branding */}
          <div className="flex items-center gap-6">
            {canGoBack && onGoBack && (
              <button
                onClick={onGoBack}
                className="group flex h-8 w-8 items-center justify-center rounded-lg bg-slate-600 text-slate-300 hover:text-white transition-all border border-slate-500 hover:border-blue-400 hover:bg-slate-500"
                aria-label="Retour"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
            )}

            <div
              className="flex items-center gap-3 cursor-pointer group"
              onClick={() => onNavigate("event")}
            >
              <div className="relative flex items-center justify-center">
                <div className="absolute inset-0 bg-blue-500/20 blur-md rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
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
          <div className="flex items-center gap-2 px-2 py-1.5 bg-slate-800 rounded-lg border border-slate-600 shadow-md">
            {NAV_ITEMS.map(({ key, label }) => {
              const isActive = currentPage === key;
              return (
                <button
                  key={key}
                  onClick={() => onNavigate(key)}
                  className={`relative px-4 py-2 text-[11px] font-semibold tracking-wide uppercase transition-all duration-200 rounded-md
                    ${
                      isActive
                        ? "text-white bg-blue-600 shadow-md"
                        : "text-slate-300 hover:text-white hover:bg-slate-700"
                    }`}
                >
                  <span className="relative z-10">{label}</span>
                  {isActive && (
                    <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent rounded-md"></div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Section Droite : Informations système */}
          <div className="flex items-center gap-4">
            <div className="hidden lg:flex items-center gap-4 text-[10px] font-semibold tracking-wide">
              <div className="flex flex-col items-end gap-1 px-2 py-1 bg-slate-800 rounded border border-slate-600">
                <span className="text-slate-400 text-[9px]">
                  Base de données
                </span>
                <span className="text-blue-400">0.42ms</span>
              </div>
              <div className="h-6 w-[1px] bg-slate-600"></div>
              <div className="flex flex-col items-end gap-1 px-2 py-1 bg-slate-800 rounded border border-slate-600">
                <span className="text-slate-400 text-[9px]">Système</span>
                <span className="text-green-400">Active</span>
              </div>
            </div>

            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-500 bg-slate-600 group cursor-help hover:bg-slate-500 transition-all">
              <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_#22c55e] group-hover:scale-125 transition-transform"></div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
