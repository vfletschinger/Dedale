import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from "react";
import { getDatabase } from "../../assets/migrations";
import { EventType } from "../types/database";

// Type pour le statut calculé d'un événement
type EventStatus = "actif" | "planifié" | "passé";

// Type étendu avec statut calculé
export type EventWithStatus = EventType & {
  calculatedStatus: EventStatus;
};

interface EventContextType {
  selectedEventId: string | null;
  setSelectedEventId: (id: string | null) => void;
  events: EventWithStatus[];
  loading: boolean;
  refreshEvents: () => void;
  getSelectedEvent: () => EventWithStatus | null;
}

const EventContext = createContext<EventContextType | undefined>(undefined);

/**
 * Calcule le statut d'un événement basé sur ses dates et la date actuelle
 */
function calculateEventStatus(event: EventType): EventStatus {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const dateDebut = new Date(event.dateDebut || event.startDate || "");
  const dateFin = new Date(event.dateFin || event.endDate || "");

  // Normaliser les dates pour comparer uniquement les jours
  const startDate = new Date(
    dateDebut.getFullYear(),
    dateDebut.getMonth(),
    dateDebut.getDate()
  );
  const endDate = new Date(
    dateFin.getFullYear(),
    dateFin.getMonth(),
    dateFin.getDate()
  );

  if (today >= startDate && today <= endDate) {
    return "actif";
  } else if (today < startDate) {
    return "planifié";
  } else {
    return "passé";
  }
}

/**
 * Trie les événements par statut (actif > planifié > passé)
 * puis par date de début (les plus proches en premier pour planifiés,
 * les plus récents en premier pour passés)
 */
function sortEvents(events: EventWithStatus[]): EventWithStatus[] {
  const statusOrder: Record<EventStatus, number> = {
    actif: 1,
    planifié: 2,
    passé: 3,
  };

  return [...events].sort((a, b) => {
    // D'abord trier par statut
    const statusDiff =
      statusOrder[a.calculatedStatus] - statusOrder[b.calculatedStatus];
    if (statusDiff !== 0) return statusDiff;

    // Pour les événements du même statut, trier par date
    const dateA = new Date(a.dateDebut).getTime();
    const dateB = new Date(b.dateDebut).getTime();

    if (a.calculatedStatus === "passé") {
      // Pour les passés: les plus récents en premier
      return dateB - dateA;
    } else {
      // Pour actifs et planifiés: les plus proches en premier
      return dateA - dateB;
    }
  });
}

export function EventProvider({ children }: { children: ReactNode }) {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [events, setEvents] = useState<EventWithStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshEvents = useCallback(() => {
    try {
      setLoading(true);
      const db = getDatabase();
      const eventsList = db.getAllSync<EventType>("SELECT * FROM event");

      // Ajouter le statut calculé à chaque événement
      const eventsWithStatus: EventWithStatus[] = eventsList.map((event) => ({
        ...event,
        calculatedStatus: calculateEventStatus(event),
      }));

      // Trier les événements
      const sortedEvents = sortEvents(eventsWithStatus);
      setEvents(sortedEvents);
    } catch (error) {
      console.error("Erreur chargement événements:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const getSelectedEvent = useCallback((): EventWithStatus | null => {
    if (!selectedEventId) return null;
    return events.find((e) => e.id === selectedEventId) || null;
  }, [selectedEventId, events]);

  // Charger les événements au démarrage
  useEffect(() => {
    refreshEvents();
  }, [refreshEvents]);

  return (
    <EventContext.Provider
      value={{
        selectedEventId,
        setSelectedEventId,
        events,
        loading,
        refreshEvents,
        getSelectedEvent,
      }}
    >
      {children}
    </EventContext.Provider>
  );
}

export function useEvent() {
  const context = useContext(EventContext);
  if (context === undefined) {
    throw new Error("useEvent must be used within an EventProvider");
  }
  return context;
}
