import { useState } from "react";
import Accueil from "./components/Accueil";
import Equipes from "./components/Equipe";
import Map from "./components/Map";
import Event from "./components/Event";
import DataTransfer from "./components/DataTransfer";
import logoStrasbourg from "./assets/logo_strasbourg.png";

// --- Composant de Navigation ---
// global.d.ts


function Navigation({ page, setPage }: { page: string, setPage: (page: string) => void }) {

  return (
    <nav className="bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 backdrop-blur-lg border-b border-white/10 shadow-2xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-20 items-center justify-between">

          {/* Left side - Logo with modern styling */}
          <div className="flex items-center space-x-3">
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
                Dédale Sports
              </h1>
            </div>
          </div>

          {/* Center - Modern Navigation Buttons */}
          <div className="flex items-center space-x-2">
            {[
              { key: "event", label: " Événements"},
              { key: "map", label: " Carte"},
              { key: "equipe", label: " Équipes"},
              { key: "transfer", label: " Données"}
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                className={`group relative px-4 py-2 rounded-2xl font-medium transition-all duration-300 transform hover:scale-105 ${
                  page === item.key
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/30 ring-2 ring-white/20'
                    : 'text-white/80 hover:text-white bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/10 hover:border-white/30'
                }`}
                onClick={() => setPage(item.key)}
              >
                <span className="flex items-center space-x-2">
                  <span className="hidden sm:inline">{item.label.split(' ')[1]}</span>
                </span>
                {page === item.key && (
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

function App() {
  const [page, setPage] = useState("equipe");
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  
  const handleEventClick = (eventId: number) => {
    setSelectedEventId(eventId);
    setPage("map");
  };
  
  const renderPage = () => {
  
    switch (page) {
      case "equipe":
        return <Equipes />;
      case "map":
        return <Map selectedEventId={selectedEventId} />;
      case "event":
        return <Event onEventClick={handleEventClick} onEventsLoaded={setEvents} />;
      case "transfer":
        return <DataTransfer />;
      case "home":
        return <Accueil />;
      default:
        return <Equipes />;
    }
  };

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50 font-sans relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] -z-10"></div>
      <div className="absolute top-0 left-1/4 w-72 h-72 bg-blue-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
      <div className="absolute top-0 right-1/4 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse animation-delay-1000"></div>
      <div className="absolute bottom-0 left-1/3 w-72 h-72 bg-indigo-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse animation-delay-2000"></div>
      
      <header className="relative z-10">
        <Navigation page={page} setPage={setPage} />
      </header>

      {/* Rendu conditionnel selon la page */}
      {page === "map" ? (
        // La carte prend toute la place disponible
        <div className="relative z-10" style={{ height: "calc(100vh - 5rem)" }}>
          <Map selectedEventId={selectedEventId} />
        </div>
      ) : (
        // Autres pages avec le conteneur normal
        <main className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-8">
          <div className="bg-white/60 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-8 min-h-[calc(100vh-12rem)]">
            <div className="relative">
              {/* Subtle inner glow */}
              <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 via-transparent to-purple-50/50 rounded-3xl -z-10"></div>
              {renderPage()}
            </div>
          </div>
        </main>
      )}
      
      {/* Floating stats card - fixe sur toute la page */}
      {page === "event" && events.length > 0 && (
        <div className="fixed bottom-6 right-6 z-50 bg-white/80 backdrop-blur-md rounded-2xl shadow-xl border border-white/30 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
              {events.length}
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-800">Total Events</div>
              <div className="text-xs text-gray-500">
                {events.filter((e: any) => e.status === 'active').length} actifs
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;