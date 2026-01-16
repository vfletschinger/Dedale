import { Pressable, Text } from "react-native";

interface CustomButtonProps {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  fullWidth?: boolean;
  className?: string;
}

export default function CustomButton({
  title,
  onPress,
  variant = "primary",
  disabled = false,
  fullWidth = false,
  className = "",
}: CustomButtonProps) {
  const getVariantClasses = () => {
    switch (variant) {
      case "primary":
        return "bg-primary active:bg-primary mb-2";
      case "secondary":
        return "bg-secondary active:bg-secondary mb-2";
      case "danger":
        return "bg-red-600 active:bg-red-700";
      default:
        return "bg-primary active:bg-primary";
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
        ${className}
      `}
    >
      <Text className="text-white text-center font-semibold text-base">
        {title}
      </Text>
    </Pressable>
  );
}