import { useEffect, useState, useRef } from "react";
import { View,StyleSheet,Text,TouchableOpacity,ActivityIndicator,Image } from "react-native";
import MapView, { Marker } from "react-native-maps";
import MapViewDirections from "react-native-maps-directions";
import { useLocalSearchParams } from "expo-router";
import { doc, getDoc,updateDoc } from "firebase/firestore";
import { DB } from "../../../firebaseConfig";
import * as Location from "expo-location";
import { Linking } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import school from '../../../assets/images/school.png';
import male from '../../../assets/images/man.png';
import female from '../../../assets/images/woman.png';

const GOOGLE_MAPS_APIKEY = "AIzaSyDFykWBtWSbKHvxgyTxntrGadHSk2dzjts";

export default function LineDetails() {
    const { lineID } = useLocalSearchParams();
    const mapRef = useRef(null);
    const lastSavedLocation = useRef(null);
    const lastUpdateTime = useRef(0);

    const [line, setLine] = useState(null);
    const [students, setStudents] = useState([]);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [driverLocation, setDriverLocation] = useState(null);
    const [loading, setLoading] = useState(true);

    //Fetch line + students
    useEffect(() => {
        const fetchData = async () => {
            try {
                // ✅ 1. Get line
                const lineRef = doc(DB, "lines", lineID);
                const lineSnap = await getDoc(lineRef);

                if (!lineSnap.exists()) return;

                const lineData = lineSnap.data();
                setLine(lineData);

                const riderIds = lineData.riders || [];

                if (riderIds.length === 0) {
                    setStudents([]);
                    return;
                }

                // ✅ 2. Fetch students
                const studentsData = [];

                for (const id of riderIds) {
                    const studentRef = doc(DB, "students", id);
                    const studentSnap = await getDoc(studentRef);

                    if (studentSnap.exists()) {
                        studentsData.push({
                            id,
                            ...studentSnap.data(),
                        });
                    }
                }

                setStudents(studentsData);

            } catch (error) {
                console.log("Line details error:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [lineID]);

    //Get driver real location
    useEffect(() => {
        let subscription;

        const getLocation = async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();

            if (status !== "granted") {
                console.log("Location permission denied");
                return;
            }

            //Get initial position
            const location = await Location.getCurrentPositionAsync({});
            setDriverLocation({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
            });

            // Watch position (REAL-TIME)
            subscription = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.High,
                    distanceInterval: 30,
                },
                (loc) => {
                    const newLoc = {
                        latitude: loc.coords.latitude,
                        longitude: loc.coords.longitude,
                    };
                    
                    //Save location locally
                    setDriverLocation(newLoc);

                    // 🔥 SAVE TO DB
                    saveDriverLocation(newLoc);
                }
            );
        };

        getLocation();

        return () => {
            if (subscription) {
                subscription.remove();
            }
        };
    }, []);

    const getDistance = (loc1, loc2) => {
        const toRad = (value) => (value * Math.PI) / 180;

        const R = 6371e3; // meters
        const φ1 = toRad(loc1.latitude);
        const φ2 = toRad(loc2.latitude);
        const Δφ = toRad(loc2.latitude - loc1.latitude);
        const Δλ = toRad(loc2.longitude - loc1.longitude);

        const a =
            Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) *
                Math.cos(φ2) *
                Math.sin(Δλ / 2) *
                Math.sin(Δλ / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    };

    //Save driver location update
    const saveDriverLocation = async (newLocation) => {
        try {
            if (!line?.driver_id) return;

            const now = Date.now();

            const MIN_DISTANCE = 100; // meters
            const MIN_TIME = 60000; // 60 sec

            const lastLoc = lastSavedLocation.current;

            let shouldUpdate = false;

            if (!lastLoc) {
                shouldUpdate = true;
            } else {
                const distance = getDistance(lastLoc, newLocation);
                const timeDiff = now - lastUpdateTime.current;

                if (distance > MIN_DISTANCE || timeDiff > MIN_TIME) {
                    shouldUpdate = true;
                }
            }

            if (!shouldUpdate) return;

            // 🔥 update Firestore
            const driverRef = doc(DB, "drivers", line.driver_id);

            await updateDoc(driverRef, {
                location: newLocation,
            });

            // ✅ update refs
            lastSavedLocation.current = newLocation;
            lastUpdateTime.current = now;

        } catch (error) {
            console.log("Location save error:", error);
        }
    };

    //Center map
    const fitMap = (driverLocation = null) => {
        if (!mapRef.current) return;

        const coords = [];

        // ✅ school
        if (destination) {
            coords.push({
                latitude: destination.latitude,
                longitude: destination.longitude,
            });
        }

        // ✅ students
        students.forEach((s) => {
            if (s.home_location) {
                coords.push({
                    latitude: s.home_location.latitude,
                    longitude: s.home_location.longitude,
                });
            }
        });

        // ✅ driver
        if (driverLocation) {
            coords.push({
                latitude: driverLocation.latitude,
                longitude: driverLocation.longitude,
            });
        }

        if (coords.length === 0) return;

        mapRef.current.fitToCoordinates(coords, {
            edgePadding: {
                top: 100,
                right: 50,
                bottom: 200,
                left: 50,
            },
            animated: true,
        });
    };

    useEffect(() => {
        if (!loading && line && driverLocation) {
            setTimeout(() => {
                fitMap();
            }, 500);
        }
    }, [loading, students, driverLocation]);

    //make a call
    const handleCall = (phone) => {
        if (!phone) return;
        Linking.openURL(`tel:${phone}`);
    };

    if (loading || !line) {
        return (
            <View style={styles.loader}>
                <ActivityIndicator size="small" color='#000' />
            </View>
        );
    }

    const destination = line.destination_location;
    const schoolName = line.destination;

    return (
        <View style={styles.container}>
            <MapView
                ref={mapRef}
                provider="google" 
                initialRegion={{
                    latitude: destination.latitude,
                    longitude: destination.longitude,
                    latitudeDelta: 0.05,
                    longitudeDelta: 0.05,
                }}
                showsUserLocation={true}
                showsMyLocationButton={true}
                style={StyleSheet.absoluteFillObject}
            >
                <Marker
                    coordinate={destination}
                    tracksViewChanges={false}
                >
                    <View style={styles.markerContainer}>
                        <Image
                            source={school}                 
                            style={{width: 35,height: 35}}
                            resizeMode="contain"
                        />
                        <View style={styles.labelContainer}>
                            <Text style={styles.labelText} numberOfLines={1}>
                                {schoolName}
                            </Text>
                        </View>
                    </View>
                </Marker>

                {students.map((student) => {
                    if (!student.home_location) return null;
                    const isFemale = student.sex === "female";
                    const icon = isFemale ? female : male;

                    return (
                        <Marker
                            key={student.id}
                            coordinate={student.home_location}
                            tracksViewChanges={false}
                            onPress={() => {
                                setSelectedStudent(student);
                            }}
                        >
                            <View style={styles.markerContainer}>
                                <Image
                                    source={icon}
                                    style={styles.markerImage}
                                    resizeMode="contain"
                                />
                                <View style={styles.labelContainer}>
                                    <Text style={styles.labelText} numberOfLines={1}>
                                        {student.name}
                                    </Text>
                                </View>
                            </View>
                        </Marker>
                    );
                })}

            </MapView>

            <View style={styles.mapControls}>
                <TouchableOpacity
                    style={styles.controlBtn}
                    onPress={() => router.replace("/(main)/(tabs)/home")}
                >
                    <Ionicons name="arrow-back" size={22} color="#fff" />
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.controlBtn}
                    onPress={() => fitMap()}
                >
                    <Ionicons name="locate" size={22} color="#fff" />
                </TouchableOpacity>
            </View>

            {selectedStudent && (
                <View style={styles.popupContainer}>

                    <View style={styles.popupHeader}>
                        <Text style={styles.popupTitle}>معلومات الطالب</Text>
                        <TouchableOpacity onPress={() => setSelectedStudent(null)}>
                            <Ionicons name="close-circle-outline" size={24} color="black" />
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.studentName}>
                        {selectedStudent.name} {selectedStudent.parent_name}
                    </Text>

                    <View style={styles.row}>
                        <Text style={styles.label}>رقم الهاتف:</Text>
                        <Text style={styles.value}>
                            {selectedStudent.phone_number || "غير متوفر"}
                        </Text>
                    </View>

                    <TouchableOpacity
                        style={styles.callButton}
                        onPress={() => handleCall(selectedStudent.phone_number)}
                    >
                        <Text style={styles.callText}>اتصال</Text>
                        <Ionicons name="call-outline" size={22} color="#fff" />
                    </TouchableOpacity>
                </View>
            )}

        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    loader: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    markerContainer: {
        alignItems: 'center',
    },
    markerImage: {
        width: 35,
        height: 35,
    },
    labelContainer: {
        marginTop: 2,
        backgroundColor: "#f59e0b",
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 6,
        elevation: 2,
    },
    labelText: {
        fontSize: 10,
        fontFamily: "NotoArabicBold",
        color: "#fff",
        textAlign: "center",
        maxWidth: 70,
    },
    mapControls: {
        position: "absolute",
        bottom: 120,
        left: 0,
        right: 0,
        flexDirection: "row",
        justifyContent: "center",
        gap: 20,
    },
    controlBtn: {
        width: 45,
        height: 45,
        borderRadius: 25,
        backgroundColor: "#2563eb",
        justifyContent: "center",
        alignItems: "center",
        elevation: 5,
    },
    popupContainer: {
        position: "absolute",
        bottom: 45,
        left: 0,
        right: 0,
        backgroundColor: "#fff",
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 16,
        elevation: 10,
    },
    popupHeader: {
        flexDirection: "row-reverse",
        alignItems: "center",
        marginBottom: 10,
    },
    popupTitle: {
        flex:1,
        textAlign:'center',
        fontFamily: "NotoArabicBold",
        fontSize: 14,
        color: "#111",
    },
    closeBtn: {
        fontSize: 18,
        color: "#777",
    },
    studentName: {
        fontFamily: "NotoArabicBold",
        fontSize: 14,
        color:'#000',
        marginBottom: 10,
        textAlign: "right",
    },
    row: {
        flexDirection: "row-reverse",
        marginBottom: 6,
    },
    label: {
        fontFamily: "NotoArabicBold",
        fontSize: 14,
        color: "#000",
        marginLeft: 5,
    },
    value: {
        fontFamily: "NotoArabicRegular",
        fontSize: 14,
        color: "#000",
    },
    callButton: {
        flexDirection:'row-reverse',
        justifyContent:'center',
        alignItems:'center',
        gap:20,
        backgroundColor: "#10b981",
        borderRadius: 10,
        paddingVertical: 10,
        alignItems: "center",
        marginVertical: 10,
    },
    callText: {
        color: "#fff",
        fontFamily: "NotoArabicBold",
    },
});