import { useState,useEffect,useRef,useCallback } from "react"
import {StyleSheet,Text,View,TouchableOpacity,ScrollView,ActivityIndicator,Image,Dimensions,Animated as RNAnimated,Platform,Modal} from "react-native"
import MapView, { Marker } from 'react-native-maps'
import * as Location from "expo-location"
import * as Notifications from "expo-notifications"
import Constants from "expo-constants"
import { getDoc,doc,updateDoc} from "firebase/firestore"
import { DB } from "../../../firebaseConfig"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { SafeAreaView,useSafeAreaInsets } from "react-native-safe-area-context"
import { router,useFocusEffect } from 'expo-router'
import { FontAwesome5,Ionicons } from "@expo/vector-icons"
import school from '../../../assets/images/school.png'
import house from '../../../assets/images/house.png'
import Animated, {useSharedValue,withTiming,withRepeat,withSequence,useAnimatedStyle,Easing,runOnJS} from "react-native-reanimated";

const { width, height } = Dimensions.get("window")

const Home = () => {
  const mapRef = useRef(null)
  const sheetAnim = useRef(new RNAnimated.Value(1000)).current;
  const fadeAnim = useRef(new RNAnimated.Value(0)).current;
  const scaleAnim = useRef(new RNAnimated.Value(0.8)).current;
  const bounceAnim = useRef(new RNAnimated.Value(0)).current;
  const pulseAnim2 = useRef(new RNAnimated.Value(1)).current;
  const pingAnim = useRef(new RNAnimated.Value(0)).current;

  const pillPulse = useSharedValue(1);

  const insets = useSafeAreaInsets();
  const baseHeight = 60;
  const tabBarHeight = baseHeight + (Platform.OS === "ios" ? Math.max(insets.bottom, 8) : Math.max(insets.bottom, 10));
  const bottomMenuOffset = tabBarHeight - baseHeight + 20;

  //State varialbles
  const [initializing, setInitializing] = useState(false)
  const [region, setRegion] = useState({latitude:33.3128,longitude:44.3615,latitudeDelta:5,longitudeDelta:5})
  const [driverProfile,setDriverProfile] = useState(null)
  const [selectedLine, setSelectedLine] = useState(null)
  const [requestsVisible, setRequestsVisible] = useState(false)
  const [hasLocationPermission, setHasLocationPermission] = useState(false)
  const [iconReady, setIconReady] = useState(false)

  // Track individual markers to prevent premature stopping
  const markersLoadedRef = useRef({ house: false, school: false })

  const handleIconLoad = (markerType) => {
    markersLoadedRef.current[markerType] = true
  
    // Only stop tracking when BOTH markers are loaded
    if (markersLoadedRef.current.house && markersLoadedRef.current.school) {
      setTimeout(() => {
        setIconReady(true)
      }, 200)
    }
  }

  //Fetch driver doc
  const fetchDriverProfile = async () => {
    try {
      setInitializing(true);

      const driverPhone = await AsyncStorage.getItem("safeTransDriver");
      if (!driverPhone) {
        setDriverProfile(null);
        return;
      }

      const driverRef = doc(DB, "drivers", driverPhone);
      const driverSnap = await getDoc(driverRef);

      if (driverSnap.exists()) {
        setDriverProfile({ id: driverSnap.id, ...driverSnap.data() });
      } else {
        setDriverProfile(null);
      }
    } catch (error) {
      console.log("❌ Error fetching driver profile:", error);
    } finally {
      setInitializing(false);
    }
  }

  //Check notification token update
  const updateUserNotificationToken = async () => {
    try {
      //Get user ID
      const userId = await AsyncStorage.getItem("safeTransDriver");
      if (!userId) return;

      const userRef = doc(DB, "users", userId);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) return;

      const savedTokenInDB = userSnap.data().notification_token || null;

      //Ask Expo for a new token
      const newTokenObj = await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig.extra.eas.projectId,
      });

      const newToken = newTokenObj.data;

      //Handle denied permission
      if (!newToken) {
        return;
      }

      //If Firestore token is SAME → no update needed
      if (newToken === savedTokenInDB) {
        return;
      }

      //Update Firestore token
      await updateDoc(userRef, {
        notification_token: newToken
      });

      //Update local storage copy (optional)
      await AsyncStorage.setItem("expoPushToken", newToken);

    } catch (err) {
      console.log("❌ Error refreshing notification token:", err);
    }
  }

  //Run notification update check each time the home page loads
  useEffect(() => {
    updateUserNotificationToken();
  }, [])

  //Select first line by default
  useEffect(() => {
    if (driverProfile?.lines?.length > 0) {
      setSelectedLine(driverProfile.lines[0]);
    }
  }, [driverProfile])

  //Map centered around first line items
  useEffect(() => {
    if (!selectedLine || !mapRef.current) return;

    const coords = [
      ...selectedLine?.riders.map(r => r?.home_location),
      selectedLine?.destination_location,
    ];

    // Avoid running too early
    setTimeout(() => {
      if (coords.length > 0) {
        mapRef?.current?.fitToCoordinates(coords, {
          edgePadding: { top: 80, right: 80, bottom: 120, left: 80 },
          animated: true,
        });
      }
    }, 350);
  }, [selectedLine])

  //Center map manually
  const handleRecenter = async () => {
    setTimeout(() => {
      if (mapRef.current && selectedLine) {
        const coords = [
          ...selectedLine?.riders.map(r => r?.home_location),
          selectedLine?.destination_location,
        ];

        mapRef?.current?.fitToCoordinates(coords, {
          edgePadding: { top: 80, right: 80, bottom: 120, left: 80 },
          animated: true,
        });
      }
    }, 400);
  }

  //initialize the app
  useFocusEffect(
    useCallback(() => {
      let active = true;

      (async () => {
        try {
          setInitializing(true)
          setIconReady(false)
          markersLoadedRef.current = { house: false, school: false }
          await fetchDriverProfile();

          // Ask for permissions
          const { status } = await Location.requestForegroundPermissionsAsync();
          setHasLocationPermission(status === "granted");

        } catch (e) {
          console.log("fetch kids on focus", e);
        } finally {
          if (active) setInitializing(false);
        }
      })();

      return () => {active = false};
    }, [])
  )

  //Animate join request bill
  useEffect(() => {
    const count = selectedLine?.join_requests?.length || 0;

    if (count > 0) {
      pillPulse.value = withRepeat(
        withSequence(
          withTiming(1.08, { duration: 700, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
    } else {
      pillPulse.value = withTiming(1, { duration: 200 });
    }
  }, [selectedLine?.join_requests?.length])

  const pillAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: pillPulse.value }],
      shadowOpacity: 0.12 * (pillPulse.value - 1 + 1),
    };
  })

  // animated add new lines guidance
  useEffect(() => {
    if (initializing) return;

    // Fade + scale in content
    RNAnimated.parallel([
      RNAnimated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      RNAnimated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        useNativeDriver: true,
      }),
    ]).start();

    // Bounce for the arrow and icon
    RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(bounceAnim, {
          toValue: -10,
          duration: 800,
          useNativeDriver: true,
        }),
        RNAnimated.timing(bounceAnim, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Top circle "radiant ping"
    RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(pingAnim, {
          toValue: 1,
          duration: 4000,
          useNativeDriver: true,
        }),
        RNAnimated.timing(pingAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Bottom circle "soft pulse"
    RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(pulseAnim2, {
          toValue: 1.2,
          duration: 6000,
          useNativeDriver: true,
        }),
        RNAnimated.timing(pulseAnim2, {
          toValue: 1,
          duration: 6000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [initializing])

  //Driver movement tracking helpers
  const toRad = (v) => (v * Math.PI) / 180;

  //Driver movement tracking helpers (distance)
  const getDistanceKm = (loc1, loc2) => {
    if (!loc1 || !loc2) return 0;

    const R = 6371;
    const dLat = toRad(loc2.latitude - loc1.latitude);
    const dLng = toRad(loc2.longitude - loc1.longitude);

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(loc1.latitude)) *
        Math.cos(toRad(loc2.latitude)) *
        Math.sin(dLng / 2) ** 2;

    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  //Driver movement tracking
  useEffect(() => {
    if (!hasLocationPermission || !driverProfile?.id || !driverProfile?.lines?.length > 0) return;

    let interval = setInterval(async () => {
      try {
        const gps = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        const current = {
          latitude: gps.coords.latitude,
          longitude: gps.coords.longitude,
        };

        // Extract old & new from DB
        const loc = driverProfile?.location;
        if (!loc || !loc.new) return;

        const newDB = { latitude: loc.new[0], longitude: loc.new[1] };
        const oldDB = { latitude: loc.old[0], longitude: loc.old[1] };

        // Check difference with newDB
        const dist = getDistanceKm(current, newDB) * 1000; // meters

        if (dist < 50) return;  // ignore noise under 50m

        // Update Firestore
        await updateDoc(doc(DB, "drivers", driverProfile.id), {
          location: {
            old: [newDB.latitude, newDB.longitude],
            new: [current.latitude, current.longitude],
          }
        });

        // Update local UI (optional)
        setDriverProfile((prev) => ({
          ...prev,
          location: {
            old: [newDB.latitude, newDB.longitude],
            new: [current.latitude, current.longitude],
          }
        }));

      } catch (err) {
        console.log("Driver tracking error:", err);
      }
    }, 60000);

    return () => clearInterval(interval);

  }, [hasLocationPermission,driverProfile?.id,driverProfile?.lines])

  // 🕒 Initial screen load
  if (initializing) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <View style={styles.initializingAppOverlay}>
          <ActivityIndicator size="large" color="#000" />
          <Text style={styles.loadingOverlay_text}>جاري تحميل بياناتك...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // show animated add new lines
  if (driverProfile?.lines?.length === 0) {
    return (
      <SafeAreaView style={styles.emptyContainer}>
        <RNAnimated.View
          style={[
            styles.circle1,
            {
              transform: [
                {
                  scale: pingAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.8],
                  }),
                },
              ],
              opacity: pingAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.4, 0],
              }),
            },
          ]}
        />
        <RNAnimated.View
          style={[
            styles.circle2,
            {
              transform: [{ scale: pulseAnim2 }],
              opacity: pulseAnim2.interpolate({
                inputRange: [1, 1.2],
                outputRange: [0.6, 0.9],
              }),
            },
          ]}
        />

        <RNAnimated.View
          style={[
            styles.centerContent,
            { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
          ]}
        >
          <RNAnimated.View
            style={[styles.iconPulse, { transform: [{ translateY: bounceAnim }] }]}
          >
            <Ionicons name="add-circle" size={80} color="#007AFF" />
          </RNAnimated.View>

          <Text style={styles.title}>أهلًا وسهلًا بيك!</Text>
          <Text style={styles.subtitle}>ما عندك خطوط حالياً</Text>
          <Text style={styles.description}>
            ابدأ شغلك اليوم! ابحث عن خطوط وبلّش نقل الطلاب
          </Text>

          <TouchableOpacity
            style={styles.addButton}
            onPress={() => router.push("/(main)/(tabs)/addLine")}
          >
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.addButtonText}>إضافة خط</Text>
          </TouchableOpacity>

          <View style={{ alignItems: "center", marginTop: 40 }}>
            <Text style={styles.hintText}>
              أو اضغط على تبويب "إضافة خط" بالأسفل
            </Text>
            <RNAnimated.View style={{ transform: [{ translateY: bounceAnim }] }}>
              <Ionicons name="arrow-down" size={26} color="#007AFF" />
            </RNAnimated.View>
          </View>

        </RNAnimated.View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.map_container}>
        <MapView 
          ref={mapRef} 
          provider="google" 
          initialRegion={region} 
          showsUserLocation={true}
          showsMyLocationButton={true}
          style={styles.map}
        >

          {/* 🏠 Render all riders (students) home locations */}
          {driverProfile?.lines?.length > 0 &&
            selectedLine?.riders?.length > 0 &&
            selectedLine.riders.map((rider, index) => (
              rider?.home_location && (
                <Marker
                  key={rider.id || index}
                  coordinate={rider.home_location}
                  tracksViewChanges={!iconReady}
                >
                  <View style={styles.markerContainer}>
                    <Image
                      source={house}                    
                      style={{ width: 40, height: 40 }}
                      resizeMode="contain"
                      //onLoad={() => setIconReady(true)}
                      onLoad={() => handleIconLoad('house')}
                    />
                    <Text style={styles.markerText}>{rider.name || "طالب"}</Text>
                  </View>
                </Marker>
              )
            ))
          }

          {/* 🏫 Line school marker */}
          {driverProfile?.lines.length > 0 && selectedLine?.destination_location  && (
            <Marker 
              coordinate={selectedLine.destination_location} 
              tracksViewChanges={!iconReady}
            >
              <View style={styles.markerContainer}>
                <Image
                  source={school}                 
                  style={{width: 40,height: 40}}
                  resizeMode="contain"
                  //onLoad={() => setIconReady(true)}
                  onLoad={() => handleIconLoad('school')}
                />
                <Text style={styles.markerText}>{selectedLine.destination}</Text>
              </View>
            </Marker>
          )}
        </MapView>

        {/* Join requests notification bell */}
        <View style={[styles.requestsPillContainer, { top: 16 + insets.top }]}>
          <Animated.View style={[styles.requestsPillWrapper, pillAnimatedStyle]}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setRequestsVisible(true)}
              style={[
                styles.requestsPill,
                !(selectedLine && selectedLine.join_requests && selectedLine.join_requests.length > 0) && styles.requestsPill_disabled
              ]}
            >
              <Ionicons name="notifications-outline" size={18} color={ "#fff" } />
              <Text style={[styles.requestsPillLabel, !(selectedLine?.join_requests?.length) && styles.requestsPillLabelDisabled]}>
                {(selectedLine && selectedLine.join_requests?.length > 0) ? `${selectedLine.join_requests.length}` : "0" }
              </Text>
              <Text style={[styles.requestsPillLabel, !(selectedLine?.join_requests?.length) && styles.requestsPillLabelDisabled]}>
               طلبات انضمام
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* 🔔 JOIN REQUESTS MENU */}
        <Modal
          visible={requestsVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setRequestsVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.requestsPanel}>
              <View style={styles.requestsHeader}>
                <Text style={styles.requestsHeaderText}>طلبات الانضمام</Text>
                <TouchableOpacity style={styles.close_request_list} onPress={() => setRequestsVisible(false)}>
                  <Ionicons name="close" size={26} color="#000" />
                </TouchableOpacity>
              </View>

              {/* Requests List */}
              <ScrollView style={{ flex: 1 }}>
                {selectedLine?.join_requests?.map((req, idx) => (
                  <TouchableOpacity
                    key={req.id}
                    style={styles.requestItem}
                    onPress={() => {
                      setRequestsVisible(false);
                      router.push({
                        pathname: "/(main)/requestDetails",
                        params: { data: JSON.stringify(req), line: JSON.stringify(selectedLine) }
                      });
                    }}
                  >
                    <Ionicons name="person-circle-outline" size={30} color="#007AFF" />
                    <View style={{ marginLeft:10,marginRight:20, flex: 1}}>
                      <Text style={styles.requestName}>{req.name}</Text>
                      <Text style={styles.requestSubtitle}>يريد الانضمام إلى خط رقم { (driverProfile.lines.indexOf(selectedLine) + 1) }</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={22} color="#555" />
                  </TouchableOpacity>
                ))}

                {/* Empty state */}
                {(!selectedLine?.join_requests || selectedLine.join_requests.length === 0) && (
                  <View style={styles.emptyRequestsBox}>
                    <Ionicons name="notifications-off-outline" size={40} color="#999" />
                    <Text style={styles.emptyRequestsText}>لا توجد طلبات حالياً</Text>
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* center map button */}
        <View style={[styles.location_recentre_box,{ bottom: bottomMenuOffset + 65 }]}>
          <TouchableOpacity style={styles.location_recentre_box_button} onPress={handleRecenter}>
            <FontAwesome5 name="location-arrow" size={24} color="black" />
          </TouchableOpacity>              
        </View>

        {/* Lines selector */}
        {driverProfile?.lines?.length > 0 && (
          <View 
            style={[styles.bottom_menu,{ bottom: bottomMenuOffset }]}
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[
                styles.kidsScroll,
                driverProfile?.lines?.length <= 1 && { justifyContent: "center" },
              ]}
            >            
              {driverProfile?.lines.map((line, index) => (
                <TouchableOpacity
                  key={line.id}
                  onPress={() => setSelectedLine(line)}
                  style={[
                    styles.kids_button,
                    selectedLine?.id === line.id && styles.kids_button_active,
                  ]}                 
                >
                  <View style={styles.kids_tab_content}>
                    <FontAwesome5 name="child" size={18} color="#fff" />
                    <Text 
                      style={[
                        styles.kidName_text,
                        selectedLine?.id === line.id && styles.kidName_text_active,
                      ]}
                    >
                      خط {index + 1}                 
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

      </View>
    </SafeAreaView>
  )
}

export default Home;

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f9fafc",
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    fontFamily: "NotoArabicRegular",
    color: "#444",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    paddingTop:70,
    backgroundColor: "#f9fafc",
  },
  circle1: {
    position: "absolute",
    top: 60,
    right: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(0,122,255,0.08)",
  },
  circle2: {
    position: "absolute",
    bottom: 60,
    left: -80,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: "rgba(0,122,255,0.1)",
  },
  centerContent: { 
    alignItems: "center",
    width: "85%" 
  },
  iconPulse: {
    backgroundColor: "rgba(0,122,255,0.1)",
    borderRadius: 80,
    padding: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontFamily: "NotoArabicBold",
    color: "#000",
    marginTop: 20,
  },
  subtitle: {
    fontSize: 18,
    fontFamily: "NotoArabicRegular",
    color: "#555",
    marginTop: 5,
  },
  description: {
    textAlign: "center",
    color: "#666",
    marginTop: 10,
    paddingHorizontal:10,
    fontSize: 15,
    fontFamily: "NotoArabicRegular",
    lineHeight: 22,
  },
  addButton: {
    flexDirection: "row",
    backgroundColor: "#007AFF",
    borderRadius: 12,
    paddingVertical: 7,
    paddingHorizontal: 20,
    marginTop: 25,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#007AFF",
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  addButtonText: {
    fontSize: 16,
    color: "#fff",
    fontFamily: "NotoArabicBold",
  },
  hintText: {
    fontSize: 14,
    color: "#777",
    fontFamily: "NotoArabicRegular",
  },
  container: { 
    flex: 1, 
    backgroundColor: "#fff" ,
  },
  map_container: {
    flex: 1,
    position: 'relative',
  },
  map: { 
    width: width, 
    height: height 
  },
  initializingAppOverlay:{
    position: "absolute",
    top: "45%",
    left: 0,
    right: 0,
    alignItems: "center",
    padding: 16,
    borderRadius: 10,
    marginHorizontal: 40,
  },
  loadingOverlay: {
    position: "absolute",
    top: "40%",
    left: 0,
    right: 0,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.8)",
    padding: 16,
    borderRadius: 10,
    marginHorizontal: 40,
  },
  loadingOverlay_text:{
    fontFamily: "NotoArabicRegular",
    fontSize: 14,
    color: "#000",
  },
  dynamicIsland: {
    position: "absolute",
    alignSelf: "center",
    backgroundColor: "#007AFF",
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    maxWidth: "90%",
    zIndex:9999,
  },
  dynamicIsland_text_box: {
    minWidth:200,
    height:25,
    alignItems: "center",
    justifyContent: "center",
  },
  dynamicIslandText: { 
    fontFamily: "NotoArabicRegular",
    color: "#fff", 
    fontSize: 14,
    textAlign: "center",
    lineHeight:25
  },
  dynamicIslandButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 8,
  },
  dynamicIslandTextPressable: {
    fontFamily: "NotoArabicBold",
    fontSize: 14,
    color: "#fff",
    textAlign: "center",
  },
  requestsPillContainer: {
    position: "absolute",
    right: 12,
    zIndex: 40,
    elevation: 40,
  },
  requestsPillWrapper: {
    alignSelf: "flex-end",
  },
  requestsPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
    gap:7,
    backgroundColor: "#FF3B30",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 15,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  requestsPill_disabled: {
    backgroundColor: "#999",
  },
  requestsPillLabel: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "NotoArabicRegular",
  },
  requestsPillLabelDisabled: {
    color:'#fff'
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  requestsPanel: {
    height: "55%",
    backgroundColor: "#fff",
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 10,
  },
  requestsHeader: {
    flexDirection: "row-reverse",
    justifyContent: "center",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    paddingBottom: 10,
  },
  requestsHeaderText: {
    fontSize: 20,
    fontFamily: "NotoArabicBold",
    color: "#000",
  },
  close_request_list:{
    position:'absolute',
    left:0,
    top:0,
  },
  requestItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  requestName: {
    fontSize: 16,
    fontFamily: "NotoArabicBold",
    color: "#000",
  },
  requestSubtitle: {
    fontSize: 12,
    fontFamily: "NotoArabicRegular",
    color: "#666",
  },
  emptyRequestsBox: {
    alignItems: "center",
    marginTop: 30,
  },
  emptyRequestsText: {
    marginTop: 10,
    fontFamily: "NotoArabicRegular",
    fontSize: 15,
    color: "#777",
  },
  markerContainer: {
    alignItems: 'center',
  },
  markerText: {
    marginTop: 2,
    paddingHorizontal: 4,
    fontSize: 11,
    fontFamily: "NotoArabicBold",
    backgroundColor: "#ffffffcc",
    color:'#000',
    borderRadius: 6,
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '40%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 17,
    borderTopRightRadius: 17,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 10,
    zIndex: 2000,
  },
  sheetHandle: {
    width: 50,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#ccc',
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 10,
  },
  sheetContent: {
    paddingVertical:0,
    paddingHorizontal:20,
    alignItems: 'center',
    gap:10,
  },
  loadingLineDetailsPage:{
    width:'100%',
    height:100,
    justifyContent:'center',
    alignItems:'center',
    gap:5,
  },
  driver_info_box:{
    width:'100%',
    justifyContent:'center',
    alignItems:'center',
    gap:5,
  },
  driver_name_box:{
    flexDirection:'row-reverse',
    justifyContent:'center',
    alignItems:'center',
  },
  driver_name_title:{
    fontFamily:'NotoArabicBold',
    fontSize:14,
    color:"#000",
    lineHeight:25,
  },
  driver_name_sub_title:{
    fontFamily:'NotoArabicRegular',
    fontSize:12,
    color:"#000",
    lineHeight:25,
  },
  join_line_button:{
    width:150,
    height:42,
    marginBottom:15,
    marginTop:5,
    justifyContent:'center',
    alignItems:'center',
    backgroundColor:'#007AFF',
    borderRadius:15
  },
  join_line_button_text:{
    fontFamily:'NotoArabicBold',
    fontSize:13,
    color:"#fff",
    lineHeight:40,
  },
  already_requested_text_box:{
    width:220,
    height:42,
    marginBottom:15,
    marginTop:5,
    justifyContent:'center',
    alignItems:'center',
    backgroundColor:'#777',
    borderRadius:15
  },
  already_requested_text:{
    fontFamily:'NotoArabicBold',
    fontSize:13,
    color:"#fff",
    lineHeight:42,
    textAlign:'center'
  },
  driver_info_image_box:{
    width:'100%',
    height:110,
    flexDirection:'row',
    justifyContent:'center',
    alignItems:'center',
    gap:10,
  },
  line_timetable_box: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#ddd",
  },
  line_timetable_title: {
    fontFamily: "NotoArabicBold",
    fontSize: 15,
    color: "#000",
    marginBottom: 10,
    textAlign:'center'
  },
  timetable_scroll: {
    height:170,
    flexDirection: "row",
    gap: 15,
    paddingHorizontal: 10,
  },
  timetable_day_column: {
    height:100,
    minWidth: 65,
    alignItems: "center",
    justifyContent: "space-around",
    borderRightWidth: 1,
    borderRightColor: "#ddd",
  },
  timetable_day_text: {
    fontFamily: "NotoArabicBold",
    fontSize: 13,
    marginBottom: 4,
    color: "#333",
  },
  timetable_timing_box:{
    alignItems: "center",
    justifyContent:'center',
    gap:5,
    paddingBottom:10,
  },
  timetable_time_text: {
    fontFamily: "NotoArabicRegular",
    fontSize: 12,
    color: "#555",
  },
  timetable_inactive_text: {
    fontFamily: "NotoArabicRegular",
    fontSize: 12,
    color: "#bbb",
  },
  close_button_box:{
    position:'absolute',
    top:0,
    right:10,
  },
  closeButton: {
    width:30,
    height:30,
    backgroundColor: '#ddd',
    borderRadius: 30,
    justifyContent:'center',
    alignItems:'center',
  },
  location_recentre_box:{
    position:'absolute',
    left: 0,
    right: 0,
    flexDirection:'row-reverse',
    justifyContent:'center',
    alignItems:'center',
    gap:15,
  },
  location_recentre_box_button:{
    height:40,
    width:40,
    justifyContent:'center',
    alignItems:'center',
    backgroundColor:'#fff',
    borderRadius:50,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1000,
  },
  bottom_menu: {
    height:55,
    backgroundColor: "#fff",
    position: "absolute",
    left: 7,
    right: 7,
    paddingHorizontal: 10,
    borderRadius: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    zIndex: 1000,
    justifyContent: "center",
    alignItems:'center'
  },
  dynamicIsland: {
    position: "absolute",
    alignSelf: "center",
    backgroundColor: "#007AFF",
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    maxWidth: "90%",
    zIndex:9999,
  },
  kidsScroll: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 10,
  },
  kids_button: {
    minWidth:100,
    backgroundColor: '#E0E0E0',
    paddingVertical: 5,
    paddingHorizontal: 5,
    borderRadius: 15,
  },
  kids_button_active: {
    backgroundColor:'#000',
  },
  kids_tab_content: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent:'center',
    gap: 10,
  },
  kidName_text: {
    fontFamily: "NotoArabicRegular",
    fontSize: 14,
    color: "#000",
  },
  kidName_text_active: {
    fontFamily: "NotoArabicBold",
    color: "#fff",
  },
});