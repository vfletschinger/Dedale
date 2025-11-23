import React from "react";
import {
  View,
  Text,
  Modal,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from "react-native";

type EditModalProps = {
  visible: boolean;
  title: string;
  value: string;
  onChangeText: (text: string) => void;
  onSave: () => void;
  onCancel: () => void;
  placeholder?: string;
  multiline?: boolean;
  numberOfLines?: number;
  keyboardType?: "default" | "numeric" | "email-address";
};

export default function EditModal({
  visible,
  title,
  value,
  onChangeText,
  onSave,
  onCancel,
  placeholder = "",
  multiline = false,
  numberOfLines = 1,
  keyboardType = "default",
}: EditModalProps) {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onCancel}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <View className="flex-1 justify-center items-center bg-black/50 p-4">
          <View className="bg-white rounded-3xl p-6 w-full max-w-lg max-h-[85%]">
            <Text className="text-2xl font-bold mb-4 text-center">{title}</Text>

            <TextInput
              value={value}
              onChangeText={onChangeText}
              multiline={multiline}
              numberOfLines={numberOfLines}
              keyboardType={keyboardType}
              className="border border-gray-300 rounded-lg p-3 mb-4"
              placeholder={placeholder}
            />

            <View className="flex-row gap-3">
              <Pressable
                onPress={onCancel}
                className="flex-1 bg-gray-300 py-3 rounded-lg"
              >
                <Text className="text-center font-semibold">Annuler</Text>
              </Pressable>
              <Pressable
                onPress={onSave}
                className="flex-1 bg-blue-500 py-3 rounded-lg"
              >
                <Text className="text-center text-white font-semibold">
                  Enregistrer
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
