import { Pressable, Text } from "react-native";

interface CustomButtonProps {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  fullWidth?: boolean;
}

export default function CustomButton({
  title,
  onPress,
  variant = "primary",
  disabled = false,
  fullWidth = false,
}: CustomButtonProps) {
  const getVariantClasses = () => {
    switch (variant) {
      case "primary":
        return "bg-blue-600 active:bg-blue-700";
      case "secondary":
        return "bg-gray-600 active:bg-gray-700";
      case "danger":
        return "bg-red-600 active:bg-red-700";
      default:
        return "bg-blue-600 active:bg-blue-700";
    }
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`
        py-3 px-6 rounded-lg
        ${getVariantClasses()}
        ${disabled ? "opacity-50" : ""}
        ${fullWidth ? "w-full" : ""}
      `}
    >
      <Text className="text-white text-center font-semibold text-base">
        {title}
      </Text>
    </Pressable>
  );
}