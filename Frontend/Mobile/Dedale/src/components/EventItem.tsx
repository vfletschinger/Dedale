import { View, Text, Pressable } from "react-native";
import { EventType } from "../types/database";

interface EventItemProps {
  event: EventType;
  onPress: (event: EventType) => void;
}

export default function EventItem({ event, onPress }: EventItemProps) {
  const getEventStatus = () => {
    const now = new Date();
    const dateDebut = new Date(event.dateDebut);
    const dateFin = new Date(event.dateFin);

    if (now < dateDebut) {
      return {
        label: "planifié",
        color: "bg-blue-100",
        textColor: "text-blue-700",
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
          <View className="bg-blue-500 rounded-full w-12 h-12 items-center justify-center mr-3">
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
        <View className="bg-blue-50 rounded-full px-3 py-1">
          <Text className="text-blue-600 text-xs font-semibold">→</Text>
        </View>
      </View>

      <View className="h-px bg-gray-100 mb-3" />

      {/* Description */}
      <Text className="text-gray-600 text-sm mb-3" numberOfLines={2}>
        {event.description}
      </Text>

      {/* Dates */}
      <View className="flex-row items-center">
        <Text className="text-gray-400 text-xs">
          📍 Du {new Date(event.dateDebut).toLocaleDateString("fr-FR")} au{" "}
          {new Date(event.dateFin).toLocaleDateString("fr-FR")}
        </Text>
      </View>
    </Pressable>
  );
}
