import { invoke } from "@tauri-apps/api/core";
import { useState, useEffect } from "react";

function Events({ onEventClick, onEventsLoaded }: { onEventClick?: (eventId: number) => void, onEventsLoaded?: (events: any[]) => void }) {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    dateDebut: "",
    dateFin: "",
    statuts: "planned",
    geometry: ""
  });

  const loadEvents = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log(" Chargement des événements...");
       const eventsData = {}
       //await invoke("fetch_events");
      console.log(" Événements reçus:", eventsData);
      const eventArray = eventsData as any[];
      setEvents(eventArray);
      onEventsLoaded && onEventsLoaded(eventArray);
    } catch (err) {
      console.error("❌ Erreur lors du chargement des événements:", err);
      setError((err as any)?.message || "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  // Charger les événements au montage du composant
  useEffect(() => {
    loadEvents();
  }, []);

  const handleCreateEvent = async () => {
    try {
      // Validation des champs
      if (formData.name.trim() === "") {
        alert("Le nom de l'événement est requis !");
        return;
      }

      if (formData.dateDebut === "" || formData.dateFin === "") {
        alert("Les dates de début et de fin sont requises !");
        return;
      }

      if (new Date(formData.dateDebut) >= new Date(formData.dateFin)) {
        alert("La date de fin doit être postérieure à la date de début !");
        return;
      }

      const newEvent = {
        ...formData,
        timestamp: new Date().toISOString()
      };
      
      console.log(" Création d'un nouvel événement...", newEvent);
      await invoke("insert_event", { event: newEvent });
      console.log(" Événement créé avec succès");
      
      // Réinitialiser le formulaire
      setFormData({
        name: "",
        description: "",
        dateDebut: "",
        dateFin: "",
        statuts: "planned",
        geometry: ""
      });
      setShowCreateForm(false);
      loadEvents();
    } catch (err) {
      console.error("❌ Erreur lors de la création:", err);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-2">Chargement des événements...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        <h3 className="font-bold">Erreur</h3>
        <p>{error}</p>
        <button 
          onClick={loadEvents}
          className="mt-2 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        >
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-6">
      {/* Header moderne avec glassmorphism */}
      <div className="bg-white/70 backdrop-blur-md rounded-2xl shadow-xl border border-white/20 p-6 mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
               Gestion des Événements
            </h1>
            <p className="text-gray-600 mt-1">Organisez et suivez vos événements sportifs</p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => setShowCreateForm(true)}
              className="group px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-xl hover:from-purple-600 hover:to-pink-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              <span className="flex items-center gap-2">
                 <span className="group-hover:scale-105 transition-transform">Créer</span>
              </span>
            </button>
            <button 
              onClick={async () => {
                try {
                  console.log("🌱 Génération de données d'exemple...");
                  await invoke("seed_database");
                  console.log("✅ Données générées avec succès");
                  loadEvents();
                } catch (err) {
                  console.error("❌ Erreur lors de la génération:", err);
                }
              }}
              className="group px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              <span className="flex items-center gap-2">
                 <span className="group-hover:scale-105 transition-transform">Générer</span>
              </span>
            </button>
            <button 
              onClick={loadEvents}
              className="group px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              <span className="flex items-center gap-2">
                 <span className="group-hover:rotate-180 transition-transform duration-300">↻</span>
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Formulaire de création d'événement */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                ➕ Nouvel Événement
              </h2>
              <button 
                onClick={() => setShowCreateForm(false)}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleCreateEvent(); }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nom de l'événement *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Ex: Marathon de Strasbourg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                  placeholder="Description de l'événement..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date de début *
                </label>
                <input
                  type="date"
                  name="dateDebut"
                  value={formData.dateDebut}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date de fin *
                </label>
                <input
                  type="date"
                  name="dateFin"
                  value={formData.dateFin}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Statut
                </label>
                <select
                  name="statuts"
                  value={formData.statuts}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="planned">🔵 Planifié</option>
                  <option value="active">🟢 Actif</option>
                  <option value="completed">🟣 Terminé</option>
                  <option value="cancelled">🔴 Annulé</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Géométrie (optionnel)
                </label>
                <textarea
                  name="geometry"
                  value={formData.geometry}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                  placeholder="GeoJSON ou WKT définissant les zones de couverture, tracé de course, etc."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-xl hover:from-purple-600 hover:to-pink-700 transition-all duration-300"
                >
                  Créer l'événement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {events.length === 0 ? (
        <div className="bg-white/60 backdrop-blur-md rounded-2xl shadow-xl border border-white/20 p-12 text-center">
          <div className="w-24 h-24 mx-auto mb-4 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center">
            <span className="text-4xl">📅</span>
          </div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">Aucun événement</h3>
          <p className="text-gray-500">Créez votre premier événement pour commencer</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((event: any) => (
            <div 
              key={event.id}
              className="group bg-white/80 backdrop-blur-md rounded-2xl shadow-lg hover:shadow-2xl border border-white/30 overflow-hidden transition-all duration-300 hover:-translate-y-2 hover:rotate-1"
            >
              {/* Header de la carte avec gradient */}
              <div className="bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 h-2"></div>
              
              <div className="p-6">
                {/* Status badge */}
                <div className="flex justify-between items-start mb-4">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                    event.status === 'active' 
                      ? 'bg-green-100 text-green-800 ring-1 ring-green-600/20' 
                      : event.status === 'planned'
                      ? 'bg-blue-100 text-blue-800 ring-1 ring-blue-600/20'
                      : event.status === 'completed'
                      ? 'bg-purple-100 text-purple-800 ring-1 ring-purple-600/20'
                      : 'bg-gray-100 text-gray-800 ring-1 ring-gray-600/20'
                  }`}>
                    {event.status === 'active' && '🟢'} 
                    {event.status === 'planned' && '🔵'} 
                    {event.status === 'completed' && '🟣'} 
                    {event.status === 'cancelled' && '🔴'} 
                    {event.status}
                  </span>
                  
                  <div className="text-xs text-gray-400">
                    #{event.id}
                  </div>
                </div>

                {/* Titre avec icône selon le type */}
                <h3 className="text-xl font-bold text-gray-800 mb-3 group-hover:text-blue-600 transition-colors">
                  <span className="mr-2">
                    {event.event_type === 'Marathon' && '🏃‍♂️'}
                    {event.event_type === 'Cyclisme' && '🚴‍♂️'}
                    {event.event_type === 'Trail' && '🥾'}
                    {!['Marathon', 'Cyclisme', 'Trail'].includes(event.event_type) && '🏆'}
                  </span>
                  {event.name || `Événement #${event.id}`}
                </h3>

                {/* Type d'événement */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full"></div>
                  <span className="text-sm font-medium text-gray-600">
                    {event.event_type || 'Type non défini'}
                  </span>
                </div>

                {/* Description */}
                {event.description && (
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2 leading-relaxed">
                    {event.description}
                  </p>
                )}

                {/* Footer avec statistiques */}
                <div className="border-t border-gray-100 pt-4 mt-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        📐 <strong>{event.geometries?.length || 0}</strong>
                      </span>
                      <span className="flex items-center gap-1">
                        📅 {new Date(event.timestamp).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                    
                    <button 
                      onClick={() => onEventClick && onEventClick(event.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-r from-blue-500 to-purple-600 text-white px-3 py-1 rounded-full text-xs hover:from-blue-600 hover:to-purple-700 transform hover:scale-105"
                    >
                      Voir sur la carte
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
    </div>
  );
}

export default Events;