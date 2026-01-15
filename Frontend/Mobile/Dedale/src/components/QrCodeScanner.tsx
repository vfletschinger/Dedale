import React, { useState, useEffect } from "react";
import {
  Text,
  View,
  Button,
  Dimensions,
  Modal,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from "react-native";
import {
  CameraView,
  useCameraPermissions,
  BarcodeScanningResult,
} from "expo-camera";
import WebSocketClient, { WebSocketResponse } from "./WebSocketClient";
const { width } = Dimensions.get("window");
const SCANNER_SIZE = width * 0.7;
import { getDatabase } from "../../assets/migrations";
import { useWebSocket } from "../context/WebSocketContext";
import { useEvent } from "../context/EventContext";
import { usePoints } from "../context/PointsContext";
import { useGeometries } from "../context/GeometriesContext";
import {
  EventType,
  TransferEventType,
  InterestPointsType,
  PictureType,
  EquipementType,
  ParcoursType,
  ZoneType,
} from "../types/database";

// Types pour l'export
type PointWithDetails = InterestPointsType & {
  pictures: PictureType[];
  equipements: EquipementType[];
};

type EventExportData = {
  event: any;
  points: PointWithDetails[];
  equipements?: any[];
};

// Nouveau type pour les données reçues du desktop
interface IncomingEventData {
  type: "event";
  data: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    points: Array<{
      id: string;
      eventId: string;
      x: number;
      y: number;
      name: string;
      comment: string | null;
      type: string | null;
      status: boolean;
    }>;
    parcours: Array<{
      id: string;
      eventId: string;
      geometryJson?: string;
      wkt?: string;
    }>;
    zones: Array<{
      id: string;
      eventId: string;
      geometryJson?: string;
      wkt?: string;
    }>;
    teams: Array<{
      id: string;
      eventId: string;
      name: string;
      members: any[];
    }>;
    actions: Array<{
      id: string;
      teamId: string;
      equipementId: string;
      actionType?: string;
      type?: string;
      scheduledTime?: string;
      scheduled_time?: string;
      isDone?: boolean;
      is_done?: number;
    }>;
    equipements: Array<{
      id: string;
      eventId: string;
      typeId: string;
      quantity: number;
      lengthPerUnit: number;
      datePose: string;
      dateDepose: string;
      coordinates: Array<{
        id: string;
        equipementId: string;
        x: number;
        y: number;
        orderIndex: number;
      }>;
    }>;
  };
}

interface QRCodeScannerProps {
  setScanQR: (value: boolean) => void;
  mode?: "receive" | "send"; // Mode: recevoir des events ou envoyer
  dataType?: "event" | "planning"; // Type de données: événements ou planning
  eventToSend?: any; // L'événement à envoyer (si mode 'send')
  onExportSuccess?: () => void; // Callback quand l'export réussit
  onImportSuccess?: () => void; // Callback après import réussi (pour planning)
}

const QRCodeScanner = ({
  setScanQR,
  mode = "receive",
  dataType = "event",
  eventToSend,
  onExportSuccess,
  onImportSuccess,
}: QRCodeScannerProps) => {
  const { setWsClient, setIsConnected } = useWebSocket();
  const { refreshEvents, selectedEventId } = useEvent();
  const { refreshPoints } = usePoints();
  const { refreshGeometries } = useGeometries();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferStatus, setTransferStatus] = useState("Connexion en cours...");
  const [receivedCount, setReceivedCount] = useState(0);
  const [currentClient, setCurrentClient] = useState<WebSocketClient | null>(
    null
  );
  const db = getDatabase();

  if (!permission || !permission.granted) {
    return (
      <View className="scanner-container center">
        {!permission ? (
          <Text className="text-white">Chargement...</Text>
        ) : (
          <View>
            <Text className="text-white mb-4">
              Nous avons besoin de la caméra.
            </Text>
            <Button onPress={requestPermission} title="Accorder" />
          </View>
        )}
      </View>
    );
  }

  const insertEvents = (
    eventsData: (EventType | TransferEventType | IncomingEventData)[]
  ) => {
    try {
      let insertedCount = 0;
      let updatedCount = 0;
      let parcoursCount = 0;
      let zonesCount = 0;
      let pointsCount = 0;
      let teamsCount = 0;
      let actionsCount = 0;
      let equipementsCount = 0;

      for (const incomingData of eventsData) {
        // Vérifier si c'est le nouveau format {type: "event", data: {...}}
        let eventData: any;
        if (
          (incomingData as IncomingEventData).type === "event" &&
          (incomingData as IncomingEventData).data
        ) {
          eventData = (incomingData as IncomingEventData).data;
        } else {
          eventData = incomingData;
        }

        // Normaliser les noms de champs (camelCase vers snake_case)
        const event: EventType = {
          id: eventData.id,
          name: eventData.name,
          description: eventData.description || "",
          dateDebut: eventData.dateDebut || eventData.startDate || "",
          dateFin: eventData.dateFin || eventData.endDate || "",
          statut: eventData.statut || "actif",
        };

        console.log("📦 Traitement événement:", event.name);

        const existing = db.getFirstSync<EventType>(
          "SELECT id FROM event WHERE id = ?",
          [event.id]
        );

        if (existing) {
          db.runSync(
            "UPDATE event SET name = ?, description = ?, dateDebut = ?, dateFin = ?, statut = ? WHERE id = ?",
            [
              event.name || "",
              event.description || "",
              event.dateDebut || "",
              event.dateFin || "",
              event.statut || "actif",
              event.id,
            ]
          );
          updatedCount++;
        } else {
          db.runSync(
            "INSERT INTO event (id, name, description, dateDebut, dateFin, statut) VALUES (?, ?, ?, ?, ?, ?)",
            [
              event.id,
              event.name || "",
              event.description || "",
              event.dateDebut || "",
              event.dateFin || "",
              event.statut || "actif",
            ]
          );
          insertedCount++;
        }

        // Insérer les parcours si présents
        if (eventData.parcours && Array.isArray(eventData.parcours)) {
          for (const parcours of eventData.parcours) {
            const existingParcours = db.getFirstSync(
              "SELECT id FROM parcours WHERE id = ?",
              [parcours.id]
            );

            const wkt = parcours.geometryJson || parcours.wkt || "";

            if (!existingParcours) {
              db.runSync(
                "INSERT INTO parcours (id, event_id, wkt) VALUES (?, ?, ?)",
                [parcours.id, event.id, wkt]
              );
              parcoursCount++;
            } else {
              db.runSync("UPDATE parcours SET wkt = ? WHERE id = ?", [
                wkt,
                parcours.id,
              ]);
            }
          }
        }

        // Insérer les zones si présentes
        if (eventData.zones && Array.isArray(eventData.zones)) {
          for (const zone of eventData.zones) {
            const existingZone = db.getFirstSync(
              "SELECT id FROM zone WHERE id = ?",
              [zone.id]
            );

            const wkt = zone.geometryJson || zone.wkt || "";

            if (!existingZone) {
              db.runSync(
                "INSERT INTO zone (id, event_id, wkt) VALUES (?, ?, ?)",
                [zone.id, event.id, wkt]
              );
              zonesCount++;
            } else {
              db.runSync("UPDATE zone SET wkt = ? WHERE id = ?", [
                wkt,
                zone.id,
              ]);
            }
          }
        }

        // Insérer les points si présents
        if (eventData.points && Array.isArray(eventData.points)) {
          for (const point of eventData.points) {
            const existingPoint = db.getFirstSync(
              "SELECT id FROM point WHERE id = ?",
              [point.id]
            );

            if (!existingPoint) {
              db.runSync(
                "INSERT INTO point (id, event_id, x, y, name, comment, type, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                [
                  point.id,
                  event.id,
                  point.x,
                  point.y,
                  point.name || "Point",
                  point.comment || null,
                  point.type || null,
                  point.status !== undefined ? (point.status ? 1 : 0) : 0,
                ]
              );
              pointsCount++;
            } else {
              db.runSync(
                "UPDATE point SET x = ?, y = ?, name = ?, comment = ?, type = ?, status = ? WHERE id = ?",
                [
                  point.x,
                  point.y,
                  point.name || "Point",
                  point.comment || null,
                  point.type || null,
                  point.status !== undefined ? (point.status ? 1 : 0) : 0,
                  point.id,
                ]
              );
            }
          }
        }

        // Insérer les équipes si présentes
        if (eventData.teams && Array.isArray(eventData.teams)) {
          for (const team of eventData.teams) {
            const teamEventId = team.eventId || team.event_id || event.id;

            const existingTeam = db.getFirstSync(
              "SELECT id FROM team WHERE id = ?",
              [team.id]
            );

            if (!existingTeam) {
              db.runSync(
                "INSERT INTO team (id, event_id, name) VALUES (?, ?, ?)",
                [team.id, teamEventId, team.name]
              );
              teamsCount++;
            } else {
              db.runSync("UPDATE team SET name = ? WHERE id = ?", [
                team.name,
                team.id,
              ]);
            }
          }
        }

        // Insérer les équipements si présents (nouveau format)
        if (eventData.equipements && Array.isArray(eventData.equipements)) {
          for (const equipement of eventData.equipements) {
            const existingEquipement = db.getFirstSync(
              "SELECT id FROM equipement WHERE id = ?",
              [equipement.id]
            );

            // Calculer le point_id à partir de la première coordonnée ou null
            let pointId = null;
            if (equipement.coordinates && equipement.coordinates.length > 0) {
              const firstCoord = equipement.coordinates[0];
              pointId = firstCoord.id;

              // Insérer ce point s'il n'existe pas
              const existingCoordPoint = db.getFirstSync(
                "SELECT id FROM point WHERE id = ?",
                [firstCoord.id]
              );

              if (!existingCoordPoint) {
                db.runSync(
                  "INSERT INTO point (id, event_id, x, y, name, comment, type, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                  [
                    firstCoord.id,
                    event.id,
                    firstCoord.x,
                    firstCoord.y,
                    `Équipement - Coord ${firstCoord.orderIndex + 1}`,
                    null,
                    "equipement",
                    0,
                  ]
                );
                pointsCount++;
              }
            }

            // Insérer ou mettre à jour l'équipement (schéma Tauri: event_id obligatoire, pas de point_id)
            if (!existingEquipement) {
              db.runSync(
                "INSERT INTO equipement (id, event_id, type_id, quantity, length_per_unit, date_pose, date_depose) VALUES (?, ?, ?, ?, ?, ?, ?)",
                [
                  equipement.id,
                  event.id,
                  equipement.typeId || null,
                  equipement.quantity || 1,
                  equipement.lengthPerUnit || 0,
                  equipement.datePose || null,
                  equipement.dateDepose || null,
                ]
              );
              equipementsCount++;
            } else {
              db.runSync(
                "UPDATE equipement SET event_id = ?, type_id = ?, quantity = ?, length_per_unit = ?, date_pose = ?, date_depose = ? WHERE id = ?",
                [
                  event.id,
                  equipement.typeId || null,
                  equipement.quantity || 1,
                  equipement.lengthPerUnit || 0,
                  equipement.datePose || null,
                  equipement.dateDepose || null,
                  equipement.id,
                ]
              );
            }

            // Insérer toutes les coordonnées dans equipement_coordinate
            if (
              equipement.coordinates &&
              Array.isArray(equipement.coordinates)
            ) {
              // Supprimer les anciennes coordonnées
              db.runSync(
                "DELETE FROM equipement_coordinate WHERE equipement_id = ?",
                [equipement.id]
              );

              for (const coord of equipement.coordinates) {
                db.runSync(
                  "INSERT INTO equipement_coordinate (id, equipement_id, x, y, order_index) VALUES (?, ?, ?, ?, ?)",
                  [
                    coord.id,
                    equipement.id,
                    coord.x,
                    coord.y,
                    coord.orderIndex || 0,
                  ]
                );

                // Créer aussi un point pour chaque coordonnée (pour le guidage)
                const existingCoord = db.getFirstSync(
                  "SELECT id FROM point WHERE id = ?",
                  [coord.id]
                );

                if (!existingCoord) {
                  db.runSync(
                    "INSERT INTO point (id, event_id, x, y, name, comment, type, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    [
                      coord.id,
                      event.id,
                      coord.x,
                      coord.y,
                      `Équipement - Coord ${coord.orderIndex + 1}`,
                      null,
                      "equipement",
                      0,
                    ]
                  );
                  pointsCount++;
                }
              }
            }
          }
        }

        // Insérer les actions si présentes
        if (eventData.actions && Array.isArray(eventData.actions)) {
          for (const actionData of eventData.actions) {
            const action = {
              id: actionData.id,
              team_id: actionData.teamId || actionData.team_id,
              equipement_id:
                actionData.equipementId || actionData.equipement_id,
              type: actionData.actionType || actionData.type || null,
              scheduled_time:
                actionData.scheduledTime || actionData.scheduled_time || null,
              is_done:
                actionData.isDone !== undefined
                  ? actionData.isDone
                    ? 1
                    : 0
                  : actionData.is_done !== undefined
                    ? actionData.is_done
                    : 0,
            };

            console.log("📝 Insertion action:", action);

            // Vérifier si l'équipement référencé existe, sinon le créer
            if (action.equipement_id) {
              const existingEquip = db.getFirstSync(
                "SELECT id FROM equipement WHERE id = ?",
                [action.equipement_id]
              );

              if (!existingEquip) {
                console.log(
                  "⚠️ Création équipement manquant:",
                  action.equipement_id
                );
                db.runSync(
                  "INSERT INTO equipement (id, event_id, type_id, quantity, length_per_unit) VALUES (?, ?, ?, ?, ?)",
                  [action.equipement_id, event.id, null, 1, 0]
                );
                equipementsCount++;
              }
            }

            const existingAction = db.getFirstSync(
              "SELECT id FROM action WHERE id = ?",
              [action.id]
            );

            if (!existingAction) {
              db.runSync(
                "INSERT INTO action (id, team_id, equipement_id, type, scheduled_time, is_done) VALUES (?, ?, ?, ?, ?, ?)",
                [
                  action.id,
                  action.team_id,
                  action.equipement_id,
                  action.type,
                  action.scheduled_time,
                  action.is_done,
                ]
              );
              actionsCount++;
            } else {
              db.runSync(
                "UPDATE action SET team_id = ?, equipement_id = ?, type = ?, scheduled_time = ?, is_done = ? WHERE id = ?",
                [
                  action.team_id,
                  action.equipement_id,
                  action.type,
                  action.scheduled_time,
                  action.is_done,
                  action.id,
                ]
              );
            }
          }
        }

        console.log(
          `✅ Équipes: ${teamsCount}, Actions: ${actionsCount}, Équipements: ${equipementsCount}`
        );
      }

      console.log(
        `✅ ${insertedCount} événement(s) inséré(s), ${updatedCount} mis à jour`
      );
      console.log(
        `✅ ${parcoursCount} parcours, ${zonesCount} zones, ${pointsCount} points`
      );
      console.log(
        `✅ ${equipementsCount} équipements, ${teamsCount} équipes, ${actionsCount} actions`
      );
      setTransferStatus(
        `${insertedCount + updatedCount} événement(s)\n${pointsCount} points, ${equipementsCount} équipements\n${teamsCount} équipes, ${actionsCount} actions`
      );
    } catch (error) {
      console.error("❌ Erreur lors de l'insertion des événements:", error);
      throw error;
    }
  };

  // Insérer les données de planning (actions, équipes, équipements) pour l'événement actuel
  const insertPlanningData = (
    planningData: any
  ): { success: boolean; message: string } => {
    try {
      if (!selectedEventId) {
        return { success: false, message: "Aucun événement sélectionné" };
      }

      let teamsCount = 0;
      let actionsCount = 0;
      let equipementsCount = 0;
      let coordsCount = 0;
      let skippedTeams = 0;

      const actionsArray = planningData.actions || [];

      for (const actionGroup of actionsArray) {
        // Vérifier que l'équipe appartient à l'événement actuel
        const team = actionGroup.team;
        if (!team || team.eventId !== selectedEventId) {
          console.log(
            `⚠️ Équipe ignorée (eventId: ${team?.eventId} !== ${selectedEventId})`
          );
          skippedTeams++;
          continue;
        }

        // Insérer/mettre à jour l'équipe
        const existingTeam = db.getFirstSync(
          "SELECT id FROM team WHERE id = ?",
          [team.id]
        );

        if (!existingTeam) {
          db.runSync("INSERT INTO team (id, event_id, name) VALUES (?, ?, ?)", [
            team.id,
            team.eventId,
            team.name,
          ]);
          teamsCount++;
        } else {
          db.runSync("UPDATE team SET name = ? WHERE id = ?", [
            team.name,
            team.id,
          ]);
        }

        // Insérer les équipements
        const equipements = actionGroup.equipements || [];
        for (const equip of equipements) {
          // Vérifier que l'équipement appartient à l'événement actuel
          if (equip.eventId !== selectedEventId) {
            console.log(
              `⚠️ Équipement ignoré (eventId: ${equip.eventId} !== ${selectedEventId})`
            );
            continue;
          }

          const existingEquip = db.getFirstSync(
            "SELECT id FROM equipement WHERE id = ?",
            [equip.id]
          );

          if (!existingEquip) {
            db.runSync(
              "INSERT INTO equipement (id, event_id, type_id, quantity, length_per_unit, date_pose, date_depose) VALUES (?, ?, ?, ?, ?, ?, ?)",
              [
                equip.id,
                equip.eventId,
                equip.typeId || null,
                equip.quantity || 1,
                equip.lengthPerUnit || 0,
                equip.datePose || null,
                equip.dateDepose || null,
              ]
            );
            equipementsCount++;
          } else {
            db.runSync(
              "UPDATE equipement SET type_id = ?, quantity = ?, length_per_unit = ?, date_pose = ?, date_depose = ? WHERE id = ?",
              [
                equip.typeId || null,
                equip.quantity || 1,
                equip.lengthPerUnit || 0,
                equip.datePose || null,
                equip.dateDepose || null,
                equip.id,
              ]
            );
          }

          // Insérer les coordonnées de l'équipement
          const coordinates = equip.coordinates || [];
          for (const coord of coordinates) {
            const existingCoord = db.getFirstSync(
              "SELECT id FROM equipement_coordinate WHERE id = ?",
              [coord.id]
            );

            if (!existingCoord) {
              db.runSync(
                "INSERT INTO equipement_coordinate (id, equipement_id, x, y, order_index) VALUES (?, ?, ?, ?, ?)",
                [
                  coord.id,
                  coord.equipementId,
                  coord.x,
                  coord.y,
                  coord.orderIndex || 0,
                ]
              );
              coordsCount++;
            }
          }
        }

        // Insérer les coordonnées globales (si présentes au niveau du groupe)
        const globalCoords =
          actionGroup.coordonees || actionGroup.coordinates || [];
        for (const coord of globalCoords) {
          const existingCoord = db.getFirstSync(
            "SELECT id FROM equipement_coordinate WHERE id = ?",
            [coord.id]
          );

          if (!existingCoord) {
            db.runSync(
              "INSERT INTO equipement_coordinate (id, equipement_id, x, y, order_index) VALUES (?, ?, ?, ?, ?)",
              [
                coord.id,
                coord.equipementId,
                coord.x,
                coord.y,
                coord.orderIndex || 0,
              ]
            );
            coordsCount++;
          }
        }

        // Insérer les actions
        const actions = actionGroup.actions || [];
        for (const action of actions) {
          const existingAction = db.getFirstSync(
            "SELECT id FROM action WHERE id = ?",
            [action.id]
          );

          const isDone =
            action.is_done !== undefined
              ? action.is_done
                ? 1
                : 0
              : action.isDone
                ? 1
                : 0;

          if (!existingAction) {
            db.runSync(
              "INSERT INTO action (id, team_id, equipement_id, type, scheduled_time, is_done) VALUES (?, ?, ?, ?, ?, ?)",
              [
                action.id,
                action.team_id || action.teamId,
                action.equipement_id || action.equipementId,
                action.type || action.actionType || null,
                action.scheduled_time || action.scheduledTime || null,
                isDone,
              ]
            );
            actionsCount++;
          } else {
            db.runSync(
              "UPDATE action SET type = ?, scheduled_time = ?, is_done = ? WHERE id = ?",
              [
                action.type || action.actionType || null,
                action.scheduled_time || action.scheduledTime || null,
                isDone,
                action.id,
              ]
            );
          }
        }
      }

      console.log(
        `✅ Planning importé: ${teamsCount} équipes, ${actionsCount} actions, ${equipementsCount} équipements, ${coordsCount} coordonnées`
      );

      if (skippedTeams > 0) {
        console.log(
          `⚠️ ${skippedTeams} équipe(s) ignorée(s) (événement différent)`
        );
      }

      return {
        success: true,
        message: `${teamsCount} équipe(s), ${actionsCount} action(s), ${equipementsCount} équipement(s) importé(s)`,
      };
    } catch (error) {
      console.error("❌ Erreur insertion planning:", error);
      return { success: false, message: `Erreur: ${error}` };
    }
  };

  // Récupérer les données complètes d'un événement pour l'export
  const getEventExportData = (eventId: number): EventExportData | null => {
    try {
      const event = db.getFirstSync<EventType>(
        "SELECT * FROM event WHERE id = ?",
        [eventId]
      );
      if (!event) return null;

      const points = db.getAllSync<InterestPointsType>(
        `SELECT p.* FROM point p WHERE p.event_id = ?`,
        [eventId]
      );

      const pointsWithDetails: PointWithDetails[] = points.map((point) => {
        const pictures = db.getAllSync<PictureType>(
          "SELECT * FROM picture WHERE point_id = ?",
          [point.id]
        );

        return { ...point, pictures, equipements: [] };
      });

      // Récupérer les équipements de l'événement avec leurs coordonnées
      const equipements = db.getAllSync<any>(
        `SELECT e.*, t.name, t.description 
         FROM equipement e 
         LEFT JOIN type t ON e.type_id = t.id 
         WHERE e.event_id = ?`,
        [eventId]
      );

      // Ajouter les coordonnées à chaque équipement
      const equipementsWithCoords = (equipements || []).map((eq: any) => {
        const coords = db.getAllSync<any>(
          "SELECT * FROM equipement_coordinate WHERE equipement_id = ? ORDER BY order_index",
          [eq.id]
        );
        return { ...eq, coordinates: coords || [] };
      });

      return {
        event: eventToSend || event,
        points: pointsWithDetails,
        equipements: equipementsWithCoords,
      };
    } catch (error) {
      console.error("Erreur récupération données export:", error);
      return null;
    }
  };

  const handleBarCodeScanned = ({ type, data }: BarcodeScanningResult) => {
    if (!scanned) {
      setScanned(true);
      setIsTransferring(true);
      setTransferStatus("Connexion en cours...");
      setReceivedCount(0);

      const websocketUri: string = data.startsWith("ws")
        ? data
        : `ws://${data}`;
      const client = new WebSocketClient(websocketUri);
      setCurrentClient(client);

      if (mode === "send" && eventToSend) {
        // Mode ENVOI: connecter et envoyer l'événement
        client.setCallbacks(
          () => {
            // onFinished
            setTransferStatus("Export terminé avec succès !");
            setTimeout(() => {
              handleCloseConnection();
              onExportSuccess?.();
            }, 2000);
          },
          (error) => {
            // onError
            setTransferStatus(`Erreur: ${error}`);
          }
        );

        // Configurer le callback de fermeture
        client.setOnClose(() => {
          console.log("🚪 Connexion fermée par le serveur");
          handleCloseConnection();
        });

        client.setOnResponse((response: WebSocketResponse) => {
          console.log("📨 Réponse serveur:", response);
          if (response.code === 3) {
            setTransferStatus("✅ " + response.message);
            setTimeout(() => {
              handleCloseConnection();
              onExportSuccess?.();
            }, 2000);
          } else {
            setTransferStatus(`Erreur: ${response.message}`);
          }
        });

        client
          .connect()
          .then(() => {
            console.log("✅ Connecté, envoi de l'événement...");
            setTransferStatus("Connecté ! Envoi des données...");

            // Récupérer et envoyer les données
            const exportData = getEventExportData(eventToSend.id);
            if (exportData) {
              console.log(
                "📤 Envoi:",
                exportData.event.name,
                "avec",
                exportData.points.length,
                "points"
              );
              client.send(JSON.stringify(exportData));
              setTransferStatus(
                `Envoi de ${exportData.points.length} point(s)...`
              );
            } else {
              setTransferStatus("Erreur: données non trouvées");
            }
          })
          .catch((error: string) => {
            console.error("❌ Erreur connexion:", error);
            setTransferStatus(`Erreur: ${error}`);
            setTimeout(() => {
              client.close();
              setCurrentClient(null);
              setIsTransferring(false);
              setScanned(false);
              setScanQR(false);
            }, 3000);
          });
      } else {
        // Mode RÉCEPTION: attendre les événements du desktop
        const onEventsReceived = (data: any) => {
          console.log(
            "📦 Données reçues:",
            JSON.stringify(data).substring(0, 200)
          );
          try {
            // Vérifier si c'est des données de planning
            if (data.type === "planning_data" || dataType === "planning") {
              console.log("📋 Données de planning détectées");

              if (!selectedEventId) {
                setTransferStatus("Erreur: Aucun événement sélectionné");
                Alert.alert(
                  "Erreur",
                  "Veuillez d'abord sélectionner un événement avant d'importer des données de planning."
                );
                return;
              }

              const result = insertPlanningData(data);
              if (result.success) {
                setTransferStatus(`✅ ${result.message}`);
                setReceivedCount((prev) => prev + 1);
                // Notifier le parent que l'import est réussi
                if (onImportSuccess) {
                  onImportSuccess();
                }
              } else {
                setTransferStatus(`❌ ${result.message}`);
              }
              return;
            }

            // Normaliser les données reçues en tableau (événements)
            let eventsArray: any[];
            if (Array.isArray(data)) {
              eventsArray = data;
            } else if (data.type === "event" && data.data) {
              // Nouveau format: {type: "event", data: {...}}
              eventsArray = [data];
            } else {
              // Ancien format: objet événement unique
              eventsArray = [data];
            }

            insertEvents(eventsArray);
            // Rafraîchir tous les contextes pour afficher immédiatement les données
            refreshEvents();
            refreshPoints();
            refreshGeometries();
            setReceivedCount((prev) => prev + eventsArray.length);
            setTransferStatus(`Événement reçu avec succès !`);
          } catch (error) {
            console.error("Erreur insertion:", error);
            setTransferStatus(`Erreur: ${error}`);
          }
        };

        // Configurer le callback de fermeture
        client.setOnClose(() => {
          console.log("🚪 Connexion fermée par le serveur");
          handleCloseConnection();
        });

        client
          .connect(onEventsReceived)
          .then(() => {
            console.log("✅ Connexion WebSocket établie");
            setTransferStatus("Connecté ! En attente des événements...");

            setWsClient(client);
            setIsConnected(true);
          })
          .catch((error: string) => {
            console.error("❌ Erreur connexion:", error);
            setTransferStatus(`Erreur: ${error}`);
            setTimeout(() => {
              client.close();
              setCurrentClient(null);
              setIsTransferring(false);
              setScanned(false);
              setScanQR(false);
            }, 3000);
          });
      }
    }
  };

  // Fonction pour fermer la connexion et le modal
  const handleCloseConnection = () => {
    if (currentClient) {
      currentClient.close();
      setCurrentClient(null);
    }
    setWsClient(null);
    setIsConnected(false);
    setIsTransferring(false);
    setScanned(false);
    setScanQR(false);
  };

  return (
    <View style={scannerStyles.container}>
      {!isTransferring && (
        <CameraView
          style={StyleSheet.absoluteFillObject}
          barcodeScannerSettings={{
            barcodeTypes: ["qr"],
          }}
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          facing="back"
        />
      )}

      {!isTransferring && (
        <View style={scannerStyles.overlay}>
          {/* Titre en haut */}
          <View style={scannerStyles.topSection}>
            <Text style={scannerStyles.title}>Scanner le QR Code</Text>
            <Text style={scannerStyles.subtitle}>
              {mode === "send"
                ? "Partagez cet événement avec un autre appareil"
                : dataType === "planning"
                  ? "Scannez pour recevoir le planning"
                  : "Positionnez le code QR dans le cadre"}
            </Text>
          </View>

          {/* Zone de scan avec cadre animé */}
          <View style={scannerStyles.scanArea}>
            <View style={scannerStyles.scanFrame}>
              {/* Coins du cadre */}
              <View
                style={[scannerStyles.corner, scannerStyles.cornerTopLeft]}
              />
              <View
                style={[scannerStyles.corner, scannerStyles.cornerTopRight]}
              />
              <View
                style={[scannerStyles.corner, scannerStyles.cornerBottomLeft]}
              />
              <View
                style={[scannerStyles.corner, scannerStyles.cornerBottomRight]}
              />
            </View>
          </View>

          {/* Instructions en bas */}
          <View style={scannerStyles.bottomSection}>
            <View style={scannerStyles.instructionCard}>
              <Text style={scannerStyles.instructionTitle}>
                {scanned ? "✓ Code détecté !" : "Alignez le QR code"}
              </Text>
              <Text style={scannerStyles.instructionText}>
                {scanned
                  ? "Connexion en cours..."
                  : "Le code sera scanné automatiquement"}
              </Text>
            </View>
          </View>
        </View>
      )}

      <Modal visible={isTransferring} transparent={true} animationType="fade">
        <View style={scannerStyles.modalOverlay}>
          <View style={scannerStyles.modalContent}>
            {/* Icône et spinner */}
            <View style={scannerStyles.modalIconContainer}>
              <ActivityIndicator size="large" color="#4CAF50" />
            </View>

            {/* Titre */}
            <Text style={scannerStyles.modalTitle}>
              {mode === "send" ? "Export en cours" : "Synchronisation"}
            </Text>

            {/* Statut */}
            <Text style={scannerStyles.modalStatus}>{transferStatus}</Text>

            {/* Informations supplémentaires */}
            {mode === "send" && eventToSend && (
              <View style={scannerStyles.modalInfoCard}>
                <Text style={scannerStyles.modalInfoLabel}>Événement:</Text>
                <Text style={scannerStyles.modalInfoValue}>
                  {eventToSend.name}
                </Text>
              </View>
            )}
            {mode === "receive" && receivedCount > 0 && (
              <View style={scannerStyles.modalInfoCard}>
                <Text style={scannerStyles.modalInfoSuccess}>
                  ✓ {receivedCount} élément(s) reçu(s)
                </Text>
              </View>
            )}

            {/* Bouton fermer */}
            <TouchableOpacity
              style={scannerStyles.modalButton}
              onPress={handleCloseConnection}
              activeOpacity={0.8}
            >
              <Text style={scannerStyles.modalButtonText}>
                {mode === "send" ? "Annuler" : "Fermer"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const scannerStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
    paddingVertical: 60,
  },
  topSection: {
    alignItems: "center",
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 8,
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 16,
    color: "#e0e0e0",
    textAlign: "center",
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  scanArea: {
    alignItems: "center",
    justifyContent: "center",
  },
  scanFrame: {
    width: SCANNER_SIZE,
    height: SCANNER_SIZE,
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: 40,
    height: 40,
    borderColor: "#4CAF50",
    borderWidth: 4,
  },
  cornerTopLeft: {
    top: 0,
    left: 0,
    borderBottomWidth: 0,
    borderRightWidth: 0,
    borderTopLeftRadius: 8,
  },
  cornerTopRight: {
    top: 0,
    right: 0,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    borderTopRightRadius: 8,
  },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderTopWidth: 0,
    borderRightWidth: 0,
    borderBottomLeftRadius: 8,
  },
  cornerBottomRight: {
    bottom: 0,
    right: 0,
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderBottomRightRadius: 8,
  },
  bottomSection: {
    paddingHorizontal: 20,
    alignItems: "center",
  },
  instructionCard: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 16,
    padding: 20,
    width: "100%",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  instructionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  instructionText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },
  // Styles pour la modal de synchronisation
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 32,
    width: "90%",
    maxWidth: 400,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  modalIconContainer: {
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 12,
    textAlign: "center",
  },
  modalStatus: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 24,
  },
  modalInfoCard: {
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    padding: 16,
    width: "100%",
    marginBottom: 20,
  },
  modalInfoLabel: {
    fontSize: 12,
    color: "#999",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  modalInfoValue: {
    fontSize: 16,
    color: "#333",
    fontWeight: "600",
  },
  modalInfoSuccess: {
    fontSize: 16,
    color: "#4CAF50",
    fontWeight: "600",
    textAlign: "center",
  },
  modalButton: {
    backgroundColor: "#FF5252",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    width: "100%",
    alignItems: "center",
    shadowColor: "#FF5252",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  modalButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
});

export default QRCodeScanner;
