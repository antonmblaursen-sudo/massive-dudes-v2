import React, { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, onSnapshot, doc, setDoc, updateDoc, increment, arrayUnion, arrayRemove, addDoc, serverTimestamp, query, orderBy, limit } from "firebase/firestore";
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
  const [newMessage, setNewMessage] = useState("");
  const [weather, setWeather] = useState(null);
  const [expandedUserId, setExpandedUserId] = useState(null);
  const [showLogModal, setShowLogModal] = useState(false);
  
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

  const isAdmin = currentUser && currentUser.email === ADMIN_EMAIL;

  const theme = {
    bg: "#121212", card: "#1E1E1E", accent: "#F59E0B", textMain: "#F3F4F6", textSub: "#9CA3AF", inputBg: "#374151", border: "#333333"
  };

  useEffect(() => {
    fetch("https://api.open-meteo.com/v1/forecast?latitude=55.6761&longitude=12.5683&current_weather=true")
      .then(res => res.json()).then(data => setWeather(data.current_weather));
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, "messages"), orderBy("createdAt", "desc"), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).reverse());
    });
    return () => unsubscribe();
  }, []);

  const getTodayDate = () => new Date().toISOString().split('T')[0];

  const calculateStreak = (history = []) => {
    if (!history.length) return 0;
    const datesOnly = history.map(h => typeof h === 'string' ? h : h.date);
    const sortedDates = [...new Set(datesOnly)].sort((a, b) => new Date(b) - new Date(a));
    let streak = 0;
    let checkDate = new Date();
    if (sortedDates[0] !== getTodayDate()) checkDate.setDate(checkDate.getDate() - 1);
    for (let i = 0; i < sortedDates.length; i++) {
      const dString = checkDate.toISOString().split('T')[0];
      if (sortedDates.includes(dString)) { streak++; checkDate.setDate(checkDate.getDate() - 1); }
      else break;
    }
    return streak;
  };

  // Beregner alle km lagt sammen fra historikken
  const calculateTotalCardio = (history = []) => {
    const total = history.reduce((sum, entry) => {
      if (typeof entry === 'object' && entry.type === "cardio" && entry.value) {
        return sum + Number(entry.value);
      }
      return sum;
    }, 0);
    return total > 0 ? parseFloat(total.toFixed(1)) : 0;
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    try {
      if (isRegistering) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, "users", userCredential.user.uid), {
          name: name, workouts: 0, lastWorkoutDate: null, history: [], bio: "Klar til at dominere.", photoUrl: "", maxLifts: { bench: 0, squat: 0, deadlift: 0 }, cardioRecords: { longestRun: 0, fastest5k: "-" }
        });
      } else { await signInWithEmailAndPassword(auth, email, password); }
    } catch (error) { setErrorMsg("Fejl: " + error.message); }
  };

  const logActivity = async (type) => {
    const today = getTodayDate();
    let title = "";
    let distance = "";

    if (type === "gym") {
      title = prompt("Hvad har du trænet? (f.eks. Bryst & Triceps)");
      if (title === null) return; // Annulleret
    } else {
      distance = prompt("Hvor mange kilometer? (Skriv tal, f.eks. 5 eller 5.5)");
      if (distance === null) return; // Annulleret
      title = prompt("Beskrivelse (f.eks. Morgenløb, Intervaller)");
    }

    // Erstatter komma med punktum, så systemet forstår kommatal
    const parsedDistance = distance ? Number(distance.replace(',', '.')) : null;

    const activityObj = {
      date: today,
      type: type,
      title: title || (type === "gym" ? "Styrketræning" : "Cardio"),
      value: parsedDistance
    };

    const updateData = {
      lastWorkoutDate: today,
      history: arrayUnion(activityObj)
    };

    if (type === "gym") {
      updateData.workouts = increment(1);
    }

    await updateDoc(doc(db, "users", currentUser.uid), updateData);
    setShowLogModal(false);
  };

  const undoWorkout = async (user) => {
    if (window.confirm(`Er du sikker på, du vil slette den absolut seneste aktivitet for ${user.name}?`)) {
      const lastEntry = user.history[user.history.length - 1];
      const isGym = lastEntry.type === "gym" || typeof lastEntry === 'string';
      
      await updateDoc(doc(db, "users", user.id), {
        workouts: isGym ? increment(-1) : increment(0),
        history: arrayRemove(lastEntry)
      });
    }
  };

  // Opdaterer både løft og løb
  const updateRecord = async (id, category, field, currentVal, promptText) => {
    const newVal = prompt(promptText, currentVal);
    if (newVal !== null && newVal !== "") {
      const isNum = !isNaN(newVal);
      await updateDoc(doc(db, "users", id), { [`${category}.${field}`]: isNum ? Number(newVal) : newVal });
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

  useEffect(() => {
    document.body.style.backgroundColor = theme.bg;
    document.body.style.color = theme.textMain;
    document.body.style.margin = "0";
    document.body.style.fontFamily = "sans-serif";
  }, []);

  if (loading) return <div style={{textAlign:"center", marginTop:"100px", color:theme.accent}}><h2>Indlæser... ⏳</h2></div>;

  if (!currentUser) {
    return (
      <div style={{ padding: "40px", maxWidth: "400px", margin: "50px auto", background: theme.card, borderRadius: "16px", textAlign: "center" }}>
        <h1 style={{ color: theme.accent }}>MASSIVE DUDES</h1>
        <form onSubmit={handleAuth} style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "20px" }}>
          {isRegistering && <input type="text" placeholder="Navn" value={name} onChange={(e) => setName(e.target.value)} style={{ padding: "12px", background: theme.inputBg, color: "white", border: "none", borderRadius: "8px" }} />}
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ padding: "12px", background: theme.inputBg, color: "white", border: "none", borderRadius: "8px" }} />
          <input type="password" placeholder="Kodeord" value={password} onChange={(e) => setPassword(e.target.value)} style={{ padding: "12px", background: theme.inputBg, color: "white", border: "none", borderRadius: "8px" }} />
          <button type="submit" style={{ padding: "12px", background: theme.accent, borderRadius: "8px", border: "none", fontWeight: "bold" }}>{isRegistering ? "Opret" : "Log Ind"}</button>
        </form>
        <p onClick={() => setIsRegistering(!isRegistering)} style={{ color: theme.textSub, cursor: "pointer", marginTop: "15px" }}>{isRegistering ? "Log ind" : "Opret profil"}</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "15px", maxWidth: "500px", margin: "0 auto" }}>
      
      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h2 style={{ color: theme.accent, margin: 0 }}>MASSIVE DUDES {isAdmin && "👑"}</h2>
        {weather && <div style={{fontSize:"11px", color:theme.textSub}}>{weather.temperature}°C | Løbevejr? 🏃‍♂️</div>}
      </div>
      
      {/* TABS */}
      <div style={{ display: "flex", gap: "5px", marginBottom: "20px", background: theme.card, padding: "5px", borderRadius: "10px" }}>
        {["leaderboard", "stats", "chat", "profile"].map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{ flex: 1, padding: "10px 0", borderRadius: "8px", border: "none", backgroundColor: activeTab === t ? theme.accent : "transparent", color: activeTab === t ? "#000" : theme.textSub, fontWeight: "bold", fontSize: "12px" }}>
            {t === "leaderboard" ? "Ranking" : t === "stats" ? "Stats" : t === "chat" ? "Trash Talk" : "Profil"}
          </button>
        ))}
      </div>

      {/* RANG-LISTE */}
      {activeTab === "leaderboard" && (
        <div>
          {users.sort((a, b) => b.workouts - a.workouts).map(user => {
            const isMe = currentUser.uid === user.id;
            const doneToday = user.lastWorkoutDate === getTodayDate();
            const streak = calculateStreak(user.history);
            const totalKm = calculateTotalCardio(user.history);

            return (
              <div key={user.id} style={{ background: theme.card, marginBottom: "10px", borderRadius: "12px", border: isMe ? `1px solid ${theme.accent}` : "1px solid #333", overflow: "hidden" }}>
                <div onClick={() => setExpandedUserId(expandedUserId === user.id ? null : user.id)} style={{ padding: "15px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <img src={user.photoUrl} alt="" style={{ width: "45px", height: "45px", borderRadius: "50%", background: "#444", border: `2px solid ${isMe ? theme.accent : "#333"}` }} />
                    <div>
                      <div style={{ fontWeight: "bold", fontSize: "16px" }}>{user.name}</div>
                      <div style={{ fontSize: "12px", color: theme.accent }}>{streak} dag{streak === 1 ? "" : "e"} streak 🔥</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    
                    {/* Både Styrke og Løb Stats vist på forsiden */}
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: "bold", fontSize: "16px" }}>{user.workouts} 🏋️</div>
                      <div style={{ fontSize: "12px", color: "#60a5fa" }}>{totalKm} km 🏃‍♂️</div>
                    </div>
                    
                    {isMe && (
                      <button onClick={(e) => { e.stopPropagation(); setShowLogModal(true); }} style={{ padding: "8px 12px", borderRadius: "8px", background: theme.accent, border: "none", fontSize: "12px", fontWeight: "bold", color: "#000" }}>
                        {doneToday ? "+ Log mere" : "+ Log"}
                      </button>
                    )}
                  </div>
                </div>
                
                {/* Udfoldet visning (Historik + Fortryd) */}
                {expandedUserId === user.id && (
                  <div style={{ padding: "15px", background: "#151515", borderTop: "1px solid #333", fontSize: "13px" }}>
                    <p style={{ color: theme.textSub, margin: "0 0 10px 0", fontStyle: "italic" }}>"{user.bio}"</p>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
                      <span style={{ fontWeight: "bold", color: theme.accent }}>Seneste aktivitet:</span>
                      {(isMe || isAdmin) && user.history.length > 0 && (
                         <button onClick={() => undoWorkout(user)} style={{ color: "#ef4444", border: "none", background: "none", fontSize: "11px", cursor: "pointer" }}>Slet seneste log 💀</button>
                      )}
                    </div>
                    {[...user.history].reverse().slice(0, 5).map((h, i) => (
                      <div key={i} style={{ marginBottom: "5px", padding: "8px", background: theme.inputBg, borderRadius: "6px", display: "flex", justifyContent: "space-between" }}>
                        <span>{h.type === "gym" ? "🏋️ " : "🏃‍♂️ "} {h.title} {h.value && `(${h.value} km)`}</span>
                        <span style={{fontSize:"10px", color:theme.textSub}}>{h.date}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* CHAT */}
      {activeTab === "chat" && (
        <div style={{ height: "60vh", background: theme.card, borderRadius: "12px", display: "flex", flexDirection: "column" }}>
          <div style={{ flex: 1, overflowY: "auto", padding: "15px", display: "flex", flexDirection: "column", gap: "10px" }}>
            {messages.map(m => (
              <div key={m.id} style={{ alignSelf: m.userId === currentUser.uid ? "flex-end" : "flex-start", background: m.userId === currentUser.uid ? theme.accent : "#333", color: m.userId === currentUser.uid ? "#000" : "white", padding: "8px 12px", borderRadius: "10px", maxWidth: "80%" }}>
                <div style={{ fontSize: "10px", opacity: 0.7, fontWeight: "bold" }}>{m.userName}</div>
                <div style={{ fontSize: "14px" }}>{m.text}</div>
              </div>
            ))}
          </div>
          <form onSubmit={sendChatMessage} style={{ display: "flex", padding: "10px", gap: "5px", borderTop: "1px solid #333" }}>
            <input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Skriv besked..." style={{ flex: 1, padding: "10px", borderRadius: "8px", background: theme.inputBg, color: "white", border: "none" }} />
            <button type="submit" style={{ padding: "10px 15px", background: theme.accent, color: "#000", border: "none", borderRadius: "8px", fontWeight: "bold" }}>Send</button>
          </form>
        </div>
      )}

      {/* MODAL TIL VALG AF TRÆNING */}
      {showLogModal && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.8)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 100 }}>
          <div style={{ background: theme.card, padding: "25px", borderRadius: "16px", width: "80%", maxWidth: "300px", textAlign: "center", border: `1px solid ${theme.border}` }}>
            <h3 style={{ marginTop: 0, color: "white" }}>Hvad har du lavet?</h3>
            <button onClick={() => logActivity("gym")} style={{ width: "100%", padding: "15px", background: theme.accent, color: "#000", border: "none", borderRadius: "8px", fontWeight: "bold", marginBottom: "10px", fontSize: "16px", cursor: "pointer" }}>🏋️ Styrketræning</button>
            <button onClick={() => logActivity("cardio")} style={{ width: "100%", padding: "15px", background: "#3b82f6", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold", marginBottom: "15px", fontSize: "16px", cursor: "pointer" }}>🏃‍♂️ Cardio / Løb</button>
            <button onClick={() => setShowLogModal(false)} style={{ color: theme.textSub, background: "none", border: "none", fontSize: "14px", cursor: "pointer" }}>Annuller</button>
          </div>
        </div>
      )}

      {/* STATS & REKORDER */}
      {activeTab === "stats" && (
        <div>
          {users.map(user => {
            const canEdit = currentUser.uid === user.id || isAdmin;
            return (
              <div key={user.id} style={{ background: theme.card, padding: "20px", marginBottom: "15px", borderRadius: "12px", border: `1px solid ${theme.border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
                  <h3 style={{ margin: 0, color: "white" }}>{user.name}</h3>
                  {canEdit && <span style={{ fontSize: "11px", color: theme.textSub }}>Tryk for at redigere ✏️</span>}
                </div>
                
                {/* STYRKE */}
                <h4 style={{ color: theme.accent, margin: "0 0 10px 0", fontSize: "14px", textTransform: "uppercase" }}>🏋️ Styrke (Maks)</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "20px" }}>
                  <div onClick={() => canEdit && updateRecord(user.id, "maxLifts", "bench", user.maxLifts?.bench, "Nyt Bænkpres maks (kg):")} style={{ display: "flex", justifyContent: "space-between", borderBottom: `1px solid ${theme.border}`, paddingBottom: "5px", cursor: canEdit ? "pointer" : "default" }}>
                    <span style={{ color: theme.textSub }}>Bænkpres:</span> <strong>{user.maxLifts?.bench || 0} kg</strong>
                  </div>
                  <div onClick={() => canEdit && updateRecord(user.id, "maxLifts", "squat", user.maxLifts?.squat, "Nyt Squat maks (kg):")} style={{ display: "flex", justifyContent: "space-between", borderBottom: `1px solid ${theme.border}`, paddingBottom: "5px", cursor: canEdit ? "pointer" : "default" }}>
                    <span style={{ color: theme.textSub }}>Squat:</span> <strong>{user.maxLifts?.squat || 0} kg</strong>
                  </div>
                  <div onClick={() => canEdit && updateRecord(user.id, "maxLifts", "deadlift", user.maxLifts?.deadlift, "Nyt Dødløft maks (kg):")} style={{ display: "flex", justifyContent: "space-between", cursor: canEdit ? "pointer" : "default" }}>
                    <span style={{ color: theme.textSub }}>Dødløft:</span> <strong>{user.maxLifts?.deadlift || 0} kg</strong>
                  </div>
                </div>

                {/* CARDIO */}
                <h4 style={{ color: "#60a5fa", margin: "0 0 10px 0", fontSize: "14px", textTransform: "uppercase" }}>🏃‍♂️ Løb (Rekorder)</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", borderBottom: `1px solid ${theme.border}`, paddingBottom: "5px" }}>
                    <span style={{ color: theme.textSub }}>Total løbet:</span> <strong>{calculateTotalCardio(user.history)} km</strong>
                  </div>
                  <div onClick={() => canEdit && updateRecord(user.id, "cardioRecords", "longestRun", user.cardioRecords?.longestRun, "Længste løbetur (km):")} style={{ display: "flex", justifyContent: "space-between", borderBottom: `1px solid ${theme.border}`, paddingBottom: "5px", cursor: canEdit ? "pointer" : "default" }}>
                    <span style={{ color: theme.textSub }}>Længste tur:</span> <strong>{user.cardioRecords?.longestRun || 0} km</strong>
                  </div>
                  <div onClick={() => canEdit && updateRecord(user.id, "cardioRecords", "fastest5k", user.cardioRecords?.fastest5k, "Hurtigste 5 km (f.eks. '24:30'):")} style={{ display: "flex", justifyContent: "space-between", cursor: canEdit ? "pointer" : "default" }}>
                    <span style={{ color: theme.textSub }}>Hurtigste 5 km:</span> <strong>{user.cardioRecords?.fastest5k || "-"}</strong>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MIN PROFIL */}
      {activeTab === "profile" && (
        <div style={{ background: theme.card, padding: "20px", borderRadius: "12px" }}>
          <h3 style={{ margin: "0 0 15px 0" }}>Din Profil</h3>
          <textarea value={myBio} onChange={(e) => setMyBio(e.target.value)} style={{ width: "100%", height: "60px", background: theme.inputBg, color: "white", border: "none", borderRadius: "8px", padding: "10px", boxSizing: "border-box" }} placeholder="Lidt om dig..." />
          <input type="file" onChange={handleImageUpload} style={{ marginTop: "15px", display: "block" }} />
          {isUploading && <span style={{ color: theme.accent, fontSize: "12px" }}>Uploader...</span>}
          <button onClick={async () => { await updateDoc(doc(db, "users", currentUser.uid), { bio: myBio }); alert("Profil opdateret!"); }} style={{ width: "100%", padding: "12px", background: theme.accent, color: "#000", border: "none", borderRadius: "8px", marginTop: "20px", fontWeight: "bold", cursor: "pointer" }}>Gem Profil</button>
          <button onClick={() => signOut(auth)} style={{ width: "100%", background: "none", color: "#ef4444", border: "1px solid #ef4444", padding: "12px", borderRadius: "8px", marginTop: "10px", cursor: "pointer", fontWeight: "bold" }}>Log ud</button>
        </div>
      )}

    </div>
  );
}
