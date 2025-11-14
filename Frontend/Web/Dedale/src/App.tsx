import { useEffect, useState } from "react";
import Database from '@tauri-apps/plugin-sql';
// Les imports des composants et du CSS ont été supprimés car tout est dans ce fichier.
// L'environnement de prévisualisation injecte Tailwind automatiquement.

import Accueil from "./components/Accueil";
import Equipes from "./components/Equipe";
import Map from "./components/Map";

// --- Composant de Navigation ---

function Navigation({ page, setPage }: { page: string, setPage: (page: string) => void }) {


 return (
  <nav className="bg-[#171c22]"> {/* Couleur principale 65% */}
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="flex h-16 items-center justify-between">
        
        {/* Left side - Logo */}
        <div className="flex-shrink-0">
          <img 
            src="./assets/logo_strasbourg.png" 
            alt="Logo" 
            className="h-10 w-auto"
          />
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
          </button>
        </div>
      </div>
    </div>
  </nav>
);


}

// --- Composant Principal de l'App ---

function App() {
  const [db, setDb] = useState<Database | null>(null);
  const [page, setPage] = useState('home');
  const [error, setError] = useState('');

  // Connexion BDD au démarrage
  useEffect(() => {
    const initDb = async () => {
      try {
        const dbInstance = await Database.load('sqlite:mydatabase.db');
        setDb(dbInstance);
      } catch (e: any) {
        console.error("Erreur connexion BDD:", e);
        // On simule que la BDD est connectée pour que l'aperçu fonctionne
        // L'erreur s'affichera sur l'erreur de BDD
        setError("Erreur de connexion BDD (simulée pour aperçu): " + e.message);
        // Dans un environnement de prévisualisation, @tauri-apps/plugin-sql ne fonctionnera pas.
        // On pourrait mettre une valeur "mock" si on voulait que l'UI s'affiche quand même.
        // Pour l'instant, on laisse l'erreur s'afficher.
      }
    };
    initDb();
  }, []);

  // Choisir la page à afficher
  const renderPage = () => {
    if (error) {
      return <p className="text-red-600 text-center">Erreur: {error}</p>;
    }
    if (!db) {
      return (
        <div className="flex justify-center items-center h-full">
           {/* Simple spinner de chargement Tailwind */}
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <p className="ml-4 text-gray-500">Connexion à la base de données...</p>
        </div>
      );
    }

    switch (page) {
      case 'home': return <Accueil />;
      case 'map': return <Map />;
      case 'equipe': return <Equipes />;
      default: return <Accueil />;
    }
  };

  return (
   <div className="w-full min-h-screen bg-gray-50 font-sans">
  <header className="text-center mb-8">
    <Navigation page={page} setPage={setPage} />
  </header>

  <main className="bg-white p-6 rounded-lg shadow-md h-full">
    {renderPage()}
  </main>
</div>

  );
}

export default App;