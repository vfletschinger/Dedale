import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { getDatabase } from "../../assets/migrations";
import { RootStackParamList } from "../types/navigation";

interface Action {
  id: string;
  team_id: string;
  equipement_id: string;
  type: string | null;
  scheduled_time: string | null;
  is_done: number;
  equipement_name?: string;
}

interface Team {
  id: string;
  event_id: string;
  name: string;
}

type TeamDetailsRouteParams = {
  TeamDetails: {
    teamId: string;
    teamName: string;
  };
};

export default function TeamDetailsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<TeamDetailsRouteParams, "TeamDetails">>();
  const { teamId, teamName } = route.params;
  const insets = useSafeAreaInsets();

  const [team, setTeam] = useState<Team | null>(null);
  const [actions, setActions] = useState<Action[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTeamData();
  }, [teamId]);

  const loadTeamData = () => {
    try {
      const db = getDatabase();

      const teamResult = db.getFirstSync<Team>(
        "SELECT * FROM team WHERE id = ?",
        [teamId]
      );
      setTeam(teamResult || null);

      const actionsResult = db.getAllSync<Action>(
        `SELECT a.*, et.name as equipement_name 
         FROM action a 
         LEFT JOIN equipement e ON a.equipement_id = e.id
         LEFT JOIN equipement_type et ON e.type_id = et.id
         WHERE a.team_id = ?
         ORDER BY a.scheduled_time ASC`,
        [teamId]
      );
      setActions(actionsResult || []);
    } catch (error) {
      console.error("Erreur chargement équipe:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Non planifié";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "Non planifié";
      return date.toLocaleString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Paris",
      });
    } catch (e) {
      console.error("Erreur format date:", e);
      return "Non planifié";
    }
  };

  const getActionTypeLabel = (type: string | null) => {
    switch (type) {
      case "pose":
        return "🔧 Pose";
      case "retrait":
        return "📤 Retrait";
      case "déploiement":
        return "🚀 Déploiement";
      case "inspection":
        return "🔍 Inspection";
      default:
        return type || "Action";
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Feather name="arrow-left" size={24} color="#fff" />
          <Text style={styles.backText}>Retour</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.teamHeader}>
          <Feather name="users" size={32} color="#007AFF" />
          <Text style={styles.teamName}>{teamName}</Text>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryNumber}>{actions.length}</Text>
            <Text style={styles.summaryLabel}>Actions</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryNumber}>
              {actions.filter((a) => a.is_done).length}
            </Text>
            <Text style={styles.summaryLabel}>Terminées</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryNumber}>
              {actions.filter((a) => !a.is_done).length}
            </Text>
            <Text style={styles.summaryLabel}>En attente</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Actions de l'équipe</Text>

        {actions.length > 0 ? (
          actions.map((action) => (
            <View
              key={action.id}
              style={[
                styles.actionCard,
                action.is_done && styles.actionCardDone,
              ]}
            >
              <View style={styles.actionHeader}>
                <Text style={styles.actionType}>
                  {getActionTypeLabel(action.type)}
                </Text>
                <View
                  style={[
                    styles.statusBadge,
                    action.is_done ? styles.statusDone : styles.statusPending,
                  ]}
                >
                  <Text style={styles.statusText}>
                    {action.is_done ? "Terminée" : "En attente"}
                  </Text>
                </View>
              </View>

              <View style={styles.actionDetails}>
                <View style={styles.detailRow}>
                  <Feather name="clock" size={14} color="#666" />
                  <Text style={styles.detailText}>
                    {formatDate(action.scheduled_time)}
                  </Text>
                </View>

                {action.equipement_name && (
                  <View style={styles.detailRow}>
                    <Feather name="box" size={14} color="#666" />
                    <Text style={styles.detailText}>
                      {action.equipement_name}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Feather name="inbox" size={48} color="#ccc" />
            <Text style={styles.emptyText}>
              Aucune action pour cette équipe
            </Text>
          </View>
        )}
        {/* Espace pour le bouton fixe en bas */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bouton Commencer le guidage */}
      {actions.filter((a) => !a.is_done).length > 0 && (
        <View
          style={[
            styles.bottomButtonContainer,
            { paddingBottom: Math.max(insets.bottom, 16) },
          ]}
        >
          <Pressable
            style={({ pressed }) => [
              styles.guidanceButton,
              pressed && styles.guidanceButtonPressed,
            ]}
            onPress={() =>
              navigation.navigate("TeamGuidance", { teamId, teamName })
            }
          >
            <Feather name="navigation" size={22} color="#fff" />
            <Text style={styles.guidanceButtonText}>Commencer le guidage</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  backText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  teamHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 20,
    marginBottom: 16,
  },
  teamName: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#333",
  },
  summaryCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryItem: {
    alignItems: "center",
  },
  summaryNumber: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#007AFF",
  },
  summaryLabel: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  summaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: "#e0e0e0",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  actionCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#FF9500",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  actionCardDone: {
    borderLeftColor: "#34C759",
    opacity: 0.8,
  },
  actionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  actionType: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusPending: {
    backgroundColor: "#FFF3E0",
  },
  statusDone: {
    backgroundColor: "#E8F5E9",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#333",
  },
  actionDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: "#666",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    color: "#999",
    marginTop: 12,
  },
  bottomButtonContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#f5f5f5",
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
  },
  guidanceButton: {
    backgroundColor: "#007AFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: "#007AFF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  guidanceButtonPressed: {
    backgroundColor: "#0066DD",
  },
  guidanceButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "600",
  },
});
