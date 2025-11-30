import { Stack } from "expo-router";

export default function MainLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)"/>        
      <Stack.Screen name="suggestedLines"/>
      <Stack.Screen name="linePreview"/>   
      <Stack.Screen name="requestDetails"/>
    </Stack>
  );
}
