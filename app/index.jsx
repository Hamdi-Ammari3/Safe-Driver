import { useEffect, useState } from "react";
import { Image, View, StyleSheet, ActivityIndicator } from "react-native";
import { Redirect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SplashScreen from "expo-splash-screen";

SplashScreen.preventAutoHideAsync();

export default function Index() {
  const [loading, setLoading] = useState(true);
  const [redirectPath, setRedirectPath] = useState(null);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const driver = await AsyncStorage.getItem("SAFE_DRIVER_USER");

        if (driver) {
          setRedirectPath("/(main)/(tabs)/home");
        } else {
          setRedirectPath("/(auth)/login");
        }

      } catch (e) {
        console.log("Session check error:", e);
        setRedirectPath("/(auth)/login");
      } finally {
        setLoading(false);
        await SplashScreen.hideAsync();
      }
    };

    checkSession();
  }, []);

  if (loading) {
    return (
      <View style={styles.splashContainer}>
        <Image
          source={require("../assets/images/icon.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <ActivityIndicator size="small" color="#007AFF" style={{ marginTop: 20 }} />
      </View>
    );
  }

  return <Redirect href={redirectPath} />;
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  logo: {
    width: 160,
    height: 160,
  },
});
