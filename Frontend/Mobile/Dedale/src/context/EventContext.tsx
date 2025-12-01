import React, { createContext, useContext, useState, ReactNode } from "react";

interface EventContextType {
  selectedEventId: number | null;
  setSelectedEventId: (id: number | null) => void;
}

const EventContext = createContext<EventContextType | undefined>(undefined);

export function EventProvider({ children }: { children: ReactNode }) {
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);

  return (
    <EventContext.Provider value={{ selectedEventId, setSelectedEventId }}>
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
