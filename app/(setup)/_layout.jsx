import { Stack } from "expo-router";

export default function SetupLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="completeDriverProfile" />
    </Stack>
  )
}