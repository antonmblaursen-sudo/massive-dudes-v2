import React, { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, onSnapshot, doc, setDoc, updateDoc, increment, arrayUnion } from "firebase/firestore";
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
const storage = getStorage(app); // Starter harddisken til billeder

export default function App() {
  const [activeTab, setActiveTab] = useState("leaderboard");
  const [users, setUsers] = useState([]);
  const [expandedUserId, setExpandedUserId] = useState(null);
  
  // Login & Loading State
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState(""); 
  const [isRegistering, setIsRegistering] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Profil Redigering State
  const [myBio, setMyBio] = useState("");
  const [myPhoto, setMyPhoto] = useState("");
  const [isUploading, setIsUploading] = useState(false); // Holder styr på om billedet loader

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

  const getTodayDate = () => new Date().toISOString().split('T')[0];

  const handleAuth = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    try {
      if (isRegistering) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, "users", userCredential.user.uid), {
          name: name,
          workouts: 0,
          lastWorkoutDate: null,
          history: [],
          bio: "Just a massive dude.",
          photoUrl: "", 
          maxLifts: { bench: 0, squat: 0, deadlift: 0 }
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error) {
      setErrorMsg("Fejl: " + error.message);
    }
  };

  const logWorkout = async (user) => {
    const today = getTodayDate();
    if (user.lastWorkoutDate === today) {
      alert("Du har allerede tjekket ind i dag, maskine!");
      return;
    }
    await updateDoc(doc(db, "users", user.id), {
      workouts: increment(1),
      lastWorkoutDate: today,
      history: arrayUnion(today)
    });
  };

  const updateMaxLift = async (id, liftType, currentWeight) => {
    const newWeight = prompt(`Nyt maks i ${liftType} (kg):`, currentWeight);
    if (newWeight && !isNaN(newWeight)) {
      await updateDoc(doc(db, "users", id), { [`maxLifts.${liftType}`]: Number(newWeight) });
    }
  };

  const saveProfile = async () => {
    if (!currentUser) return;
    await updateDoc(doc(db, "users", currentUser.uid), {
      bio: myBio,
      photoUrl: myPhoto
    });
    alert("Profil opdateret! 💪");
  };

  // --- UPLOAD BILLEDE FUNKTION ---
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    // Skab en reference (en "mappe" i Firebase) med dit unikke ID
    const imageRef = ref(storage, `profile_pictures/${currentUser.uid}`);
    
    try {
      // Upload filen
      await uploadBytes(imageRef, file);
      // Få det nye link til billedet
      const url = await getDownloadURL(imageRef);
      setMyPhoto(url);
      
      // Gem linket direkte i databasen med det samme
      await updateDoc(doc(db, "users", currentUser.uid), { photoUrl: url });
      alert("Billede uploadet! 📸");
    } catch (error) {
      alert("Fejl ved upload. Husk at tænde for Firebase Storage! Fejl: " + error.message);
    }
    setIsUploading(false);
  };

  // --- FARVE TEMA ---
  const theme = {
    bg: "#111111",
    card: "#222222",
    accent: "#FF5722",
    textMain: "#FFFFFF",
    textSub: "#AAAAAA",
    inputBg: "#333333"
  };

  useEffect(() => {
    document.body.style.backgroundColor = theme.bg;
    document.body.style.color = theme.textMain;
    document.body.style.margin = "0";
  }, []);

  if (loading) {
    return (
      <div style={{ textAlign: "center", marginTop: "100px", fontFamily: "sans-serif", color: theme.accent }}>
        <h2>Varmer op... 🏋️‍♂️</h2>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div style={{ fontFamily: "sans-serif", padding: "30px", maxWidth: "400px", margin: "50px auto", background: theme.card, borderRadius: "12px", textAlign: "center", border: `1px solid ${theme.accent}` }}>
        <h1 style={{ color: theme.accent, textTransform: "uppercase", letterSpacing: "2px" }}>MASSIVE DUDES</h1>
        <h2 style={{ color: theme.textMain }}>{isRegistering ? "Bliv en Dude" : "Log Ind"}</h2>
        {errorMsg && <p style={{ color: "red" }}>{errorMsg}</p>}
        <form onSubmit={handleAuth} style={{ display: "flex", flexDirection: "column", gap: "15px", marginTop: "20px" }}>
          {isRegistering && <input type="text" placeholder="Dit Navn" value={name} onChange={(e) => setName(e.target.value)} required style={{ padding: "12px", borderRadius: "6px", border: "none", background: theme.inputBg, color: theme.textMain }} />}
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ padding: "12px", borderRadius: "6px", border: "none", background: theme.inputBg, color: theme.textMain }} />
          <input type="password" placeholder="Kodeord" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ padding: "12px", borderRadius: "6px", border: "none", background: theme.inputBg, color: theme.textMain }} />
          <button type="submit" style={{ padding: "14px", background: theme.accent, color: "white", border: "none", borderRadius: "6px", fontWeight: "bold", fontSize: "16px", cursor: "pointer", textTransform: "uppercase" }}>{isRegistering ? "Opret" : "Log Ind"}</button>
        </form>
        <p onClick={() => setIsRegistering(!isRegistering)} style={{ color: theme.textSub, cursor: "pointer", marginTop: "20px", fontSize: "14px" }}>
          {isRegistering ? "Har du en konto? Log ind" : "Ny dude? Opret profil"}
        </p>
      </div>
    );
  }

  const currentUserData = users.find(u => u.id === currentUser.uid) || {};

  return (
    <div style={{ fontFamily: "sans-serif", padding: "20px", maxWidth: "500px", margin: "0 auto", color: theme.textMain }}>
      
      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `2px solid ${theme.accent}`, paddingBottom: "10px", marginBottom: "20px" }}>
        <h2 style={{ color: theme.accent, margin: 0, fontSize: "20px", letterSpacing: "1px" }}>MASSIVE DUDES 🦾</h2>
        <button onClick={() => signOut(auth)} style={{ padding: "8px 12px", background: theme.card, color: theme.textSub, border: "1px solid #444", borderRadius: "6px", cursor: "pointer" }}>Log ud</button>
      </div>
      
      {/* MENU NAVIGATION */}
      <div style={{ display: "flex", gap: "5px", marginBottom: "20px" }}>
        <button onClick={() => setActiveTab("leaderboard")} style={{ flex: 1, padding: "12px 5px", borderRadius: "6px", border: "none", backgroundColor: activeTab === "leaderboard" ? theme.accent : theme.card, color: activeTab === "leaderboard" ? "white" : theme.textSub, fontWeight: "bold" }}>Ranking</button>
        <button onClick={() => setActiveTab("maxlifts")} style={{ flex: 1, padding: "12px 5px", borderRadius: "6px", border: "none", backgroundColor: activeTab === "maxlifts" ? theme.accent : theme.card, color: activeTab === "maxlifts" ? "white" : theme.textSub, fontWeight: "bold" }}>Maks Løft</button>
        <button onClick={() => { setActiveTab("profile"); setMyBio(currentUserData.bio || ""); setMyPhoto(currentUserData.photoUrl || ""); }} style={{ flex: 1, padding: "12px 5px", borderRadius: "6px", border: "none", backgroundColor: activeTab === "profile" ? theme.accent : theme.card, color: activeTab === "profile" ? "white" : theme.textSub, fontWeight: "bold" }}>Min Profil</button>
      </div>

      {/* 1. LEADERBOARD FANE */}
      {activeTab === "leaderboard" && (
        <div>
          {users.sort((a, b) => b.workouts - a.workouts).map(user => {
            const isMe = currentUser.uid === user.id;
            const doneToday = user.lastWorkoutDate === getTodayDate();
            const isExpanded = expandedUserId === user.id;

            return (
              <div key={user.id} style={{ background: theme.card, marginBottom: "12px", borderRadius: "8px", border: isMe ? `1px solid ${theme.accent}` : "1px solid #333", overflow: "hidden" }}>
                <div onClick={() => setExpandedUserId(isExpanded ? null : user.id)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "15px", cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: theme.inputBg, backgroundImage: `url(${user.photoUrl})`, backgroundSize: "cover", backgroundPosition: "center", border: `2px solid ${isMe ? theme.accent : "#555"}` }} />
                    <span style={{ fontSize: "18px", fontWeight: "bold" }}>{user.name}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
                    <span style={{ fontSize: "18px", color: theme.accent, fontWeight: "bold" }}>{user.workouts} 🏋️</span>
                    {isMe && (
                      <button onClick={(e) => { e.stopPropagation(); logWorkout(user); }} disabled={doneToday} style={{ padding: "8px 12px", background: doneToday ? theme.inputBg : theme.accent, color: doneToday ? theme.textSub : "white", border: "none", borderRadius: "6px", fontWeight: "bold" }}>
                        {doneToday ? "Færdig" : "+ Tjek ind"}
                      </button>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ padding: "15px", borderTop: "1px solid #333", background: "#1a1a1a" }}>
                    <p style={{ fontStyle: "italic", color: theme.textSub, marginTop: 0 }}>"{user.bio || 'Ingen bio tilføjet endnu.'}"</p>
                    <h4 style={{ color: theme.accent, marginBottom: "5px" }}>Træningshistorik:</h4>
                    {user.history && user.history.length > 0 ? (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                        {[...user.history].reverse().slice(0, 10).map((date, index) => (
                          <span key={index} style={{ fontSize: "12px", background: theme.inputBg, padding: "4px 8px", borderRadius: "4px", color: theme.textSub }}>{date}</span>
                        ))}
                      </div>
                    ) : (
                      <p style={{ fontSize: "13px", color: theme.textSub }}>Har ikke logget nogle træninger endnu.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 2. MAKS LØFT FANE */}
      {activeTab === "maxlifts" && (
        <div>
          {users.map(user => {
             const isMe = currentUser.uid === user.id;
             return (
              <div key={user.id} style={{ background: theme.card, padding: "15px", marginBottom: "12px", borderRadius: "8px", border: isMe ? `1px solid ${theme.accent}` : "1px solid #333" }}>
                <h3 style={{ margin: "0 0 15px 0", color: isMe ? theme.accent : "white" }}>{user.name}</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div onClick={() => isMe && updateMaxLift(user.id, 'bench', user.maxLifts.bench)} style={{ display: "flex", justifyContent: "space-between", paddingBottom: "5px", borderBottom: "1px solid #333", cursor: isMe ? "pointer" : "default" }}>
                    <span>Bænkpres:</span> <strong style={{ color: theme.accent }}>{user.maxLifts?.bench || 0} kg {isMe && "✏️"}</strong>
                  </div>
                  <div onClick={() => isMe && updateMaxLift(user.id, 'squat', user.maxLifts.squat)} style={{ display: "flex", justifyContent: "space-between", paddingBottom: "5px", borderBottom: "1px solid #333", cursor: isMe ? "pointer" : "default" }}>
                    <span>Squat:</span> <strong style={{ color: theme.accent }}>{user.maxLifts?.squat || 0} kg {isMe && "✏️"}</strong>
                  </div>
                  <div onClick={() => isMe && updateMaxLift(user.id, 'deadlift', user.maxLifts.deadlift)} style={{ display: "flex", justifyContent: "space-between", cursor: isMe ? "pointer" : "default" }}>
                    <span>Dødløft:</span> <strong style={{ color: theme.accent }}>{user.maxLifts?.deadlift || 0} kg {isMe && "✏️"}</strong>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 3. MIN PROFIL FANE */}
      {activeTab === "profile" && (
        <div style={{ background: theme.card, padding: "20px", borderRadius: "8px", border: "1px solid #333" }}>
          <h3 style={{ color: theme.accent, marginTop: 0 }}>Rediger din Dude-profil</h3>
          
          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", marginBottom: "5px", color: theme.textSub, fontSize: "14px" }}>Din Bio:</label>
            <textarea 
              value={myBio} 
              onChange={(e) => setMyBio(e.target.value)} 
              placeholder="Skriv lidt om dig selv..."
              style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "none", background: theme.inputBg, color: theme.textMain, height: "80px", boxSizing: "border-box" }}
            />
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", marginBottom: "10px", color: theme.textSub, fontSize: "14px" }}>Profilbillede:</label>
            
            {/* Viser det nuværende billede, hvis man har et */}
            {myPhoto && <img src={myPhoto} alt="Preview" style={{ display: "block", marginBottom: "10px", width: "100px", height: "100px", borderRadius: "50%", objectFit: "cover", border: `2px solid ${theme.accent}` }} />}
            
            {/* Den nye Upload-knap */}
            <input 
              type="file" 
              accept="image/*"
              onChange={handleImageUpload}
              style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px dashed #555", background: theme.inputBg, color: theme.textMain, boxSizing: "border-box" }}
            />
            {isUploading && <p style={{ color: theme.accent, fontSize: "12px", marginTop: "5px" }}>Uploader billede... ⏳</p>}
          </div>

          <button onClick={saveProfile} style={{ width: "100%", padding: "12px", background: theme.accent, color: "white", border: "none", borderRadius: "6px", fontWeight: "bold", fontSize: "16px", cursor: "pointer" }}>
            Gem Profil
          </button>
        </div>
      )}

    </div>
  );
}
