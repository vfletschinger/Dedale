import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useState, useEffect } from "react";

// Types
interface Event {
  id: number;
  name: string;
  description: string;
  dateDebut: string;
  dateFin: string;
  statut: string;
  geometry: string;
}

interface EventsProps {
  onEventClick?: (eventId: number) => void;
  onEventsLoaded?: (events: Event[]) => void;
}

const formatDate = (dateStr: string): string => {
  if (!dateStr) return "Non définie";
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric"
    });
  } catch {
    return dateStr;
  }
};


function Events({ onEventClick, onEventsLoaded }: EventsProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    dateDebut: "",
    dateFin: "",
    statut: "planned",
    geometry: ""
  });
  
  // État pour le QR code de réception
  const [receiveQrCode, setReceiveQrCode] = useState<string | null>(null);
  const [receivingEventId, setReceivingEventId] = useState<number | null>(null);
  const [receiveStatus, setReceiveStatus] = useState<string>("En attente...");
  const [pointsReceived, setPointsReceived] = useState<number>(0);

  const loadEvents = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log("🔄 Chargement des événements...");
      const eventsData = await invoke<Event[]>("fetch_events");
      console.log("📊 Événements reçus:", eventsData);
      setEvents(eventsData);
      if (onEventsLoaded) onEventsLoaded(eventsData);
    } catch (err: unknown) {
      console.error("❌ Erreur lors du chargement des événements:", err);
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateEvent = async () => {
    try {
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
        statut: "planned",
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

  const handleDeleteEvent = async (eventId: number) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cet événement ?")) {
      return;
    }
    try {
      console.log(" Suppression de l'événement:", eventId);
      await invoke("delete_event", { eventId });
      console.log("✅ Événement supprimé");
      loadEvents();
    } catch (err) {
      console.error("❌ Erreur lors de la suppression:", err);
      alert("Erreur lors de la suppression de l'événement");
    }
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
    <div className="p-6 bg-white rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800"> Événements</h2>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          {showCreateForm ? "Annuler" : "Créer un événement"}
        </button>
      </div>

      {/* Formulaire de création */}
      {showCreateForm && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
          <h3 className="text-lg font-semibold mb-4">Nouvel événement</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom de l'événement *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Nom de l'événement"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Statut
              </label>
              <select
                name="statut"
                value={formData.statut}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="planned">Planifié</option>
                <option value="active">Actif</option>
                <option value="completed">Terminé</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date de début *
              </label>
              <input
                type="date"
                name="dateDebut"
                value={formData.dateDebut}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date de fin *
              </label>
              <input
                type="date"
                name="dateFin"
                value={formData.dateFin}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Description de l'événement"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Géométrie (GeoJSON)
              </label>
              <textarea
                name="geometry"
                value={formData.geometry}
                onChange={handleInputChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder='Exemple: {"type": "Point", "coordinates": [7.75, 48.58]}'
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={handleCreateEvent}
              className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
            >
              Créer l'événement
            </button>
            <button
              onClick={() => setShowCreateForm(false)}
              className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Liste des événements */}
      <div className="space-y-4">
        {events.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>Aucun événement trouvé.</p>
            <p className="text-sm">Créez votre premier événement pour commencer !</p>
          </div>
        ) : (
          events.map((event) => (
            <div
              key={event.id}
              className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => onEventClick?.(event.id)}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-800">
                    {event.name}
                  </h3>
                  {event.description && (
                    <p className="text-gray-600 mt-1">{event.description}</p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                    <span>Sélectionné
 Du {formatDate(event.dateDebut)} au {formatDate(event.dateFin)}</span>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      event.statut === 'active' 
                        ? 'bg-green-100 text-green-800'
                        : event.statut === 'planned'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {event.statut}
                    </span>
                  </div>
                </div>
                <div className="ml-4 flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReceiveFromMobile(event.id);
                    }}
                    className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                  >
                   Import
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick?.(event.id);
                    }}
                    className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                  >
                    Voir sur la carte
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteEvent(event.id);
                    }}
                    className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                  >
                     Supprimer
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal QR Code pour réception */}
      {receiveQrCode && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <h3 className="text-xl font-bold text-center mb-4">
              📱 Recevoir depuis le mobile
            </h3>
            <p className="text-gray-600 text-center mb-4">
              Scannez ce QR code avec l'application mobile pour envoyer les points de l'événement.
            </p>
            
            <div className="flex justify-center mb-4">
              <img 
                src={`data:image/png;base64,${receiveQrCode}`} 
                alt="QR Code" 
                className="w-48 h-48"
              />
            </div>
            
            <div className="text-center mb-4">
              <p className="text-sm text-gray-500">{receiveStatus}</p>
              {pointsReceived > 0 && (
                <p className="text-green-600 font-semibold mt-2">
                  ✅ {pointsReceived} point(s) reçu(s)
                </p>
              )}
            </div>
            
            <div className="flex justify-center">
              <button
                onClick={closeReceiveModal}
                className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default Events;