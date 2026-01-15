import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";

import { useNavigation } from "./hooks/useNavigation";
import Navigation from "./components/layout/Navigation";
import Data from "./components/Data";
import TeamsAndPersons from "./components/features/teams/TeamsAndPersons";
import Map from "./components/features/map/Map";
import Event from "./components/features/events/Events";
import AdminForm from "./components/AdminForm";
import Planning from "./components/features/planning/Planning";
import { Event as AppEvent } from "./types";

import LoadingScreen from "./components/LoadingScreen";
import { Toaster } from 'react-hot-toast';

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
  const { currentPage, navigate, goBack, canGoBack, hasVisited, reset } = useNavigation("event");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [firstLaunch, setFirstLaunch] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  const handleEventClick = (eventId: string) => {
    setSelectedEventId(eventId);
    navigate("map");
  };

  // Check first launch
  useEffect(() => {
    const unlisten = listen('first-launch', () => {
      setFirstLaunch(true);
      setIsInitializing(false);
    });

    (async () => {
      try {
        const isFirst: boolean = await invoke('is_first_launch_cmd');
        if (isFirst) {
          setFirstLaunch(true);
        }
      } catch {
        // ignore
      } finally {
        setTimeout(() => {
          setIsInitializing(false);
        }, 500);
      }
    })();

    return () => {
      unlisten.then(f => typeof f === 'function' && f()).catch(() => { });
    };
  }, []);

  useEffect(() => {
    // Si on demande d'aller voir une équipe ou une personne
    const unlistenTeam = listen('navigate-to-team', () => {
      navigate("team-person");
    });

    const unlistenPerson = listen('navigate-to-person', () => {
      navigate("team-person");
    });

    // Si on demande d'aller voir un event
    const unlistenMap = listen<{ eventId: string }>('navigate-to-map', (event) => {
      const targetEventId = event.payload.eventId;
      setSelectedEventId(targetEventId);
      navigate("map");
    });

    return () => {
      unlistenTeam.then(f => typeof f === 'function' && f());
      unlistenPerson.then(f => typeof f === 'function' && f());
      unlistenMap.then(f => typeof f === 'function' && f());
    };
  }, [navigate]);

  async function handleCreateAdmin(username: string, password: string) {
    try {
      await invoke('create_initial_admin_cmd', { username, password });
      setFirstLaunch(false);
    } catch (e) {
      console.error('create admin failed', e);
    }
  }

  function handleDeselection() {
    setSelectedEventId(null);
    navigate("event");
    reset();
  }

  if (isInitializing) {
    return <LoadingScreen />;
  }

  // Si c'est le premier lancement, afficher le formulaire admin
  if (firstLaunch) {
    return (
      <div className="w-full min-h-screen bg-linear-to-br from-slate-50 via-indigo-50 to-purple-50 font-sans flex items-center justify-center">
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-8 max-w-md w-full mx-4">
          <h2 className="text-2xl font-bold bg-linear-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
            Configuration initiale
          </h2>
          <p className="mb-6 text-gray-600">Creez le compte administrateur pour continuer.</p>
          <AdminForm onSubmit={handleCreateAdmin} />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-linear-to-br from-slate-50 via-indigo-50 to-purple-50 font-sans relative overflow-hidden">
      <Toaster position="top-center" reverseOrder={false} />
      <header className="relative z-10">
        <Navigation
          currentPage={currentPage}
          onNavigate={(page) => {
            // Empêcher la navigation vers map, team-person, data ou planning si aucun événement sélectionné
            if (!selectedEventId && (page === "map" || page === "team-person" || page === "data" || page === "planning")) {
              alert("Veuillez sélectionner un événement avant d'accéder à cette page.");
              return;
            }
            navigate(page);
          }}
          canGoBack={canGoBack}
          onGoBack={goBack}
          eventSelected={selectedEventId === null || undefined ? false : true}
          eventName={events.find(e => String(e.id) === selectedEventId)?.name}
          deselectEvent={handleDeselection}
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
        <div className="relative">
          <div className="absolute inset-0 bg-linear-to-br from-blue-50/50 via-transparent to-purple-50/50 rounded-3xl -z-10"></div>


          {/* Events - kept mounted once visited */}
          {hasVisited("event") && (
            <PageWrapper isVisible={currentPage === "event"}>
              <Event onEventClick={handleEventClick} onEventsLoaded={setEvents} />
            </PageWrapper>
          )}

          {/* Teams and Persons - kept mounted once visited */}
          {selectedEventId && hasVisited("team-person") && (
            <PageWrapper isVisible={currentPage === "team-person"}>
              <TeamsAndPersons activeEventId={selectedEventId} />
            </PageWrapper>
          )}

          {/* Data - kept mounted once visited */}
          {hasVisited("data") && (
            <PageWrapper isVisible={currentPage === "data"}>
              <Data selectedEventId={selectedEventId} />
            </PageWrapper>
          )}

          {/* Planning - kept mounted once visited */}
          {selectedEventId && hasVisited("planning") && (
            <PageWrapper isVisible={currentPage === "planning"}>
              <Planning activeEventId={selectedEventId} />
            </PageWrapper>
          )}
        </div>
      </main>

      {currentPage === "event" && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-900 rounded-2xl shadow-xl border border-gray-800 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center text-gray-900 font-bold">
              {events.length}
            </div>
            <div>
              <div className="text-sm font-semibold text-white">Événements au total</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
