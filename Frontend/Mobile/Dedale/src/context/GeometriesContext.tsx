import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
  useCallback,
} from "react";
import { ParcoursType, ZoneType } from "../types/database";
import { getDatabase } from "../../assets/migrations";

type GeometryUnion = (ParcoursType | ZoneType) & { type: "parcours" | "zone" };

interface GeometriesContextType {
  geometriesByEvent: { [key: string]: GeometryUnion[] };
  loading: boolean;
  refreshGeometries: () => Promise<void>;
}

const GeometriesContext = createContext<GeometriesContextType | undefined>(
  undefined
);

export function GeometriesProvider({ children }: { children: ReactNode }) {
  const [geometriesByEvent, setGeometriesByEvent] = useState<{
    [key: string]: GeometryUnion[];
  }>({});
  const [loading, setLoading] = useState(true);

  const loadAllGeometries = useCallback(async () => {
    try {
      setLoading(true);
      const db = getDatabase();

      // Charger tous les parcours
      const allParcours = await db.getAllAsync<ParcoursType>(
        `SELECT id, event_id, wkt, created_at FROM parcours`
      );

      // Charger toutes les zones
      const allZones = await db.getAllAsync<ZoneType>(
        `SELECT id, event_id, wkt, created_at FROM zone`
      );

      const groupedGeometries: { [key: string]: GeometryUnion[] } = {};

      // Ajouter les parcours
      for (const parcours of allParcours) {
        if (parcours.event_id !== undefined) {
          const eventId = String(parcours.event_id);
          if (!groupedGeometries[eventId]) {
            groupedGeometries[eventId] = [];
          }
          groupedGeometries[eventId].push({
            ...parcours,
            type: "parcours",
          });
        }
      }

      // Ajouter les zones
      for (const zone of allZones) {
        if (zone.event_id !== undefined) {
          const eventId = String(zone.event_id);
          if (!groupedGeometries[eventId]) {
            groupedGeometries[eventId] = [];
          }
          groupedGeometries[eventId].push({ ...zone, type: "zone" });
        }
      }

      setGeometriesByEvent(groupedGeometries);
    } catch (error) {
      console.error("Failed to load all geometries:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllGeometries();
  }, [loadAllGeometries]);

  return (
    <GeometriesContext.Provider
      value={{
        geometriesByEvent,
        loading,
        refreshGeometries: loadAllGeometries,
      }}
    >
      {children}
    </GeometriesContext.Provider>
  );
}

export function useGeometries() {
  const context = useContext(GeometriesContext);
  if (context === undefined) {
    throw new Error("useGeometries must be used within a GeometriesProvider");
  }
  return context;
}
