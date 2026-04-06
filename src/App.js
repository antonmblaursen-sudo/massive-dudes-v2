import React, { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, onSnapshot, doc, setDoc, updateDoc, increment, arrayUnion, arrayRemove, addDoc, serverTimestamp, query, orderBy, limit, deleteDoc } from "firebase/firestore";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

// --- 👑 ADMIN INDSTILLING ---
const ADMIN_EMAIL = "antonmblaursen@gmail.com"; 

const firebaseConfig = {
  apiKey: "AIzaSyAi-l2FOylk76ZKU-1CyVtt2HdIavf4w5g",
  authDomain: "massive-brutale-dudes.firebaseapp.com",
  projectId: "massive-brutale-dudes",
  storageBucket: "massive-brutale-dudes.firebasestorage.app",
  messagingSenderId: "45686943799",
  appId: "1:45686943799:web:95628cd0039d908ec40fb2"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

export default function App() {
  const [activeTab, setActiveTab] = useState("leaderboard");
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [feed, setFeed] = useState([]); 
  const [newMessage, setNewMessage] = useState("");
  const [weather, setWeather] = useState(null);
  const [expandedUserId, setExpandedUserId] = useState(null);
  const [showLogModal, setShowLogModal] = useState(false);
  
  const [postText, setPostText] = useState("");
  const [postFile, setPostFile] = useState(null);
  const [isPosting, setIsPosting] = useState(false);

  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState(""); 
  const [isRegistering, setIsRegistering] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [myBio, setMyBio] = useState("");
  const [myPhoto, setMyPhoto] = useState("");
  const [myArc, setMyArc] = useState("Vinter Arc ❄️");
  const [isUploading, setIsUploading] = useState(false);

  const isAdmin = currentUser && currentUser.email === ADMIN_EMAIL;

  const theme = {
    bg: "#121212", card: "#1E1E1E", accent: "#F59E0B", textMain: "#F3F4F6", textSub: "#9CA3AF", inputBg: "#374151", border: "#333333"
  };

  const mainStyle = { minHeight: "100vh", backgroundColor: theme.bg, color: theme.textMain, fontFamily: "sans-serif", paddingBottom: "30px" };

  useEffect(() => {
    fetch("https://api.open-meteo.com/v1/forecast?latitude=55.6761&longitude=12.5683&current_weather=true")
      .then(res => res.json()).then(data => setWeather(data.current_weather));
  }, []);

  useEffect(() => {
    onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    onSnapshot(collection(db, "users"), (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
  }, []);

  useEffect(() => {
    const q = query(collection(db, "messages"), orderBy("createdAt", "desc"), limit(50));
    onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).reverse());
    });
  }, []);

  useEffect(() => {
    const q = query(collection(db, "feed"), orderBy("createdAt", "desc"), limit(30));
    onSnapshot(q, (snapshot) => {
      setFeed(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
  }, []);

  useEffect(() => {
    document.body.style.backgroundColor = theme.bg;
    document.body.style.margin = "0";
  }, []);

  const getTodayDate = () => new Date().toISOString().split('T')[0];
  const currentMonthStr = getTodayDate().substring(0, 7);
  const getPrevMonthStr = () => {
    const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().substring(0, 7);
  };
  const prevMonthStr = getPrevMonthStr();
  const monthNames = ["Januar", "Februar", "Marts", "April", "Maj", "Juni", "Juli", "August", "September", "Oktober", "November", "December"];
  const currentMonthName = monthNames[new Date().getMonth()];

  const getStatsForMonth = (history = [], monthPrefix) => {
    let gym = 0, cardioKm = 0, cardioRuns = 0;
    history.forEach(h => {
      const d = typeof h === 'string' ? h : h.date;
      if (d.startsWith(monthPrefix)) {
        if (typeof h === 'string' || h.type === 'gym') gym++;
        else if (h.type === 'cardio') { cardioRuns++; if (h.value) cardioKm += Number(h.value); }
      }
    });
    return { gym, cardioKm: parseFloat(cardioKm.toFixed(1)), totalActivities: gym + cardioRuns };
  };

  const getLastMonthWinner = () => {
    if (!users.length) return null;
    let winner = null, maxScore = 0;
    users.forEach(u => {
      const score = getStatsForMonth(u.history, prevMonthStr).totalActivities;
      if (score > maxScore && score > 0) { maxScore = score; winner = u.id; }
    });
    return winner; 
  };
  const lastMonthWinnerId = getLastMonthWinner();

  const getMVP = () => {
    if (!users.length) return null;
    const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    let mvp = null, maxCount = -1;
    users.forEach(user => {
      const recentActivities = (user.history || []).filter(h => {
        const activityDate = new Date(typeof h === 'string' ? h : h.date);
        return activityDate >= sevenDaysAgo;
      }).length;
      if (recentActivities > maxCount && recentActivities > 0) { maxCount = recentActivities; mvp = { ...user, weeklyCount: recentActivities }; }
    });
    return mvp;
  };

  const calculateStreak = (history = []) => {
    if (!history.length) return 0;
    const datesOnly = history.map(h => typeof h === 'string' ? h : h.date);
    const sortedDates = [...new Set(datesOnly)].sort((a, b) => new Date(b) - new Date(a));
    let streak = 0; let checkDate = new Date();
    if (sortedDates[0] !== getTodayDate()) checkDate.setDate(checkDate.getDate() - 1);
    for (let i = 0; i < sortedDates.length; i++) {
      const dString = checkDate.toISOString().split('T')[0];
      if (sortedDates.includes(dString)) { streak++; checkDate.setDate(checkDate.getDate() - 1); } else break;
    }
    return streak;
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    try {
      if (isRegistering) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, "users", userCredential.user.uid), {
          name: name, workouts: 0, lastWorkoutDate: null, history: [], bio: "Klar til at dominere.", photoUrl: "", arc: "Vinter Arc ❄️", maxLifts: { bench: 0, squat: 0, deadlift: 0 }
        });
      } else { await signInWithEmailAndPassword(auth, email, password); }
    } catch (error) { setErrorMsg("Fejl: " + error.message); }
  };

  const logActivity = async (type) => {
    const today = getTodayDate();
    let title = "", distance = "";
    if (type === "gym") {
      title = prompt("Hvad har du trænet?");
      if (title === null) return;
    } else {
      distance = prompt("Hvor mange km?");
      if (distance === null) return;
      title = prompt("Beskrivelse (f.eks. Løbetur)");
    }
    const activityObj = { date: today, type: type, title: title || (type === "gym" ? "Styrke" : "Cardio"), value: distance ? Number(distance.replace(',', '.')) : null };
    const updateData = { lastWorkoutDate: today, history: arrayUnion(activityObj) };
    if (type === "gym") updateData.workouts = increment(1);
    await updateDoc(doc(db, "users", currentUser.uid), updateData);
    setShowLogModal(false);
  };

  const undoWorkout = async (user) => {
    if (window.confirm(`Slet seneste log for ${user.name}?`)) {
      const lastEntry = user.history[user.history.length - 1];
      const isGym = lastEntry.type === "gym" || typeof lastEntry === 'string';
      await updateDoc(doc(db, "users", user.id), { workouts: isGym ? increment(-1) : increment(0), history: arrayRemove(lastEntry) });
    }
  };

  const updateMax = async (id, field, currentVal, name) => {
    const newVal = prompt(`Nyt maks i ${field} for ${name}:`, currentVal);
    if (newVal !== null && !isNaN(newVal)) await updateDoc(doc(db, "users", id), { [`maxLifts.${field}`]: Number(newVal) });
  };

  const submitPost = async (e) => {
    e.preventDefault();
    if (!postFile) return alert("Du skal vælge et billede for at flekse! 📸");
    setIsPosting(true);
    try {
      const imgRef = ref(storage, `feed/${currentUser.uid}_${Date.now()}`);
      await uploadBytes(imgRef, postFile);
      const url = await getDownloadURL(imgRef);
      const userData = users.find(u => u.id === currentUser.uid);
      await addDoc(collection(db, "feed"), {
        userId: currentUser.uid,
        userName: userData.name,
        userPhoto: userData.photoUrl || "",
        text: postText,
        imageUrl: url,
        likes: [],
        createdAt: serverTimestamp()
      });
      setPostText("");
      setPostFile(null);
    } catch (err) { alert("Fejl ved upload: " + err.message); }
    setIsPosting(false);
  };

  const toggleLike = async (postId, currentLikes) => {
    const postRef = doc(db, "feed", postId);
    if (currentLikes.includes(currentUser.uid)) {
      await updateDoc(postRef, { likes: arrayRemove(currentUser.uid) });
    } else {
      await updateDoc(postRef, { likes: arrayUnion(currentUser.uid) });
    }
  };

  const deletePost = async (postId) => {
    if (window.confirm("Slet dette flex?")) {
      await deleteDoc(doc(db, "feed", postId));
    }
  };

  const sendChatMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    const userData = users.find(u => u.id === currentUser.uid);
    await addDoc(collection(db, "messages"), { text: newMessage, userName: userData?.name, userId: currentUser.uid, createdAt: serverTimestamp() });
    setNewMessage("");
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploading(true);
    const imageRef = ref(storage, `profile_pictures/${currentUser.uid}`);
    try {
      await uploadBytes(imageRef, file);
      const url = await getDownloadURL(imageRef);
      setMyPhoto(url);
      await updateDoc(doc(db, "users", currentUser.uid), { photoUrl: url });
    } catch (error) { alert(error.message); }
    setIsUploading(false);
  };

  if (loading) return <div style={{...mainStyle, textAlign:"center", paddingTop:"100px", color:theme.accent}}><h2>Indlæser...</h2></div>;

  if (!currentUser) {
    return (
      <div style={mainStyle}>
        <div style={{ padding: "40px 20px", maxWidth: "400px", margin: "0 auto", textAlign: "center" }}>
          <div style={{ background: theme.card, borderRadius: "16px", padding: "30px", marginTop: "50px" }}>
            <h1 style={{ color: theme.accent, marginTop: 0 }}>MASSIVE DUDES</h1>
            {errorMsg && <p style={{ color: "#ef4444" }}>{errorMsg}</p>}
            <form onSubmit={handleAuth} style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "20px" }}>
              {isRegistering && <input type="text" placeholder="Navn" value={name} onChange={(e) => setName(e.target.value)} style={{ padding: "12px", background: theme.inputBg, color: "white", border: "none", borderRadius: "8px" }} />}
              <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ padding: "12px", background: theme.inputBg, color: "white", border: "none", borderRadius: "8px" }} />
              <input type="password" placeholder="Kodeord" value={password} onChange={(e) => setPassword(e.target.value)} style={{ padding: "12px", background: theme.inputBg, color: "white", border: "none", borderRadius: "8px" }} />
              <button type="submit" style={{ padding: "12px", background: theme.accent, color: "#000", borderRadius: "8px", border: "none", fontWeight: "bold", cursor: "pointer" }}>{isRegistering ? "Opret" : "Log Ind"}</button>
            </form>
            <p onClick={() => setIsRegistering(!isRegistering)} style={{ color: theme.textSub, cursor: "pointer", marginTop: "15px" }}>{isRegistering ? "Log ind" : "Opret profil"}</p>
          </div>
        </div>
      </div>
    );
  }

  const currentUserData = users.find(u => u.id === currentUser.uid) || {};
  const mvp = getMVP();

  return (
    <div style={mainStyle}>
      <div style={{ padding: "15px", maxWidth: "500px", margin: "0 auto" }}>
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", paddingTop: "10px" }}>
          <h2 style={{ color: theme.accent, margin: 0 }}>MASSIVE DUDES {isAdmin && "👑"}</h2>
          {weather && <div style={{fontSize:"11px", color:theme.textSub}}>{weather.temperature}°C | Go' træning!</div>}
        </div>

        {activeTab === "leaderboard" && mvp && (
          <div style={{ background: "linear-gradient(45deg, #F59E0B, #B45309)", padding: "15px", borderRadius: "12px", marginBottom: "20px", textAlign: "center", boxShadow: "0 4px 15px rgba(245, 158, 11, 0.3)" }}>
            <div style={{ fontSize: "12px", fontWeight: "bold", color: "rgba(0,0,0,0.6)", textTransform: "uppercase" }}>MVP OF THE WEEK ⚡</div>
            <div style={{ fontSize: "22px", fontWeight: "900", color: "#000" }}>{mvp.name.toUpperCase()}</div>
            <div style={{ fontSize: "13px", color: "rgba(0,0,0,0.7)", fontWeight: "bold" }}>{mvp.weeklyCount} AKTIVITETER DE SIDSTE 7 DAGE</div>
          </div>
        )}
        
        <div style={{ display: "flex", gap: "4px", marginBottom: "20px", background: theme.card, padding: "5px", borderRadius: "10px" }}>
          {["leaderboard", "feed", "stats", "chat", "profile"].map(t => (
            <button key={t} onClick={() => { 
                setActiveTab(t);
                if (t === "profile") { setMyBio(currentUserData.bio || ""); setMyArc(currentUserData.arc || "Vinter Arc ❄️"); }
              }} style={{ flex: 1, padding: "10px 0", borderRadius: "8px", border: "none", backgroundColor: activeTab === t ? theme.accent : "transparent", color: activeTab === t ? "#000" : theme.textSub, fontWeight: "bold", fontSize: "11px", cursor: "pointer" }}>
              {t === "leaderboard" ? "Sæson" : t === "feed" ? "Flex" : t === "stats" ? "Stats" : t === "chat" ? "Chat" : "Profil"}
            </button>
          ))}
        </div>

        {activeTab === "leaderboard" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
              <h3 style={{ margin: 0, fontSize: "16px", textTransform: "uppercase", color: theme.textSub }}>SÆSON: {currentMonthName}</h3>
            </div>
            {users.map(u => ({ ...u, currentMonthStats: getStatsForMonth(u.history, currentMonthStr) })).sort((a, b) => b.currentMonthStats.totalActivities - a.currentMonthStats.totalActivities).map((user, index) => {
              const isMe = currentUser.uid === user.id;
              const streak = calculateStreak(user.history);
              return (
                <div key={user.id} style={{ background: theme.card, marginBottom: "10px", borderRadius: "12px", border: isMe ? `1px solid ${theme.accent}` : "1px solid #333", overflow: "hidden" }}>
                  <div onClick={() => setExpandedUserId(expandedUserId === user.id ? null : user.id)} style={{ padding: "15px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div style={{ fontWeight: "bold", fontSize: "18px", color: index ===
