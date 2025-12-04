import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
  useCallback,
} from "react";
import { InterestPointsType } from "../types/database";
import { getDatabase } from "../../assets/migrations";

interface PointsContextType {
  pointsByEvent: { [key: number]: InterestPointsType[] };
  loading: boolean;
  refreshPoints: () => Promise<void>;
}

const PointsContext = createContext<PointsContextType | undefined>(undefined);

export function PointsProvider({ children }: { children: ReactNode }) {
  const [pointsByEvent, setPointsByEvent] = useState<{
    [key: number]: InterestPointsType[];
  }>({});
  const [loading, setLoading] = useState(true);

  const loadAllPoints = useCallback(async () => {
    try {
      setLoading(true);
      const db = getDatabase();
      // Query points with their event associations via junction table
      const allPoints = await db.getAllAsync<InterestPointsType>(
        `SELECT p.id, p.x, p.y, pe.event_id 
         FROM point p 
         LEFT JOIN point_event pe ON p.id = pe.point_id`
      );
      const groupedPoints: { [key: number]: InterestPointsType[] } = {};
      for (const point of allPoints) {
        if (point.event_id) {
          // Ensure event_id is not null
          if (!groupedPoints[point.event_id]) {
            groupedPoints[point.event_id] = [];
          }
          groupedPoints[point.event_id].push(point);
        }
      }
      // sort each event's points
      for (const eventId in groupedPoints) {
        groupedPoints[eventId].sort((a, b) => b.id - a.id);
      }

      setPointsByEvent(groupedPoints);
    } catch (error) {
      console.error("Failed to load all points:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllPoints();
  }, [loadAllPoints]);

  return (
    <PointsContext.Provider
      value={{ pointsByEvent, loading, refreshPoints: loadAllPoints }}
    >
      {children}
    </PointsContext.Provider>
  );
}

export function usePoints() {
  const context = useContext(PointsContext);
  if (context === undefined) {
    throw new Error("usePoints must be used within a PointsProvider");
  }
  return context;
}
