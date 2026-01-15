import { View, Text, Pressable } from "react-native";
import { EventType } from "../types/database";
import { EventWithStatus } from "../context/EventContext";

interface EventItemProps {
  event: EventType | EventWithStatus;
  onPress: (event: EventType | EventWithStatus) => void;
  navArrow?: boolean;
}

// Type guard pour vérifier si c'est un EventWithStatus
function hasCalculatedStatus(
  event: EventType | EventWithStatus
): event is EventWithStatus {
  return "calculatedStatus" in event;
}

export default function EventItem({
  event,
  onPress,
  navArrow = true,
}: EventItemProps) {
  const getEventStatus = () => {
    // Utiliser le statut calculé s'il existe, sinon le calculer
    if (hasCalculatedStatus(event)) {
      const statusLabel = event.calculatedStatus;
      switch (statusLabel) {
        case "planifié":
          return {
            label: "planifié",
            color: "bg-secondary/20",
            textColor: "text-secondary",
          };
        case "passé":
          return {
            label: "passé",
            color: "bg-gray-100",
            textColor: "text-gray-600",
          };
        case "actif":
        default:
          return {
            label: "actif",
            color: "bg-green-100",
            textColor: "text-green-700",
          };
      }
    }

    const now = new Date();
    const dateDebut = new Date(event.dateDebut!);
    const dateFin = new Date(event.dateFin!);

    if (now < dateDebut) {
      return {
        label: "planifié",
        color: "bg-secondary/20",
        textColor: "text-secondary",
      };
    } else if (now > dateFin) {
      return {
        label: "passé",
        color: "bg-gray-100",
        textColor: "text-gray-600",
      };
    } else {
      return {
        label: "actif",
        color: "bg-green-100",
        textColor: "text-green-700",
      };
    }
  };

  const status = getEventStatus();

  return (
    <Pressable
      onPress={() => onPress(event)}
      className="bg-white rounded-2xl p-5 mb-4 mx-4 shadow-md active:shadow-lg"
    >
      <View className="flex-row items-center justify-between mb-3">
        {/* Badge événement */}
        <View className="flex-row items-center flex-1">
          <View className="bg-secondary rounded-full w-12 h-12 items-center justify-center mr-3">
            <Text className="text-white text-2xl">📅</Text>
          </View>
          <View className="flex-1">
            <Text className="text-gray-800 font-bold text-lg">
              {event.name}
            </Text>
            <View
              className={`rounded-full px-3 py-1 self-start mt-1 ${status.color}`}
            >
              <Text className={`text-xs font-semibold ${status.textColor}`}>
                {status.label}
              </Text>
            </View>
          </View>
        </View>

        {/* Flèche navigation */}
        {navArrow && (
          <View className="bg-secondary/10 rounded-full px-3 py-1">
            <Text className="text-secondary text-xs font-semibold">→</Text>
          </View>
        )}
      </View>

      <View className="h-px bg-gray-100 mb-3" />

      {/* Description */}
      <Text className="text-gray-600 text-sm mb-3" numberOfLines={2}>
        {event.description}
      </Text>

      {/* Dates */}
      <View className="flex-row items-center">
        <Text className="text-gray-400 text-xs">
          📍 Du {new Date(event.dateDebut!).toLocaleDateString("fr-FR")} au{" "}
          {new Date(event.dateFin!).toLocaleDateString("fr-FR")}
        </Text>
      </View>
    </Pressable>
  );
}
