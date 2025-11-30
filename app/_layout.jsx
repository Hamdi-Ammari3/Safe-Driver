import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useFonts } from 'expo-font';

export default function RootLayout() {

  const colorScheme = useColorScheme()

  const [loaded] = useFonts({
    NotoArabicRegular:require('../assets/fonts/NotoSansArabic_Condensed-Regular.ttf'),
    NotoArabicBold:require('../assets/fonts/NotoSansArabic_Condensed-Bold.ttf')
  })

  if (!loaded) return null;

  return(
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#f8f9fa' },
        }}
      >
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(setup)" />
        <Stack.Screen name="(main)" />
      </Stack>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
    </ThemeProvider>
  )
}
