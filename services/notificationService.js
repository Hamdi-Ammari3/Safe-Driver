import axios from "axios";

const API_BASE = "https://us-central1-sayartech-871ac.cloudfunctions.net/api";

/* -------------------------------------------
   Notify parent: request accepted
-------------------------------------------- */
export async function notifyRequestAccepted(parentPhone, lineId) {
  try {
    const res = await axios.post(`${API_BASE}/notify/request-accepted`, {
      parentPhone,
      lineId,
    });
    return res.data;
  } catch (err) {
    console.log("notifyRequestAccepted error:", err.response?.data || err.message);
    return { success: false };
  }
}

/* -------------------------------------------
   Notify riders: line booked
-------------------------------------------- */
export async function notifyLineBooked(ridersPhonesArray, lineId, destination) {
  try {
    const res = await axios.post(`${API_BASE}/notify/line-booked`, {
      riders: ridersPhonesArray,
      lineId,
      destination,
    });
    return res.data;
  } catch (err) {
    console.log("notifyLineBooked error:", err.response?.data || err.message);
    return { success: false };
  }
}

/* -------------------------------------------
   4Manually trigger daily engagement
-------------------------------------------- */
export async function notifyDailyEngagement() {
  try {
    const res = await axios.post(`${API_BASE}/notify/daily-engagement`);
    return res.data;
  } catch (err) {
    console.log("notifyDailyEngagement error:", err.response?.data || err.message);
    return { success: false };
  }
}
