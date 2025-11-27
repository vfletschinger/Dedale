import { useEffect, useState } from "react";
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import * as path from '@tauri-apps/api/path';
import Database from '@tauri-apps/plugin-sql';
import Accueil from "./components/Accueil";
import Equipes from "./components/Equipe";
import Map from "./components/Map";
import Event from "./components/Events";
import AdminForm from "./components/AdminForm";

import logoStrasbourg from "./assets/logo_strasbourg.png";

// --- Composant de Navigation ---
function Navigation({ page, setPage }: { page: string; setPage: (page: string) => void }) {
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
                Dedale Sports
              </h1>
            </div>
          </div>

          {/* Center - Modern Navigation Buttons */}
          <div className="flex items-center space-x-2">
            {[
              { key: "event", label: "Evenements" },
              { key: "map", label: "Carte" },
              { key: "equipe", label: "Equipes" },
              { key: "transfer", label: "Donnees" }
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
                  <span>{item.label}</span>
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
  const [page, setPage] = useState("home");
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [db, setDb] = useState<Database | null>(null);
  const [error, setError] = useState("");
  const [firstLaunch, setFirstLaunch] = useState(false);

  const handleEventClick = (eventId: number) => {
    setSelectedEventId(eventId);
    setPage("map");
  };

  // Check first launch
  useEffect(() => {
    const unlisten = listen('first-launch', () => {
      setFirstLaunch(true);
    });

    (async () => {
      try {
        const isFirst: boolean = await invoke('is_first_launch_cmd');
        if (isFirst) {
          setFirstLaunch(true);
        }
      } catch (e) {
        // ignore
      }
    })();

    return () => {
      unlisten.then(f => f()).catch(() => {});
    };
  }, []);

  async function handleCreateAdmin(username: string, password: string) {
    try {
      await invoke('create_initial_admin_cmd', { username, password });
      setFirstLaunch(false);
    } catch (e) {
      console.error('create admin failed', e);
    }
  }

  // Connexion BDD au demarrage
  useEffect(() => {
    const initDb = async () => {
      try {
        const appDataPath = await path.appDataDir();
        const dbPath = await path.join(appDataPath, 'mydatabase.db');
        const dbInstance = await Database.load(`sqlite:${dbPath}`);
        setDb(dbInstance);
      } catch (e: any) {
        console.error("Erreur connexion BDD:", e);
        setError("Erreur de connexion BDD: " + e.message);
      }
    };
    initDb();
  }, []);

  const renderPage = () => {
    switch (page) {
      case "equipe":
        return <Equipes />;
      case "map":
        return <Map selectedEventId={selectedEventId} />;
      case "event":
        return <Event onEventClick={handleEventClick} onEventsLoaded={setEvents} />;
      case "home":
        return <Accueil />;
      default:
        return <Accueil />;
    }
  };

  // Si c'est le premier lancement, afficher le formulaire admin
  if (firstLaunch) {
    return (
      <div className="w-full min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50 font-sans flex items-center justify-center">
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-8 max-w-md w-full mx-4">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
            Configuration initiale
          </h2>
          <p className="mb-6 text-gray-600">Creez le compte administrateur pour continuer.</p>
          <AdminForm onSubmit={handleCreateAdmin} />
        </div>
      </div>
    );
  }

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

      {page === "map" ? (
        <div className="relative z-10" style={{ height: "calc(100vh - 5rem)" }}>
          <Map selectedEventId={selectedEventId} />
        </div>
      ) : (
        <main className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-8">
          <div className="bg-white/60 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-8 min-h-[calc(100vh-12rem)]">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 via-transparent to-purple-50/50 rounded-3xl -z-10"></div>
              {renderPage()}
            </div>
          </div>
        </main>
      )}
      
      {page === "event" && (
        <div className="fixed bottom-6 right-6 z-50 bg-white/80 backdrop-blur-md rounded-2xl shadow-xl border border-white/30 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
              {events.length}
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-800">Total Events</div>
              <div className="text-xs text-gray-500">
                {events.filter((e: any) => e.statut === 'active' || e.statut === 'Actif').length} actifs
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
