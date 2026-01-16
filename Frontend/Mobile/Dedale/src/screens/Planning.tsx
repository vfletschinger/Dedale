import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { SQLiteDatabase } from "expo-sqlite";
import {
  useSafeAreaInsets,
  SafeAreaView,
} from "react-native-safe-area-context";
import getDatabase from "../../assets/migrations";
import { useEvent } from "../context/EventContext";
import { RootStackParamList } from "../types/navigation";
import QRCodeScanner from "../components/QrCodeScanner";
import Colors from "../constants/colors";

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

export default function PlanningScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { selectedEventId, getSelectedEvent } = useEvent();
  const selectedEvent = getSelectedEvent();
  const insets = useSafeAreaInsets();

  const [db, setDb] = useState<SQLiteDatabase | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [actions, setActions] = useState<Action[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanQR, setScanQR] = useState(false);

  const loadData = (database: SQLiteDatabase) => {
    try {
      if (!database) {
        console.error("Database not initialized");
        setLoading(false);
        return;
      }

      if (!selectedEventId) {
        console.log("Aucun événement sélectionné");
        setTeam(null);
        setActions([]);
        setLoading(false);
        return;
      }

      try {
        const teamResult = database.getFirstSync<Team>(
          `SELECT t.* FROM team t
           INNER JOIN action a ON a.team_id = t.id
           WHERE t.event_id = ?
           GROUP BY t.id
           HAVING COUNT(a.id) > 0
           LIMIT 1`,
          [selectedEventId]
        );
        setTeam(teamResult || null);

        if (teamResult) {
          const actionsResult = database.getAllSync<Action>(
            `SELECT a.*, t.name as equipement_name 
             FROM action a 
             LEFT JOIN equipement e ON a.equipement_id = e.id
             LEFT JOIN type t ON e.type_id = t.id
             WHERE a.team_id = ?
             ORDER BY a.scheduled_time ASC`,
            [teamResult.id]
          );
          setActions(actionsResult || []);
        } else {
          setActions([]);
        }
      } catch (error) {
        console.error("Erreur lors du chargement des données:", error);
        setTeam(null);
        setActions([]);
      }
    } catch (error) {
      console.error("Erreur générale lors du chargement des données:", error);
    } finally {
      setLoading(false);
    }
  };

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

  useFocusEffect(
    useCallback(() => {
      if (db) {
        loadData(db);
      }
    }, [db, selectedEventId])
  );

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
        return "Pose";
      case "retrait":
        return "Retrait";
      case "déploiement":
        return "Déploiement";
      case "inspection":
        return "Inspection";
      default:
        return type || "Action";
    }
  };

  if (scanQR) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.scannerHeader}>
          <Pressable onPress={() => setScanQR(false)} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color="#fff" />
            <Text style={styles.backText}>Retour</Text>
          </Pressable>
        </View>
        <QRCodeScanner
          setScanQR={setScanQR}
          dataType="planning"
          onImportSuccess={() => db && loadData(db)}
        />
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={Colors.secondary} />
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

  if (!team) {
    return (
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.mainTitle}>Planning</Text>
          <Pressable
            style={({ pressed }) => [
              styles.qrIconButton,
              pressed && styles.qrIconButtonPressed,
            ]}
            onPress={() => setScanQR(true)}
          >
            <MaterialCommunityIcons
              name="qrcode-scan"
              size={24}
              color={Colors.secondary}
            />
          </Pressable>
        </View>
        {selectedEvent && (
          <Text style={styles.eventName}>{selectedEvent.name}</Text>
        )}
        <View style={styles.emptyState}>
          <Feather name="users" size={48} color={Colors.textMuted} />
          <Text style={styles.emptyText}>Aucune équipe pour cet événement</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollContent}>
        <View style={styles.headerRow}>
          <Text style={styles.mainTitle}>Planning</Text>
          <Pressable
            style={({ pressed }) => [
              styles.qrIconButton,
              pressed && styles.qrIconButtonPressed,
            ]}
            onPress={() => setScanQR(true)}
          >
            <MaterialCommunityIcons
              name="qrcode-scan"
              size={24}
              color={Colors.secondary}
            />
          </Pressable>
        </View>
        {selectedEvent && (
          <Text style={styles.eventName}>{selectedEvent.name}</Text>
        )}

        <View style={styles.teamHeader}>
          <Feather name="users" size={32} color={Colors.secondary} />
          <Text style={styles.teamName}>{team.name}</Text>
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
                action.is_done ? styles.actionCardDone : undefined,
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
        <View style={{ height: 100 }} />
      </ScrollView>

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
              navigation.navigate("TeamGuidance", {
                teamId: team.id,
                teamName: team.name,
              })
            }
          >
            <View style={styles.guidanceButtonContent}>
              <Feather name="navigation" size={22} color="#fff" />
              <Text style={styles.guidanceButtonText}>
                Commencer le guidage
              </Text>
            </View>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  scrollContent: {
    flex: 1,
    paddingHorizontal: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 30,
    marginBottom: 4,
    paddingHorizontal: 16,
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#333",
  },
  qrIconButton: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: "#EFF6FF",
  },
  qrIconButtonPressed: {
    backgroundColor: "#DBEAFE",
  },
  eventName: {
    fontSize: 16,
    color: Colors.secondary,
    marginBottom: 16,
    fontWeight: "500",
    paddingHorizontal: 16,
  },
  teamHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  teamName: {
    fontSize: 24,
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
    color: Colors.secondary,
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
    borderLeftColor: Colors.accent,
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
    textAlign: "center",
    fontSize: 16,
    color: "#999",
    marginTop: 12,
  },
  bottomButtonContainer: {
    backgroundColor: Colors.secondary,
    position: "absolute",
    bottom: -1,
    left: -1,
    right: -1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopStartRadius: 24,
    borderTopEndRadius: 24,
    borderTopColor: Colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 8,
  },
  guidanceButton: {
    backgroundColor: Colors.secondary,
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 14,
    elevation: 6,
  },
  guidanceButtonContent: {
    flexDirection: "row",
    gap: 10,
  },
  guidanceButtonPressed: {
    backgroundColor: Colors.secondaryDark,
  },
  guidanceButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 0.5,
    flexShrink: 0,
  },
  scannerHeader: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  backText: {
    color: Colors.accent,
    fontSize: 16,
    fontWeight: "600",
  },
});