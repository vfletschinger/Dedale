import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import * as path from "@tauri-apps/api/path";
import Database from "@tauri-apps/plugin-sql";

import { useNavigation } from "./hooks/useNavigation";
import Navigation from "./components/Navigation";
import Data from "./components/Data";
import Teams from "./components/Teams";
import Map from "./components/Map";
import Event from "./components/Events";
import AdminForm from "./components/AdminForm";
import Persons from "./components/Persons";

// Wrapper pour cacher une page tout en la gardant montée
function PageWrapper({
  isVisible,
  isFullHeight,
  children,
}: {
  isVisible: boolean;
  isFullHeight?: boolean;
  children: React.ReactNode;
}) {
  if (isFullHeight) {
    return (
      <div
        className="relative z-10"
        style={{
          height: "calc(100vh - 5rem)",
          display: isVisible ? "block" : "none",
          width: "100%",
        }}
      >
        {children}
      </div>
    );
  }

  return (
    <div style={{ display: isVisible ? "block" : "none" }}>
      {children}
    </div>
  );
}

function App() {
  const { currentPage, navigate, goBack, canGoBack, hasVisited } = useNavigation("event");
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [db, setDb] = useState<Database | null>(null);
  const [error, setError] = useState("");
  const [firstLaunch, setFirstLaunch] = useState(false);

  const handleEventClick = (eventId: number) => {
    setSelectedEventId(eventId);
    navigate("map");
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
      unlisten.then(f => f()).catch(() => { });
    };
  }, []);

  useEffect(() => {
    // Si on demande d'aller voir une équipe
    const unlistenTeam = listen('navigate-to-team', () => {
      navigate("team");
    });

    // Si on demande d'aller voir une personne
    const unlistenPerson = listen('navigate-to-person', () => {
      navigate("person");
    });

    // Si on demande d'aller voir un event
    const unlistenMap = listen<any>('navigate-to-map', (event) => {
      const targetEventId = event.payload.eventId;
      setSelectedEventId(targetEventId);
      navigate("map");
    });

    return () => {
      unlistenTeam.then(f => f());
      unlistenPerson.then(f => f());
      unlistenMap.then(f => f());
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
        <Navigation
          currentPage={currentPage}
          onNavigate={navigate}
          canGoBack={canGoBack}
          onGoBack={goBack}
        />
      </header>

      {/* Map - full height, kept mounted once visited */}
      {hasVisited("map") && (
        <PageWrapper isVisible={currentPage === "map"} isFullHeight>
          <Map selectedEventId={selectedEventId} />
        </PageWrapper>
      )}

      {/* Other pages - wrapped in container */}
      <main
        className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-8"
        style={{ display: currentPage === "map" ? "none" : "block" }}
      >
        <div className="bg-white/60 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-8 min-h-[calc(100vh-12rem)]">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 via-transparent to-purple-50/50 rounded-3xl -z-10"></div>


            {/* Events - kept mounted once visited */}
            {hasVisited("event") && (
              <PageWrapper isVisible={currentPage === "event"}>
                <Event onEventClick={handleEventClick} onEventsLoaded={setEvents} />
              </PageWrapper>
            )}

            {/* Teams - kept mounted once visited */}
            {hasVisited("team") && (
              <PageWrapper isVisible={currentPage === "team"}>
                <Teams />
              </PageWrapper>
            )}

            {/* Persons - kept mounted once visited */}
            {hasVisited("person") && (
              <PageWrapper isVisible={currentPage === "person"}>
                <Persons />
              </PageWrapper>
            )}

            {/* Data - kept mounted once visited */}
            {hasVisited("data") && (
              <PageWrapper isVisible={currentPage === "data"}>
                <Data />
              </PageWrapper>
            )}
          </div>
        </div>
      </main>

      {currentPage === "event" && (
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
