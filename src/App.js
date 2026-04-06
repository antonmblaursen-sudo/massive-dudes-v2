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
    // Vi filtrerer historikken for at få unikke datoer (uanset om det er gym eller cardio)
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

  const handleAuth = async (e) => {
    e.preventDefault();
    try {
      if (isRegistering) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, "users", userCredential.user.uid), {
          name: name, workouts: 0, lastWorkoutDate: null, history: [], bio: "Klar til gains.", photoUrl: "", maxLifts: { bench: 0, squat: 0, deadlift: 0 }
        });
      } else { await signInWithEmailAndPassword(auth, email, password); }
    } catch (error) { setErrorMsg("Fejl: " + error.message); }
  };

  // NY LOG FUNKTION
  const logActivity = async (type) => {
    const today = getTodayDate();
    const userData = users.find(u => u.id === currentUser.uid);
    if (userData.lastWorkoutDate === today) return alert("Du har allerede tjekket ind i dag! ⏳");

    let title = "";
    let distance = "";

    if (type === "gym") {
      title = prompt("Hvad har du trænet? (f.eks. Bryst & Triceps)");
    } else {
      distance = prompt("Hvor mange kilometer har du løbet?");
      title = prompt("Beskrivelse (valgfri - f.eks. Roligt løb)");
    }

    const activityObj = {
      date: today,
      type: type,
      title: title || (type === "gym" ? "Styrketræning" : "Cardio"),
      value: distance || null
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
    if (window.confirm(`Slet seneste log for ${user.name}?`)) {
      const lastEntry = user.history[user.history.length - 1];
      const isGym = lastEntry.type === "gym" || typeof lastEntry === 'string';
      
      await updateDoc(doc(db, "users", user.id), {
        workouts: isGym ? increment(-1) : increment(0),
        lastWorkoutDate: null,
        history: arrayRemove(lastEntry)
      });
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
        {["leaderboard", "maxlifts", "chat", "profile"].map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{ flex: 1, padding: "10px 0", borderRadius: "8px", border: "none", backgroundColor: activeTab === t ? theme.accent : "transparent", color: activeTab === t ? "#000" : theme.textSub, fontWeight: "bold", fontSize: "12px" }}>
            {t === "leaderboard" ? "Ranking" : t === "maxlifts" ? "Maks" : t === "chat" ? "Trash Talk" : "Profil"}
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
            return (
              <div key={user.id} style={{ background: theme.card, marginBottom: "10px", borderRadius: "12px", border: isMe ? `1px solid ${theme.accent}` : "1px solid #333", overflow: "hidden" }}>
                <div onClick={() => setExpandedUserId(expandedUserId === user.id ? null : user.id)} style={{ padding: "15px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <img src={user.photoUrl} style={{ width: "40px", height: "40px", borderRadius: "50%", background: "#444" }} />
                    <div>
                      <div style={{ fontWeight: "bold" }}>{user.name}</div>
                      <div style={{ fontSize: "12px", color: theme.accent }}>{streak} dag{streak === 1 ? "" : "e"} 🔥</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontWeight: "bold" }}>{user.workouts} 🏋️</span>
                    {isMe && !doneToday && (
                      <button onClick={(e) => { e.stopPropagation(); setShowLogModal(true); }} style={{ padding: "6px 12px", borderRadius: "6px", background: theme.accent, border: "none", fontSize: "12px", fontWeight: "bold" }}>Log</button>
                    )}
                    {(isMe || isAdmin) && doneToday && (
                      <button onClick={(e) => { e.stopPropagation(); undoWorkout(user); }} style={{ color: "#ef4444", border: "none", background: "none", fontSize: "11px" }}>Fortryd</button>
                    )}
                  </div>
                </div>
                
                {expandedUserId === user.id && (
                  <div style={{ padding: "10px 15px", background: "#151515", borderTop: "1px solid #333", fontSize: "13px" }}>
                    <p style={{ color: theme.textSub, margin: "0 0 10px 0" }}>"{user.bio}"</p>
                    <div style={{ fontWeight: "bold", color: theme.accent, marginBottom: "5px" }}>Seneste aktivitet:</div>
                    {[...user.history].reverse().slice(0, 5).map((h, i) => (
                      <div key={i} style={{ marginBottom: "4px", padding: "5px", background: "#222", borderRadius: "4px" }}>
                        {h.type === "gym" ? "🏋️ Styrke" : "🏃‍♂️ Cardio"}: {h.title} {h.value && `(${h.value} km)`} <span style={{fontSize:"10px", color:"#666"}}>- {h.date}</span>
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
                <div style={{ fontSize: "10px", opacity: 0.7 }}>{m.userName}</div>
                <div style={{ fontSize: "14px" }}>{m.text}</div>
              </div>
            ))}
          </div>
          <form onSubmit={sendChatMessage} style={{ display: "flex", padding: "10px", gap: "5px" }}>
            <input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Trash talk..." style={{ flex: 1, padding: "10px", borderRadius: "8px", background: theme.inputBg, color: "white", border: "none" }} />
            <button type="submit" style={{ padding: "10px 15px", background: theme.accent, border: "none", borderRadius: "8px", fontWeight: "bold" }}>Send</button>
          </form>
        </div>
      )}

      {/* MODAL TIL VALG AF TRÆNING */}
      {showLogModal && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.8)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 100 }}>
          <div style={{ background: theme.card, padding: "25px", borderRadius: "16px", width: "80%", maxWidth: "300px", textAlign: "center" }}>
            <h3 style={{ marginTop: 0 }}>Hvad har du lavet?</h3>
            <button onClick={() => logActivity("gym")} style={{ width: "100%", padding: "15px", background: theme.accent, border: "none", borderRadius: "8px", fontWeight: "bold", marginBottom: "10px" }}>🏋️ Styrketræning</button>
            <button onClick={() => logActivity("cardio")} style={{ width: "100%", padding: "15px", background: "#3b82f6", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold", marginBottom: "15px" }}>🏃‍♂️ Cardio / Løb</button>
            <button onClick={() => setShowLogModal(false)} style={{ color: theme.textSub, background: "none", border: "none" }}>Annuller</button>
          </div>
        </div>
      )}

      {/* MAKS LØFT & PROFIL */}
      {activeTab === "maxlifts" && (
        <div>
          {users.map(user => (
            <div key={user.id} style={{ background: theme.card, padding: "15px", marginBottom: "10px", borderRadius: "12px" }}>
              <h4 style={{ margin: "0 0 10px 0" }}>{user.name}</h4>
              <div style={{ fontSize: "14px", color: theme.accent }}>Bænk: {user.maxLifts.bench} kg | Squat: {user.maxLifts.squat} kg | Død: {user.maxLifts.deadlift} kg</div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "profile" && (
        <div style={{ background: theme.card, padding: "20px", borderRadius: "12px" }}>
          <textarea value={myBio} onChange={(e) => setMyBio(e.target.value)} style={{ width: "100%", height: "60px", background: theme.inputBg, color: "white", border: "none", borderRadius: "8px", padding: "10px" }} />
          <input type="file" onChange={handleImageUpload} style={{ marginTop: "10px" }} />
          <button onClick={async () => { await updateDoc(doc(db, "users", currentUser.uid), { bio: myBio }); alert("Gemt!"); }} style={{ width: "100%", padding: "12px", background: theme.accent, border: "none", borderRadius: "8px", marginTop: "15px", fontWeight: "bold" }}>Gem Profil</button>
          <button onClick={() => signOut(auth)} style={{ width: "100%", background: "none", color: "#ef4444", border: "1px solid #ef4444", padding: "10px", borderRadius: "8px", marginTop: "10px" }}>Log ud</button>
        </div>
      )}

    </div>
  );
}
