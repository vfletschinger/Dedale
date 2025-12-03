import logoStrasbourg from "../assets/logo_strasbourg.png";
import type { PageKey } from "../hooks/useNavigation";

interface NavigationProps {
  currentPage: PageKey;
  onNavigate: (page: PageKey) => void;
  canGoBack?: boolean;
  onGoBack?: () => void;
}

const navItems: { key: PageKey; label: string }[] = [
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
    <nav className="bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 backdrop-blur-lg border-b border-white/10 shadow-2xl">
      <div className="mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-20 items-center justify-between">
          {/* Left side - Logo + Back button */}
          <div className="flex items-center space-x-3">
            {canGoBack && onGoBack && (
              <button
                type="button"
                onClick={onGoBack}
                className="p-2 rounded-xl text-white/80 hover:text-white bg-white/10 hover:bg-white/20 transition-all duration-200"
                title="Retour"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
            )}
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-400 to-purple-600 rounded-full blur opacity-30"></div>
              <img
                src={logoStrasbourg}
                alt="Logo"
                className="relative h-12 w-auto rounded-full shadow-lg ring-2 ring-white/20"
              />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-xl font-bold bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">
                Dedale Sports
              </h1>
            </div>
          </div>

          {/* Center - Navigation Buttons */}
          <div className="flex items-center space-x-2">
            {navItems.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`group relative px-4 py-2 rounded-2xl font-medium transition-all duration-300 transform hover:scale-105 ${currentPage === item.key
                  ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/30 ring-2 ring-white/20"
                  : "text-white/80 hover:text-white bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/10 hover:border-white/30"
                  }`}
                onClick={() => onNavigate(item.key)}
              >
                <span className="flex items-center space-x-2">
                  <span>{item.label}</span>
                </span>
                {currentPage === item.key && (
                  <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-white rounded-full"></div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Glow effect at the bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-400 to-transparent opacity-50"></div>
    </nav>
  );
}
