import React, { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, onSnapshot, doc, setDoc, updateDoc, increment, arrayUnion, arrayRemove, addDoc, serverTimestamp, query, orderBy, limit } from "firebase/firestore";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

// --- 👑 ADMIN INDSTILLING ---
// Skift denne til præcis den email, du selv bruger til at logge ind med!
const ADMIN_EMAIL = "antonmblaursen@gmail.com"; 

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

  // Tjekker om den loggede bruger er Admin
  const isAdmin = currentUser && currentUser.email === ADMIN_EMAIL;

  // --- PREMIUM DARK MODE TEMA ---
  const theme = {
    bg: "#121212", // Blødere sort
    card: "#1E1E1E", // Stilren mørkegrå
    accent: "#F59E0B", // Guld/Amber (Motiverende, sporty farve)
    textMain: "#F3F4F6", // Blød hvid
    textSub: "#9CA3AF", // Lys grå
    inputBg: "#374151",
    border: "#333333"
  };

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
    const sortedDates = [...new Set(history)].sort((a, b) => new Date(b) - new Date(a));
    let streak = 0;
    let checkDate = new Date();
    
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
          name: name, workouts: 0, lastWorkoutDate: null, history: [], bio: "Klar til at løfte.", photoUrl: "", maxLifts: { bench: 0, squat: 0, deadlift: 0 }
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error) { setErrorMsg("Fejl: " + error.message); }
  };

  const logWorkout = async (user) => {
    const today = getTodayDate();
    if (user.lastWorkoutDate === today) return alert("Allerede tjekket ind i dag! 💪");
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
    if (window.confirm(`Vil du fjerne dagens træning for ${user.name}?`)) {
      await updateDoc(doc(db, "users", user.id), { workouts: increment(-1), lastWorkoutDate: null, history: arrayRemove(getTodayDate()) });
    }
  };

  const updateMaxLift = async (id, liftType, currentWeight, userName) => {
    const newWeight = prompt(`Nyt maks i ${liftType} for ${userName} (kg):`, currentWeight);
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
    } catch (error) { alert("Fejl ved upload: " + error.message); }
    setIsUploading(false);
  };

  useEffect(() => {
    document.body.style.backgroundColor = theme.bg;
    document.body.style.color = theme.textMain;
    document.body.style.margin = "0";
    document.body.style.fontFamily = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  }, []);

  if (loading) return <div style={{ textAlign: "center", marginTop: "100px", color: theme.accent }}><h2>Indlæser appen... ⏳</h2></div>;

  if (!currentUser) {
    return (
      <div style={{ padding: "40px", maxWidth: "400px", margin: "50px auto", background: theme.card, borderRadius: "16px", textAlign: "center", boxShadow: "0 10px 30px rgba(0,0,0,0.5)" }}>
        <h1 style={{ color: theme.accent, fontSize: "32px", margin: "0 0 10px 0" }}>MASSIVE DUDES</h1>
        <p style={{ color: theme.textSub, marginBottom: "30px" }}>Log ind for at tracke dine løft</p>
        {errorMsg && <p style={{ color: "#ef4444" }}>{errorMsg}</p>}
        <form onSubmit={handleAuth} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
          {isRegistering && <input type="text" placeholder="Dit Navn" value={name} onChange={(e) => setName(e.target.value)} required style={{ padding: "14px", borderRadius: "8px", background: theme.inputBg, color: "white", border: "none", outline: "none" }} />}
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ padding: "14px", borderRadius: "8px", background: theme.inputBg, color: "white", border: "none", outline: "none" }} />
          <input type="password" placeholder="Kodeord" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ padding: "14px", borderRadius: "8px", background: theme.inputBg, color: "white", border: "none", outline: "none" }} />
          <button type="submit" style={{ padding: "14px", borderRadius: "8px", background: theme.accent, color: "#000", fontWeight: "bold", fontSize: "16px", cursor: "pointer", border: "none", marginTop: "10px" }}>{isRegistering ? "Opret Profil" : "Log Ind"}</button>
        </form>
        <p onClick={() => setIsRegistering(!isRegistering)} style={{ color: theme.textSub, cursor: "pointer", marginTop: "25px", fontSize: "14px" }}>{isRegistering ? "Har du allerede en konto? Log ind" : "Ny her? Opret en profil"}</p>
      </div>
    );
  }

  const currentUserData = users.find(u => u.id === currentUser.uid) || {};

  return (
    <div style={{ padding: "15px", maxWidth: "500px", margin: "0 auto" }}>
      
      {/* HEADER & WEATHER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h2 style={{ color: theme.accent, margin: 0, fontSize: "24px" }}>MASSIVE DUDES {isAdmin && "👑"}</h2>
          {weather && (
            <div style={{ fontSize: "12px", color: theme.textSub, marginTop: "4px" }}>
              Vejret: {weather.temperature}°C | Vind: {weather.windspeed} km/t
            </div>
          )}
        </div>
      </div>
      
      {/* TABS */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px", background: theme.card, padding: "5px", borderRadius: "10px" }}>
        {["leaderboard", "maxlifts", "chat", "profile"].map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{ flex: 1, padding: "12px 0", borderRadius: "8px", border: "none", backgroundColor: activeTab === t ? theme.accent : "transparent", color: activeTab === t ? "#000" : theme.textSub, fontSize: "13px", fontWeight: "bold", cursor: "pointer", transition: "0.2s" }}>
            {t === "leaderboard" ? "Ranking" : t === "maxlifts" ? "Maks Løft" : t === "chat" ? "Trash Talk" : "Profil"}
          </button>
        ))}
      </div>

      {/* LEADERBOARD */}
      {activeTab === "leaderboard" && (
        <div>
          {users.sort((a, b) => b.workouts - a.workouts).map(user => {
            const isMe = currentUser.uid === user.id;
            const doneToday = user.lastWorkoutDate === getTodayDate();
            const daysSinceLast = user.lastWorkoutDate ? (new Date() - new Date(user.lastWorkoutDate)) / (1000 * 3600 * 24) : 99;
            const isShamed = daysSinceLast > 7;
            const streak = calculateStreak(user.history);
            // Admin og brugeren selv må fjerne træninger
            const canEdit = isMe || isAdmin; 

            return (
              <div key={user.id} style={{ background: theme.card, marginBottom: "12px", borderRadius: "12px", border: isMe ? `1px solid ${theme.accent}` : `1px solid ${theme.border}`, opacity: isShamed ? 0.6 : 1, overflow: "hidden" }}>
                <div onClick={() => setExpandedUserId(expandedUserId === user.id ? null : user.id)} style={{ padding: "16px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ width: "45px", height: "45px", borderRadius: "50%", backgroundImage: `url(${user.photoUrl})`, backgroundSize: "cover", backgroundPosition: "center", border: `2px solid ${isMe ? theme.accent : theme.border}`, backgroundColor: theme.inputBg }} />
                    <div>
                      <div style={{ fontWeight: "bold", fontSize: "16px", color: isShamed ? theme.textSub : theme.textMain }}>{user.name} {isShamed && "🤡"}</div>
                      <div style={{ fontSize: "13px", color: theme.accent, marginTop: "2px" }}>Streak: {streak} 🔥</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span style={{ fontSize: "20px", color: theme.textMain, fontWeight: "bold" }}>{user.workouts} <span style={{fontSize: "14px", color: theme.textSub}}>træninger</span></span>
                    
                    {/* Tjek ind knap (Kun for brugeren selv) */}
                    {isMe && !doneToday && (
                      <button onClick={(e) => { e.stopPropagation(); logWorkout(user); }} style={{ padding: "8px 14px", borderRadius: "8px", background: theme.accent, color: "#000", border: "none", fontWeight: "bold", cursor: "pointer" }}>
                        + Tjek ind
                      </button>
                    )}
                    
                    {/* Fortryd/Slet knap (For brugeren selv ELLER Admin) */}
                    {canEdit && doneToday && (
                      <button onClick={(e) => { e.stopPropagation(); undoWorkout(user); }} style={{ padding: "8px 12px", borderRadius: "8px", background: theme.inputBg, color: theme.textSub, border: "none", fontSize: "12px", cursor: "pointer" }}>
                        Fortryd
                      </button>
                    )}
                  </div>
                </div>
                {expandedUserId === user.id && (
                    <div style={{ padding: "15px 16px", background: "rgba(0,0,0,0.2)", borderTop: `1px solid ${theme.border}`, fontSize: "14px", color: theme.textSub, lineHeight: "1.5" }}>
                        <p style={{fontStyle: "italic", margin: "0 0 8px 0"}}>"{user.bio}"</p>
                        <p style={{margin: 0}}>Sidste træning: {user.lastWorkoutDate || "Aldrig"}</p>
                    </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* CHAT (TRASH TALK) */}
      {activeTab === "chat" && (
        <div style={{ display: "flex", flexDirection: "column", height: "60vh", background: theme.card, borderRadius: "12px", border: `1px solid ${theme.border}`, overflow: "hidden" }}>
          <div style={{ flex: 1, overflowY: "auto", padding: "15px", display: "flex", flexDirection: "column", gap: "12px" }}>
            {messages.map(m => (
              <div key={m.id} style={{ alignSelf: m.userId === currentUser.uid ? "flex-end" : "flex-start", background: m.userId === currentUser.uid ? theme.accent : theme.inputBg, color: m.userId === currentUser.uid ? "#000" : theme.textMain, padding: "10px 14px", borderRadius: "12px", maxWidth: "80%" }}>
                <div style={{ fontSize: "11px", fontWeight: "bold", marginBottom: "4px", opacity: 0.7 }}>{m.userName}</div>
                <div style={{ fontSize: "14px" }}>{m.text}</div>
              </div>
            ))}
          </div>
          <form onSubmit={sendChatMessage} style={{ display: "flex", borderTop: `1px solid ${theme.border}`, padding: "10px", gap: "10px", background: "rgba(0,0,0,0.2)" }}>
            <input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Skriv en besked..." style={{ flex: 1, padding: "12px 15px", borderRadius: "20px", background: theme.inputBg, color: "white", border: "none", outline: "none" }} />
            <button type="submit" style={{ padding: "0 20px", borderRadius: "20px", background: theme.accent, color: "#000", border: "none", fontWeight: "bold", cursor: "pointer" }}>Send</button>
          </form>
        </div>
      )}

      {/* MAKS LØFT */}
      {activeTab === "maxlifts" && (
          <div>
              {users.map(user => {
                const canEdit = currentUser.uid === user.id || isAdmin; // Admin kan redigere alles løft
                
                return (
                  <div key={user.id} style={{background: theme.card, padding: "20px", marginBottom: "12px", borderRadius: "12px", border: `1px solid ${theme.border}`}}>
                      <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px"}}>
                        <h3 style={{color: theme.textMain, margin: 0}}>{user.name}</h3>
                        {canEdit && <span style={{fontSize: "12px", color: theme.textSub}}>Tryk for at redigere ✏️</span>}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        <div onClick={() => canEdit && updateMaxLift(user.id, "bench", user.maxLifts.bench, user.name)} style={{ display: "flex", justifyContent: "space-between", paddingBottom: "10px", borderBottom: `1px solid ${theme.border}`, cursor: canEdit ? "pointer" : "default" }}>
                          <span style={{color: theme.textSub}}>Bænkpres:</span> <strong style={{color: theme.accent}}>{user.maxLifts?.bench || 0} kg</strong>
                        </div>
                        <div onClick={() => canEdit && updateMaxLift(user.id, "squat", user.maxLifts.squat, user.name)} style={{ display: "flex", justifyContent: "space-between", paddingBottom: "10px", borderBottom: `1px solid ${theme.border}`, cursor: canEdit ? "pointer" : "default" }}>
                          <span style={{color: theme.textSub}}>Squat:</span> <strong style={{color: theme.accent}}>{user.maxLifts?.squat || 0} kg</strong>
                        </div>
                        <div onClick={() => canEdit && updateMaxLift(user.id, "deadlift", user.maxLifts.deadlift, user.name)} style={{ display: "flex", justifyContent: "space-between", cursor: canEdit ? "pointer" : "default" }}>
                          <span style={{color: theme.textSub}}>Dødløft:</span> <strong style={{color: theme.accent}}>{user.maxLifts?.deadlift || 0} kg</strong>
                        </div>
                      </div>
                  </div>
                )
              })}
          </div>
      )}

      {/* MIN PROFIL */}
      {activeTab === "profile" && (
          <div style={{background: theme.card, padding: "25px", borderRadius: "12px", border: `1px solid ${theme.border}`}}>
              <h3 style={{color: theme.textMain, marginTop: 0, marginBottom: "20px"}}>Rediger Profil</h3>
              
              <label style={{ display: "block", marginBottom: "8px", color: theme.textSub, fontSize: "14px" }}>Din Bio</label>
              <textarea value={myBio} onChange={(e) => setMyBio(e.target.value)} style={{width: "100%", height: "80px", background: theme.inputBg, color: theme.textMain, border: "none", borderRadius: "8px", padding: "12px", marginBottom: "20px", boxSizing: "border-box", resize: "none", outline: "none"}} />
              
              <label style={{ display: "block", marginBottom: "8px", color: theme.textSub, fontSize: "14px" }}>Profilbillede</label>
              <div style={{display: "flex", alignItems: "center", gap: "15px", marginBottom: "25px"}}>
                {myPhoto ? (
                  <img src={myPhoto} alt="Preview" style={{ width: "60px", height: "60px", borderRadius: "50%", objectFit: "cover", border: `2px solid ${theme.accent}` }} />
                ) : (
                  <div style={{ width: "60px", height: "60px", borderRadius: "50%", background: theme.inputBg, border: `2px dashed ${theme.border}` }} />
                )}
                <input type="file" onChange={handleImageUpload} style={{flex: 1, color: theme.textSub, fontSize: "14px"}} />
              </div>
              {isUploading && <p style={{color: theme.accent, fontSize: "14px", marginTop: "-15px", marginBottom: "15px"}}>Uploader billede... ⏳</p>}
              
              <button onClick={async () => {
                  await updateDoc(doc(db, "users", currentUser.uid), { bio: myBio });
                  alert("Profil gemt! 💪");
              }} style={{width: "100%", padding: "14px", borderRadius: "8px", background: theme.accent, color: "#000", fontWeight: "bold", border: "none", cursor: "pointer", fontSize: "16px", marginBottom: "15px"}}>Gem Ændringer</button>
              
              <button onClick={() => signOut(auth)} style={{width: "100%", padding: "14px", borderRadius: "8px", background: "transparent", color: "#ef4444", fontWeight: "bold", border: "1px solid #ef4444", cursor: "pointer", fontSize: "16px"}}>Log ud</button>
          </div>
      )}

    </div>
  );
}
