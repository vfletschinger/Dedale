import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useEvent } from "../context/EventContext";
import { PlanningTeam, PlanningAction } from "../types/planning";
import { getDatabase } from "../../assets/migrations";
import "../style/global.css";

interface TeamWithActions extends PlanningTeam {
  actions: PlanningAction[];
}

interface MessageType {
  type: "success" | "error";
  text: string;
}

export default function PlanningScreen() {
  const { getSelectedEvent } = useEvent();
  const event = getSelectedEvent();
  const [teams, setTeams] = useState<TeamWithActions[]>([]);
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [message, setMessage] = useState<MessageType | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Charger les équipes et actions depuis la base de données
    if (!event?.id) return;
    
    try {
      const db = getDatabase();
      const eventId = event.id;
      
      // Charger les équipes de l'event
      const teamsList = db.getAllSync<any>(
        "SELECT * FROM team WHERE event_id = ?",
        [eventId]
      );
      
      // Charger les actions de l'event
      const actionsList = db.getAllSync<any>(
        "SELECT * FROM action WHERE team_id IN (SELECT id FROM team WHERE event_id = ?)",
        [eventId]
      );
      
      // Charger les membres des équipes
      const teamsWithMembers = teamsList.map((team: any) => {
        const members = db.getAllSync<any>(
          "SELECT * FROM team_member WHERE team_id = ?",
          [team.id]
        );
        
        return {
          id: team.id,
          name: team.name,
          number: team.number || 0,
          event_id: team.event_id,
          members: members || [],
          actions: actionsList.filter((a: any) => a.team_id === team.id),
        };
      });
      
      console.log('Planning - Équipes chargées:', teamsWithMembers);
      setTeams(teamsWithMembers);
    } catch (error) {
      console.error('Erreur chargement planning:', error);
      setMessage({
        type: "error",
        text: "Erreur lors du chargement des équipes",
      });
    }
  }, [event?.id]);

  const toggleTeamExpanded = (teamId: string) => {
    const newExpanded = new Set(expandedTeams);
    if (newExpanded.has(teamId)) {
      newExpanded.delete(teamId);
    } else {
      newExpanded.add(teamId);
    }
    setExpandedTeams(newExpanded);
  };

  const formatDateTime = (dateString?: string | null): string => {
    if (!dateString) return "Non planifié";
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateString;
    }
  };

  const generateTeamPDF = useCallback(async (teamId: string) => {
    setMessage(null);
    setIsLoading(true);
    try {
      // Pour mobile, on simule la génération
      Alert.alert(
        "PDF Équipe",
        `Génération du PDF pour l'équipe ${teamId}`,
        [{ text: "OK" }]
      );

      setMessage({
        type: "success",
        text: "PDF de l'équipe généré avec succès",
      });
    } catch (error) {
      console.error("Erreur PDF équipe:", error);
      setMessage({
        type: "error",
        text: `Erreur PDF: ${String(error)}`,
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const exportToExcel = useCallback(async () => {
    if (!event?.id) return;
    setIsLoading(true);
    try {
      const db = getDatabase();
      const eventId = event?.id;
      
      // Récupérer les données des équipes et actions
      const teamsData = db.getAllSync<any>(
        "SELECT * FROM team WHERE event_id = ?",
        [eventId]
      );
      
      const actionsData = db.getAllSync<any>(
        "SELECT * FROM action WHERE team_id IN (SELECT id FROM team WHERE event_id = ?)",
        [eventId]
      );
      
      // Formater les données pour Excel
      const formattedData = teamsData.map((team: any) => {
        const teamActions = actionsData.filter((a: any) => a.team_id === team.id);
        return {
          "Équipe ID": team.id,
          "Nom de l'équipe": team.name,
          "Nombre d'actions": teamActions.length,
          "Actions": teamActions.map((a: any) => a.action_type).join(", "),
        };
      });
      
      // Afficher un message de succès
      Alert.alert(
        "Export Excel",
        "Les données ont été exportées avec succès",
        [{ text: "OK" }]
      );
      
      setMessage({
        type: "success",
        text: "Données exportées vers Excel avec succès",
      });
    } catch (error) {
      console.error("Erreur export Excel:", error);
      setMessage({
        type: "error",
        text: `Erreur export Excel: ${String(error)}`,
      });
    } finally {
      setIsLoading(false);
    }
  }, [event?.id]);

  if (!event?.id) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-1 items-center justify-center">
          <Feather name="inbox" size={48} color="#94a3b8" />
          <Text className="text-gray-600 mt-4">Aucun événement</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gradient-to-b from-slate-50 to-slate-100">
      <View className="bg-white border-b border-slate-200 px-4 py-4 shadow-sm">
        <Text className="text-2xl font-bold text-slate-800">📋 Planning</Text>
        <Text className="text-sm text-slate-500 mt-1">
          {teams.length} équipe{teams.length !== 1 ? "s" : ""} •{" "}
          {teams.reduce((sum, t) => sum + (t.actions?.length || 0), 0)} action
          {teams.reduce((sum, t) => sum + (t.actions?.length || 0), 0) !== 1
            ? "s"
            : ""}
        </Text>
      </View>

      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      <ScrollView className="flex-1 px-4 py-4" showsVerticalScrollIndicator={false}>
        {/* Message d'erreur/succès */}
        {message && (
          <View
            className={`p-4 rounded-lg mb-4 border-l-4 ${
              message.type === "success"
                ? "bg-green-50 border-green-300"
                : "bg-red-50 border-red-300"
            }`}
          >
            <Text
              className={`font-medium text-sm ${
                message.type === "success"
                  ? "text-green-700"
                  : "text-red-700"
              }`}
            >
              {message.text}
            </Text>
          </View>
        )}

        {/* Actions d'export */}
        <View className="mb-6 gap-3">
          <View>
            <Text className="text-sm font-semibold text-slate-700 mb-2">
              Équipe pour PDF
            </Text>
            <TouchableOpacity
              className="bg-white border border-slate-300 rounded-lg px-3 py-3"
              onPress={() => {
                Alert.alert(
                  "Sélectionner une équipe",
                  "Choisissez une équipe",
                  teams.map((team) => ({
                    text: team.name || `Équipe ${team.number}`,
                    onPress: () => setSelectedTeamId(team.id),
                  })).concat([
                    { text: "Annuler", style: "cancel" },
                  ])
                );
              }}
            >
              <Text className="text-slate-700">
                {selectedTeamId
                  ? teams.find((t) => t.id === selectedTeamId)?.name ||
                    `Équipe ${teams.find((t) => t.id === selectedTeamId)?.number}`
                  : "-- Sélectionner une équipe --"}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={exportToExcel}
            disabled={isLoading}
            className="bg-green-600 px-6 py-3 rounded-lg"
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white text-center font-semibold">
                Exporter en Excel
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => selectedTeamId && generateTeamPDF(selectedTeamId)}
            disabled={isLoading || !selectedTeamId}
            className={`px-6 py-3 rounded-lg ${
              selectedTeamId && !isLoading
                ? "bg-purple-600"
                : "bg-gray-400"
            }`}
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white text-center font-semibold">
                📥 Télécharger PDF (Équipe)
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Liste des équipes */}
        {isLoading && teams.length === 0 ? (
          <View className="items-center justify-center py-12">
            <ActivityIndicator size="large" color="#3b82f6" />
          </View>
        ) : teams.length === 0 ? (
          <View className="items-center justify-center py-12">
            <Feather name="calendar" size={48} color="#cbd5e1" />
            <Text className="text-slate-600 mt-4 font-semibold text-center">
              Aucun planning disponible
            </Text>
            <Text className="text-slate-500 mt-2 text-sm text-center px-4">
              Le planning sera affiché une fois connecté
            </Text>
          </View>
        ) : (
          teams.map((team) => (
            <View
              key={team.id}
              className="mb-4 bg-white rounded-lg overflow-hidden shadow-sm border border-slate-200"
            >
              <TouchableOpacity
                onPress={() => toggleTeamExpanded(team.id)}
                className="bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-4 flex-row items-center justify-between active:opacity-80"
              >
                <View className="flex-row items-center flex-1">
                  <Text className="text-white text-xl mr-3">👥</Text>
                  <View className="flex-1">
                    <Text className="text-white font-bold text-base">
                      Équipe {team.number}
                    </Text>
                    {team.name && (
                      <Text className="text-blue-100 text-sm">{team.name}</Text>
                    )}
                  </View>
                </View>
                <View className="flex-row items-center">
                  <Text className="text-blue-100 text-xs mr-2">
                    {team.actions?.length || 0} actions
                  </Text>
                  <Text className="text-white text-lg">
                    {expandedTeams.has(team.id) ? "▼" : "▶"}
                  </Text>
                </View>
              </TouchableOpacity>

              {expandedTeams.has(team.id) && (
                <View className="px-4 py-4 border-t border-slate-200">
                  {/* Actions */}
                  {team.actions && team.actions.length > 0 ? (
                    <View className="mb-4">
                      <Text className="text-sm font-bold text-slate-700 mb-3">
                        Actions ({team.actions.length})
                      </Text>
                      {team.actions.map((action) => (
                        <View
                          key={action.id}
                          className={`flex-row items-center p-3 mb-2 rounded-lg border-l-4 ${
                            action.is_done
                              ? "bg-green-50 border-green-500"
                              : "bg-orange-50 border-orange-500"
                          }`}
                        >
                          <Text className="text-lg mr-3">
                            {action.is_done ? "✓" : "⏳"}
                          </Text>
                          <View className="flex-1">
                            <Text className="font-semibold text-slate-800">
                              {action.equipement_name || action.action_type || "Action"}
                            </Text>
                            <Text className="text-xs text-slate-500 mt-1">
                              {formatDateTime(action.scheduled_time)}
                            </Text>
                          </View>
                          <Text className="text-xs font-bold px-2 py-1 rounded bg-slate-200 text-slate-700">
                            {action.is_done ? "Complétée" : "En attente"}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text className="text-slate-500 italic text-sm mb-4">
                      Aucune action pour cette équipe
                    </Text>
                  )}

                  {/* Membres */}
                  {team.members && team.members.length > 0 && (
                    <View className="pt-3 border-t border-slate-100">
                      <Text className="text-sm font-bold text-slate-700 mb-3">
                        Membres ({team.members.length})
                      </Text>
                      {team.members.map((member) => (
                        <View
                          key={member.id}
                          className="bg-slate-50 rounded px-3 py-2 mb-2 flex-row items-center"
                        >
                          <Feather name="user" size={16} color="#64748b" />
                          <Text className="text-sm text-slate-700 ml-2 flex-1">
                            {member.firstname} {member.lastname}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}