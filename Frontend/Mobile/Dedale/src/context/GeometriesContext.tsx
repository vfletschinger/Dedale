import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
  useCallback,
} from "react";
import { GeometryType } from "../types/database";
import { getDatabase } from "../../assets/migrations";

interface GeometriesContextType {
  geometriesByEvent: { [key: number]: GeometryType[] };
  loading: boolean;
  refreshGeometries: () => Promise<void>;
}

const GeometriesContext = createContext<GeometriesContextType | undefined>(
  undefined
);

export function GeometriesProvider({ children }: { children: ReactNode }) {
  const [geometriesByEvent, setGeometriesByEvent] = useState<{
    [key: number]: GeometryType[];
  }>({});
  const [loading, setLoading] = useState(true);

  const loadAllGeometries = useCallback(async () => {
    try {
      setLoading(true);
      const db = getDatabase();
      const allGeometries = await db.getAllAsync<GeometryType>(
        `SELECT id, event_id, wkt, created_at FROM geometry`
      );

      const groupedGeometries: { [key: number]: GeometryType[] } = {};
      for (const geometry of allGeometries) {
        if (!groupedGeometries[geometry.event_id]) {
          groupedGeometries[geometry.event_id] = [];
        }
        groupedGeometries[geometry.event_id].push(geometry);
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
