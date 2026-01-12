import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { SQLiteDatabase } from "expo-sqlite";
import getDatabase from "../../assets/migrations";
import { useEvent } from "../context/EventContext";
import { RootStackParamList } from "../types/navigation";

interface TeamWithActionCount {
  id: string;
  event_id: string;
  name: string;
  action_count: number;
  actions_done: number;
}

export default function PlanningScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { selectedEventId, getSelectedEvent } = useEvent();
  const selectedEvent = getSelectedEvent();
  
  const [db, setDb] = useState<SQLiteDatabase | null>(null);
  const [teams, setTeams] = useState<TeamWithActionCount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const database = getDatabase();
      setDb(database);
      loadData(database);
    } catch (error) {
      console.error("Error initializing database:", error);
      setLoading(false);
    }
  }, [selectedEventId]);

  const loadData = (database: SQLiteDatabase) => {
    try {
      if (!database) {
        console.error("Database not initialized");
        setLoading(false);
        return;
      }

      if (!selectedEventId) {
        console.log("Aucun événement sélectionné");
        setTeams([]);
        setLoading(false);
        return;
      }

      try {
        const teamsResult = database.getAllSync<TeamWithActionCount>(
          `SELECT t.*, 
                  COUNT(a.id) as action_count,
                  SUM(CASE WHEN a.is_done = 1 THEN 1 ELSE 0 END) as actions_done
           FROM team t
           LEFT JOIN action a ON a.team_id = t.id
           WHERE t.event_id = ?
           GROUP BY t.id`,
          [selectedEventId]
        );
        setTeams((teamsResult || []) as TeamWithActionCount[]);
      } catch (error) {
        console.error("Erreur lors du chargement des équipes:", error);
        setTeams([]);
      }
    } catch (error) {
      console.error("Erreur générale lors du chargement des données:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleTeamPress = (team: TeamWithActionCount) => {
    navigation.navigate("TeamDetails", {
      teamId: team.id,
      teamName: team.name,
    });
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!selectedEventId) {
    return (
      <View style={styles.container}>
        <Text style={styles.mainTitle}>Planning</Text>
        <Text style={styles.emptyText}>Veuillez sélectionner un événement</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.mainTitle}>Planning</Text>
      {selectedEvent && (
        <Text style={styles.eventName}>{selectedEvent.name}</Text>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Équipes ({teams.length})
        </Text>
        
        {teams.length > 0 ? (
          teams.map((team) => (
            <Pressable
              key={team.id}
              style={({ pressed }) => [
                styles.teamCard,
                pressed && styles.teamCardPressed,
              ]}
              onPress={() => handleTeamPress(team)}
            >
              <View style={styles.teamHeader}>
                <Feather name="users" size={20} color="#007AFF" />
                <Text style={styles.teamName}>{team.name}</Text>
              </View>
              <View style={styles.actionRow}>
                <View style={styles.actionBadge}>
                  <Text style={styles.actionCount}>
                    {team.actions_done || 0}/{team.action_count || 0} actions
                  </Text>
                </View>
                <Feather name="chevron-right" size={20} color="#007AFF" />
              </View>
            </Pressable>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Feather name="users" size={48} color="#ccc" />
            <Text style={styles.emptyText}>Aucune équipe pour cet événement</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: "bold",
    marginTop: 60,
    marginBottom: 4,
    marginHorizontal: 16,
    color: "#333",
  },
  eventName: {
    fontSize: 16,
    color: "#007AFF",
    marginHorizontal: 16,
    marginBottom: 24,
    fontWeight: "500",
  },
  section: {
    marginHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 16,
    color: "#333",
  },
  teamCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#E8E8E8",
  },
  teamCardPressed: {
    backgroundColor: "#F5F5F5",
    borderColor: "#007AFF",
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  teamHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  teamName: {
    fontSize: 17,
    fontWeight: "600",
    color: "#333",
  },
  actionBadge: {
    backgroundColor: "#E3F2FD",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  actionCount: {
    fontSize: 13,
    fontWeight: "500",
    color: "#1976D2",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 48,
  },
  emptyText: {
    textAlign: "center",
    fontSize: 16,
    color: "#999",
    marginTop: 12,
  },
});
