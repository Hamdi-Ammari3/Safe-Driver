import { useEffect, useState } from "react";
import { Image, StyleSheet, ActivityIndicator } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Redirect } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { checkDriverStatus } from "../utils/authUtils";

SplashScreen.preventAutoHideAsync();

export default function Index() {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    const init = async () => {
      const result = await checkDriverStatus();
      setStatus(result);
      await SplashScreen.hideAsync();
    };
    init();
  }, []);

  if (!status) {
    return (
      <SafeAreaView style={styles.splashContainer}>
        <Image
          source={require("../assets/images/icon.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <ActivityIndicator size="small" color="#007AFF" style={{ marginTop: 5 }} />
      </SafeAreaView>
    );
  }

  if (status === "unauthenticated") return <Redirect href="/(auth)/welcome" />;
  if (status === "incomplete_profile") return <Redirect href="/(setup)/completeDriverProfile" />;
  return <Redirect href="/(main)/(tabs)/home" />;
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent:'center',
    backgroundColor: "#fff",
  },
  logo: {
    width: 150,
    height: 150,
  },
});
