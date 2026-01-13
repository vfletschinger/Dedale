import { useState, useEffect, useCallback } from "react";
import {
  Event,
  EventInput,
  EventGeometryInput,
  GeometryType,
} from "../types/event";
import {
  fetchEvents,
  fetchEventById,
  createEvent,
  updateEvent,
  deleteEvent,
  createEventGeometry,
  updateEventGeometry,
  deleteEventGeometry,
} from "../services/eventService";

export interface UseEventsReturn {
  // État des données
  events: Event[];
  selectedEvent: Event | null;
  geometryTypes: GeometryType[];

  // États de chargement et d'erreur
  isLoading: boolean;
  error: string | null;

  // Actions pour les événements
  loadEvents: () => Promise<void>;
  selectEvent: (eventId: string) => Promise<void>;
  addEvent: (event: EventInput) => Promise<Event | null>;
  editEvent: (eventId: string, event: EventInput) => Promise<void>;
  removeEvent: (eventId: string) => Promise<void>;

  // Actions pour les géométries
  addGeometry: (geometry: EventGeometryInput) => Promise<void>;
  editGeometry: (
    geometryId: string,
    geometry: EventGeometryInput,
  ) => Promise<void>;
  removeGeometry: (geometryId: string) => Promise<void>;

  // Utilitaires
  clearError: () => void;
  clearSelection: () => void;
}

/**
 * Hook personnalisé pour gérer les événements et leurs géométries
 */
export function useEvents(): UseEventsReturn {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [geometryTypes] = useState<GeometryType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Charger les événements
  const loadEvents = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const eventsData = await fetchEvents();
      setEvents(eventsData);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      setError(message);
      console.error("Erreur lors du chargement des événements:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Sélectionner un événement
  const selectEvent = useCallback(async (eventId: string) => {
    setError(null);
    try {
      const event = await fetchEventById(eventId);
      setSelectedEvent(event);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      setError(message);
      console.error("Erreur lors de la sélection de l'événement:", err);
    }
  }, []);

  // Ajouter un événement
  const addEvent = useCallback(
    async (event: EventInput): Promise<Event | null> => {
      setError(null);
      try {
        const eventId = await createEvent(event);
        await loadEvents();

        // Retourner le nouvel événement créé
        const newEvent = await fetchEventById(eventId);
        return newEvent;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Erreur inconnue";
        setError(message);
        console.error("Erreur lors de la création de l'événement:", err);
        return null;
      }
    },
    [loadEvents],
  );

  // Modifier un événement
  const editEvent = useCallback(
    async (eventId: string, event: EventInput) => {
      setError(null);
      try {
        await updateEvent(eventId, event);
        await loadEvents();

        // Recharger l'événement sélectionné s'il s'agit du même
        if (selectedEvent?.id === eventId) {
          await selectEvent(eventId);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Erreur inconnue";
        setError(message);
        console.error("Erreur lors de la modification de l'événement:", err);
      }
    },
    [loadEvents, selectedEvent, selectEvent],
  );

  // Supprimer un événement
  const removeEvent = useCallback(
    async (eventId: string) => {
      setError(null);
      try {
        await deleteEvent(eventId);
        await loadEvents();

        // Désélectionner si c'était l'événement sélectionné
        if (selectedEvent?.id === eventId) {
          setSelectedEvent(null);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Erreur inconnue";
        setError(message);
        console.error("Erreur lors de la suppression de l'événement:", err);
      }
    },
    [loadEvents, selectedEvent],
  );

  // Ajouter une géométrie
  const addGeometry = useCallback(
    async (geometry: EventGeometryInput) => {
      setError(null);
      try {
        await createEventGeometry(geometry);

        // Recharger l'événement sélectionné
        if (selectedEvent && selectedEvent.id === String(geometry.event_id)) {
          await selectEvent(selectedEvent.id);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Erreur inconnue";
        setError(message);
        console.error("Erreur lors de l'ajout de la géométrie:", err);
      }
    },
    [selectedEvent, selectEvent],
  );

  // Modifier une géométrie
  const editGeometry = useCallback(
    async (geometryId: string, geometry: EventGeometryInput) => {
      setError(null);
      try {
        await updateEventGeometry(geometryId, geometry);

        // Recharger l'événement sélectionné
        if (selectedEvent && selectedEvent.id === String(geometry.event_id)) {
          await selectEvent(selectedEvent.id);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Erreur inconnue";
        setError(message);
        console.error("Erreur lors de la modification de la géométrie:", err);
      }
    },
    [selectedEvent, selectEvent],
  );

  // Supprimer une géométrie
  const removeGeometry = useCallback(
    async (geometryId: string) => {
      setError(null);
      try {
        await deleteEventGeometry(geometryId);

        // Recharger l'événement sélectionné
        if (selectedEvent) {
          await selectEvent(selectedEvent.id);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Erreur inconnue";
        setError(message);
        console.error("Erreur lors de la suppression de la géométrie:", err);
      }
    },
    [selectedEvent, selectEvent],
  );

  // Effacer l'erreur
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Effacer la sélection
  const clearSelection = useCallback(() => {
    setSelectedEvent(null);
  }, []);

  // Chargement initial
  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  return {
    // État des données
    events,
    selectedEvent,
    geometryTypes,

    // États de chargement et d'erreur
    isLoading,
    error,

    // Actions pour les événements
    loadEvents,
    selectEvent,
    addEvent,
    editEvent,
    removeEvent,

    // Actions pour les géométries
    addGeometry,
    editGeometry,
    removeGeometry,

    // Utilitaires
    clearError,
    clearSelection,
  };
}

export default useEvents;
