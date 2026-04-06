import React, { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, onSnapshot, doc, setDoc, updateDoc, increment, arrayUnion, arrayRemove, addDoc, serverTimestamp, query, orderBy, limit } from "firebase/firestore";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

// 1. Din Firebase Konfiguration
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
  const [newMessage, setNewMessage] = useState("");
  const [weather, setWeather] = useState(null);
  const [expandedUserId, setExpandedUserId] = useState(null);
  
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState(""); 
  const [isRegistering, setIsRegistering] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [myBio, setMyBio] = useState("");
  const [myPhoto, setMyPhoto] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const theme = {
    bg: "#0A0A0A", card: "#161616", accent: "#E50914", neon: "#FF3333", textMain: "#FFFFFF", textSub: "#888888", inputBg: "#222222"
  };

  // HENT VEJRET (Live fra Open-Meteo)
  useEffect(() => {
    fetch("https://api.open-meteo.com/v1/forecast?latitude=55.6761&longitude=12.5683&current_weather=true")
      .then(res => res.json())
      .then(data => setWeather(data.current_weather));
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // HENT BRUGERE
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  // HENT CHAT BESKEDER
  useEffect(() => {
    const q = query(collection(db, "messages"), orderBy("createdAt", "desc"), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).reverse());
    });
    return () => unsubscribe();
  }, []);

  const getTodayDate = () => new Date().toISOString().split('T')[0];

  // LOGIK TIL STREAKS
  const calculateStreak = (history = []) => {
    if (!history.length) return 0;
    const sortedDates = [...new Set(history)].sort((a, b) => new Date(b) - new Date(a));
    let streak = 0;
    let checkDate = new Date();
    
    // Hvis man ikke har trænet i dag, tjekker vi fra i går
    if (sortedDates[0] !== getTodayDate()) {
      checkDate.setDate(checkDate.getDate() - 1);
    }

    for (let i = 0; i < sortedDates.length; i++) {
      const dString = checkDate.toISOString().split('T')[0];
      if (sortedDates.includes(dString)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    try {
      if (isRegistering) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, "users", userCredential.user.uid), {
          name: name, workouts: 0, lastWorkoutDate: null, history: [], bio: "KLAR TIL KRIG. 🩸", photoUrl: "", maxLifts: { bench: 0, squat: 0, deadlift: 0 }
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error) { setErrorMsg("FEJL: " + error.message); }
  };

  const logWorkout = async (user) => {
    const today = getTodayDate();
    if (user.lastWorkoutDate === today) return alert("DU HAR ALLEREDE VÆRET DER! 🦍");
    await updateDoc(doc(db, "users", user.id), { workouts: increment(1), lastWorkoutDate: today, history: arrayUnion(today) });
  };

  const sendChatMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentUser) return;
    const userData = users.find(u => u.id === currentUser.uid);
    await addDoc(collection(db, "messages"), {
      text: newMessage,
      userName: userData?.name || "Anonym Dude",
      userId: currentUser.uid,
      createdAt: serverTimestamp()
    });
    setNewMessage("");
  };

  const undoWorkout = async (user) => {
    if (window.confirm("ER DU EN KYLLING? Sletter dagens træning... 💀")) {
      await updateDoc(doc(db, "users", user.id), { workouts: increment(-1), lastWorkoutDate: null, history: arrayRemove(getTodayDate()) });
    }
  };

  const updateMaxLift = async (id, liftType, currentWeight) => {
    const newWeight = prompt(`NYT MAKS I ${liftType.toUpperCase()}?`, currentWeight);
    if (newWeight && !isNaN(newWeight)) {
      await updateDoc(doc(db, "users", id), { [`maxLifts.${liftType}`]: Number(newWeight) });
    }
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
    } catch (error) { alert("FEJL: " + error.message); }
    setIsUploading(false);
  };

  useEffect(() => {
    document.body.style.backgroundColor = theme.bg;
    document.body.style.color = theme.textMain;
    document.body.style.margin = "0";
    document.body.style.textTransform = "uppercase";
  }, []);

  if (loading) return <div style={{ textAlign: "center", marginTop: "100px", color: theme.accent, fontFamily: "impact" }}><h2>VARMER OP... ☢️</h2></div>;

  if (!currentUser) {
    return (
      <div style={{ fontFamily: "impact", padding: "30px", maxWidth: "400px", margin: "50px auto", background: theme.card, border: `3px solid ${theme.accent}`, textAlign: "center" }}>
        <h1 style={{ color: theme.accent, fontSize: "40px", textShadow: `0 0 10px ${theme.neon}` }}>MASSIVE DUDES</h1>
        <form onSubmit={handleAuth} style={{ display: "flex", flexDirection: "column", gap: "15px", marginTop: "20px" }}>
          {isRegistering && <input type="text" placeholder="DIT KAMPNAVN" value={name} onChange={(e) => setName(e.target.value)} required style={{ padding: "15px", background: theme.inputBg, color: "white", border: `1px solid ${theme.accent}` }} />}
          <input type="email" placeholder="EMAIL" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ padding: "15px", background: theme.inputBg, color: "white", border: `1px solid ${theme.accent}` }} />
          <input type="password" placeholder="KODEORD" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ padding: "15px", background: theme.inputBg, color: "white", border: `1px solid ${theme.accent}` }} />
          <button type="submit" style={{ padding: "15px", background: theme.accent, color: "white", fontWeight: "bold", fontSize: "20px", cursor: "pointer" }}>{isRegistering ? "OPRET MIG 🩸" : "LOG IND 💥"}</button>
        </form>
        <p onClick={() => setIsRegistering(!isRegistering)} style={{ color: theme.textSub, cursor: "pointer", marginTop: "20px" }}>{isRegistering ? "LOG IND HER" : "OPRET DIG HER"}</p>
      </div>
    );
  }

  const currentUserData = users.find(u => u.id === currentUser.uid) || {};

  return (
    <div style={{ fontFamily: "impact", padding: "10px", maxWidth: "500px", margin: "0 auto" }}>
      
      {/* WEATHER & HEADER */}
      <div style={{ background: theme.card, padding: "10px", borderBottom: `4px solid ${theme.accent}`, marginBottom: "15px", textAlign: "center" }}>
        {weather && (
          <div style={{ fontSize: "14px", color: theme.neon, marginBottom: "5px" }}>
            VEJRET PÅ SLAGMARKEN: {weather.temperature}°C | VIND: {weather.windspeed} KM/H {weather.temperature < 5 ? "❄️ FRYSER DU, TØS?" : "🔥 PERFEKT TIL GAINS"}
          </div>
        )}
        <h2 style={{ color: theme.accent, margin: 0, textShadow: `0 0 10px ${theme.neon}` }}>MASSIVE DUDES ☢️</h2>
      </div>
      
      {/* TABS */}
      <div style={{ display: "flex", gap: "2px", marginBottom: "15px" }}>
        {["leaderboard", "maxlifts", "chat", "profile"].map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{ flex: 1, padding: "10px 2px", border: "none", backgroundColor: activeTab === t ? theme.accent : theme.card, color: "white", fontSize: "12px", fontWeight: "bold" }}>
            {t === "leaderboard" ? "DOMINANS" : t === "maxlifts" ? "RÅSTYRKE" : t === "chat" ? "TRASH TALK" : "EGO"}
          </button>
        ))}
      </div>

      {/* LEADERBOARD */}
      {activeTab === "leaderboard" && (
        <div style={{ fontFamily: "sans-serif" }}>
          {users.sort((a, b) => b.workouts - a.workouts).map(user => {
            const isMe = currentUser.uid === user.id;
            const doneToday = user.lastWorkoutDate === getTodayDate();
            const daysSinceLast = user.lastWorkoutDate ? (new Date() - new Date(user.lastWorkoutDate)) / (1000 * 3600 * 24) : 99;
            const isShamed = daysSinceLast > 7;
            const streak = calculateStreak(user.history);

            return (
              <div key={user.id} style={{ background: isShamed ? "#333" : theme.card, marginBottom: "10px", border: isMe ? `2px solid ${theme.accent}` : "1px solid #222", opacity: isShamed ? 0.6 : 1 }}>
                <div onClick={() => setExpandedUserId(expandedUserId === user.id ? null : user.id)} style={{ padding: "15px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ width: "40px", height: "40px", backgroundImage: `url(${user.photoUrl})`, backgroundSize: "cover", backgroundPosition: "center", border: `2px solid ${theme.accent}` }} />
                    <div>
                      <div style={{ fontWeight: "bold", color: isShamed ? "#888" : "white" }}>{user.name} {isShamed && "🤡 (SKAM)"}</div>
                      <div style={{ fontSize: "12px", color: theme.neon }}>STREAK: {streak} 🔥</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <span style={{ fontSize: "20px", color: theme.accent, fontWeight: "bold" }}>{user.workouts}</span>
                    {isMe && (
                      <button onClick={(e) => { e.stopPropagation(); doneToday ? undoWorkout(user) : logWorkout(user); }} style={{ padding: "5px 10px", background: doneToday ? "#444" : theme.accent, color: "white", border: "none", fontSize: "10px" }}>
                        {doneToday ? "UNDO 💀" : "TJEK IND"}
                      </button>
                    )}
                  </div>
                </div>
                {expandedUserId === user.id && (
                    <div style={{ padding: "10px", background: "#000", fontSize: "12px", color: theme.textSub }}>
                        BIO: {user.bio} <br/>
                        SENESTE: {user.lastWorkoutDate || "ALDRIG"}
                    </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* CHAT (TRASH TALK) */}
      {activeTab === "chat" && (
        <div style={{ display: "flex", flexDirection: "column", height: "60vh", background: theme.card, border: `2px solid ${theme.accent}` }}>
          <div style={{ flex: 1, overflowY: "auto", padding: "10px", display: "flex", flexDirection: "column", gap: "10px" }}>
            {messages.map(m => (
              <div key={m.id} style={{ alignSelf: m.userId === currentUser.uid ? "flex-end" : "flex-start", background: m.userId === currentUser.uid ? theme.accent : "#333", padding: "8px 12px", borderRadius: "4px", maxWidth: "80%" }}>
                <div style={{ fontSize: "10px", fontWeight: "bold", marginBottom: "2px", opacity: 0.7 }}>{m.userName}</div>
                <div style={{ fontSize: "14px", textTransform: "none" }}>{m.text}</div>
              </div>
            ))}
          </div>
          <form onSubmit={sendChatMessage} style={{ display: "flex", borderTop: `2px solid ${theme.accent}` }}>
            <input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="SVIN DEM TIL..." style={{ flex: 1, padding: "15px", background: theme.bg, color: "white", border: "none" }} />
            <button type="submit" style={{ padding: "15px", background: theme.accent, color: "white", border: "none", fontWeight: "bold" }}>SEND</button>
          </form>
        </div>
      )}

      {/* MAKS LØFT & PROFIL (Samme logik som før, bare med nyt design) */}
      {activeTab === "maxlifts" && (
          <div style={{fontFamily: "sans-serif"}}>
              {users.map(user => (
                  <div key={user.id} style={{background: theme.card, padding: "15px", marginBottom: "10px", border: `1px solid #333`}}>
                      <h3 style={{color: theme.accent, margin: "0 0 10px 0"}}>{user.name}</h3>
                      <div onClick={() => user.id === currentUser.uid && updateMaxLift(user.id, "bench", user.maxLifts.bench)}>BÆNK: {user.maxLifts.bench} KG</div>
                      <div onClick={() => user.id === currentUser.uid && updateMaxLift(user.id, "squat", user.maxLifts.squat)}>SQUAT: {user.maxLifts.squat} KG</div>
                      <div onClick={() => user.id === currentUser.uid && updateMaxLift(user.id, "deadlift", user.maxLifts.deadlift)}>DØD: {user.maxLifts.deadlift} KG</div>
                  </div>
              ))}
          </div>
      )}

      {activeTab === "profile" && (
          <div style={{background: theme.card, padding: "20px", border: `2px solid ${theme.accent}`}}>
              <h3>DIT EGO</h3>
              <textarea value={myBio} onChange={(e) => setMyBio(e.target.value)} style={{width: "100%", height: "80px", background: "#000", color: "white", border: "1px solid #444", marginBottom: "10px"}} />
              <input type="file" onChange={handleImageUpload} style={{marginBottom: "10px"}} />
              {isUploading && <p>UPLOADER FLEX... 📸</p>}
              <button onClick={async () => {
                  await updateDoc(doc(db, "users", currentUser.uid), { bio: myBio });
                  alert("GEMT! 💥");
              }} style={{width: "100%", padding: "15px", background: theme.accent, color: "white", fontWeight: "bold"}}>GEM PROFIL</button>
          </div>
      )}

    </div>
  );
}
