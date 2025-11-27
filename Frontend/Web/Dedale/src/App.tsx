import { useEffect, useState } from "react";
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import * as path from '@tauri-apps/api/path';
import Database from '@tauri-apps/plugin-sql';
import Accueil from "./components/Accueil";
import Equipes from "./components/Equipe";
import Map from "./components/Map";
import AdminForm from "./components/AdminForm";

import logoStrasbourg from "./assets/logo_strasbourg.png";

// --- Composant de Navigation ---
// global.d.ts


function Navigation({ setPage }: { setPage: (page: string) => void }) {

  return (
    <nav className="bg-[#171c22]"> {/* Couleur principale 65% */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">

          {/* Left side - Logo */}
          <div className="shrink-0">
            <img
              src={logoStrasbourg}
              alt="Logo"
              className="h-30 w-auto"
            />
          </div>

          {/* Right side - Hamburger menu for mobile */}
          <div className="flex sm:hidden">
            <button
              type="button"
              className="inline-flex items-center justify-center p-2 rounded-md text-[#ffffff] hover:bg-[#2ad783] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2ad783]"
              aria-controls="mobile-menu"
              aria-expanded="false"
            >
              <span className="sr-only">Open main menu</span>
              {/* Menu open icon */}
              <svg
                className="block h-6 w-6"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
              {/* Menu close icon */}
              <svg
                className="hidden h-6 w-6"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
              Creer un pdf
            </button>
          </div>

          {/* Center - Navigation Buttons */}
          <div className="flex space-x-4">
            <button
              type="button"
              className="px-3 py-2 rounded-md text-[#ffffff] bg-[#20272f] hover:bg-[#2ad783] transition font-medium"
              onClick={() => setPage("home")}
            >
              Accueil
            </button>

            <button
              type="button"
              className="px-3 py-2 rounded-md text-[#ffffff] bg-[#20272f] hover:bg-[#2ad783] transition font-medium"
              onClick={() => setPage("map")}
            >
              Map
            </button>

            <button
              type="button"
              className="px-3 py-2 rounded-md text-[#ffffff] bg-[#20272f] hover:bg-[#2ad783] transition font-medium"
              onClick={() => setPage("equipe")}
            >
              Equipes
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}

function App() {
  const [db, setDb] = useState<Database | null>(null);
  const [page, setPage] = useState("home");
  const [error, setError] = useState("");
  const [firstLaunch, setFirstLaunch] = useState(false);

  //Check first launch
  useEffect(() => {
    // Écoute l'event émis par Rust
    const unlisten = listen('first-launch', () => {
      setFirstLaunch(true);
    });
    // Fallback: also query the backend directly in case the event was emitted
    // before the frontend listener was ready.
    (async () => {
      try {
        const isFirst: boolean = await invoke('is_first_launch_cmd');
        if (isFirst) {
          setFirstLaunch(true);
        }
      } catch (e) {
        // ignore: the event listener may suffice; errors are non-fatal
      }
    })();

    return () => {
      unlisten.then(f => f()).catch(() => {});
    };
  }, []);

  async function handleCreateAdmin(username: string, password: string) {
    try {
      await invoke('create_initial_admin_cmd', { username, password });
      // Admin créé -> masquer le form et continuer vers l'app
      setFirstLaunch(false);
    } catch (e) {
      console.error('create admin failed', e);
      // afficher message d'erreur à l'utilisateur
    }
  }

  // Connexion BDD au démarrage
  useEffect(() => {
    const initDb = async () => {
      try {
        // Load DB from the app data directory to match backend
        const appDataPath = await path.appDataDir();
        const dbPath = await path.join(appDataPath, 'mydatabase.db');
        // Database.load expects a connection URL like `sqlite:<path>`
        const dbInstance = await Database.load(`sqlite:${dbPath}`);
        setDb(dbInstance);
      } catch (e: any) {
        console.error("Erreur connexion BDD:", e);
        setError("Erreur de connexion BDD (simulée pour aperçu): " + e.message);
      }
    };
    initDb();
  }, []);

  const renderPage = () => {
    if (error) {
      return <p className="text-red-600 text-center">Erreur: {error}</p>;
    }
    if (!db) {
      return (
        <div className="flex justify-center items-center h-full">
          {/* Simple spinner de chargement Tailwind */}
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <p className="ml-4 text-gray-500">
            Connexion à la base de données...
          </p>
        </div>
      );
    }

    switch (page) {
      case "home":
        return <Accueil />;
      case "map":
        return <Map />;
      case "equipe":
        return <Equipes />;
      default:
        return <Accueil />;
    }
  };

  return (
    <div className="w-full min-h-screen bg-gray-50 font-sans">
      <header className="text-center mb-8">
        <Navigation setPage={setPage} />
      </header>

      <main className="bg-white p-6 rounded-lg shadow-md h-full">
        {firstLaunch ? (
          <div className="max-w-md mx-auto">
            <h2 className="text-2xl font-semibold mb-4">Configuration initiale</h2>
            <p className="mb-4 text-gray-600">Créez le compte administrateur pour continuer.</p>
            <AdminForm onSubmit={handleCreateAdmin} />
          </div>
        ) : (
          renderPage()
        )}
      </main>
    </div>
  );
}

export default App;