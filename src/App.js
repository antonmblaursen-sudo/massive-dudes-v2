import React, { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, onSnapshot, doc, setDoc, updateDoc, increment, arrayUnion, arrayRemove } from "firebase/firestore";
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
          bio: "KLAR TIL AT ØDELÆGGE JERN. 🩸",
          photoUrl: "", 
          maxLifts: { bench: 0, squat: 0, deadlift: 0 }
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error) {
      setErrorMsg("FUCK UP: " + error.message);
    }
  };

  const logWorkout = async (user) => {
    const today = getTodayDate();
    if (user.lastWorkoutDate === today) {
      alert("DU HAR ALLEREDE SMADRET JERNET I DAG! RO PÅ, DYR! 🦍");
      return;
    }
    await updateDoc(doc(db, "users", user.id), {
      workouts: increment(1),
      lastWorkoutDate: today,
      history: arrayUnion(today)
    });
  };

  // NY HELL YEAH FORTRYD-FUNKTION
  const undoWorkout = async (user) => {
    const today = getTodayDate();
    if (window.confirm("TRYKKEDE DU FORKERT MED DINE TYKKE PØLSEFINGRE? Vil du slette dagens træning? 💀")) {
      await updateDoc(doc(db, "users", user.id), {
        workouts: increment(-1),
        lastWorkoutDate: null,
        history: arrayRemove(today)
      });
    }
  };

  const updateMaxLift = async (id, liftType, currentWeight) => {
    const newWeight = prompt(`NYT MAKS I ${liftType.toUpperCase()} (KG)? INGEN LØGN, KUN RÅSTYRKE:`, currentWeight);
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
    alert("PROFIL OPDATERET! HELL YEAH! 💥");
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
      alert("FLEX UPLOADET! 📸🦍");
    } catch (error) {
      alert("NOGET GIK GALT! " + error.message);
    }
    setIsUploading(false);
  };

  // --- HELL YEAH CORE THEME ---
  const theme = {
    bg: "#0A0A0A", // Kulsort
    card: "#161616", // Mørkegrå
    accent: "#E50914", // Blodrød
    neon: "#FF3333", // Glødende rød
    textMain: "#FFFFFF",
    textSub: "#888888",
    inputBg: "#222222"
  };

  useEffect(() => {
    document.body.style.backgroundColor = theme.bg;
    document.body.style.color = theme.textMain;
    document.body.style.margin = "0";
    document.body.style.textTransform = "uppercase"; // ALT ER MED STORE BOGSTAVER FORDI VI RÅBER
  }, []);

  if (loading) {
    return (
      <div style={{ textAlign: "center", marginTop: "100px", fontFamily: "impact, sans-serif", color: theme.accent, letterSpacing: "2px" }}>
        <h2 style={{ fontSize: "30px" }}>VARMER OP TIL KRIG... ☢️</h2>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div style={{ fontFamily: "impact, sans-serif", padding: "30px", maxWidth: "400px", margin: "50px auto", background: theme.card, borderRadius: "0px", border: `3px solid ${theme.accent}`, textAlign: "center", boxShadow: `0 0 20px ${theme.accent}40` }}>
        <h1 style={{ color: theme.accent, fontSize: "40px", margin: "0 0 10px 0", textShadow: `0 0 10px ${theme.neon}` }}>MASSIVE DUDES</h1>
        <h2 style={{ color: theme.textMain, fontSize: "20px" }}>{isRegistering ? "BLIV EN DEL AF KULTEN" : "TRÆD IND PÅ SLAGMARKEN"}</h2>
        {errorMsg && <p style={{ color: theme.neon }}>{errorMsg}</p>}
        <form onSubmit={handleAuth} style={{ display: "flex", flexDirection: "column", gap: "15px", marginTop: "20px" }}>
          {isRegistering && <input type="text" placeholder="DIT KAMPNAVN" value={name} onChange={(e) => setName(e.target.value)} required style={{ padding: "15px", border: `1px solid ${theme.accent}`, background: theme.inputBg, color: theme.textMain, fontWeight: "bold" }} />}
          <input type="email" placeholder="EMAIL" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ padding: "15px", border: `1px solid ${theme.accent}`, background: theme.inputBg, color: theme.textMain, fontWeight: "bold" }} />
          <input type="password" placeholder="KODEORD" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ padding: "15px", border: `1px solid ${theme.accent}`, background: theme.inputBg, color: theme.textMain, fontWeight: "bold" }} />
          <button type="submit" style={{ padding: "15px", background: theme.accent, color: "white", border: "none", fontWeight: "bold", fontSize: "20px", cursor: "pointer", letterSpacing: "2px" }}>{isRegistering ? "OPRET MIG 🩸" : "LOG IND 💥"}</button>
        </form>
        <p onClick={() => setIsRegistering(!isRegistering)} style={{ color: theme.textSub, cursor: "pointer", marginTop: "20px", fontSize: "14px", fontWeight: "bold" }}>
          {isRegistering ? "ALLEREDE MEDLEM? LOG IND HER" : "IKKE MED I KULTEN? OPRET DIG"}
        </p>
      </div>
    );
  }

  const currentUserData = users.find(u => u.id === currentUser.uid) || {};

  return (
    <div style={{ fontFamily: "impact, sans-serif", padding: "20px", maxWidth: "500px", margin: "0 auto", color: theme.textMain }}>
      
      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `4px solid ${theme.accent}`, paddingBottom: "10px", marginBottom: "20px" }}>
        <h2 style={{ color: theme.accent, margin: 0, fontSize: "28px", textShadow: `0 0 8px ${theme.neon}` }}>MASSIVE DUDES ☢️</h2>
        <button onClick={() => signOut(auth)} style={{ padding: "10px 15px", background: theme.bg, color: theme.accent, border: `2px solid ${theme.accent}`, fontWeight: "bold", cursor: "pointer" }}>FLYGT (LOG UD)</button>
      </div>
      
      {/* MENU NAVIGATION */}
      <div style={{ display: "flex", gap: "5px", marginBottom: "20px", fontFamily: "sans-serif" }}>
        <button onClick={() => setActiveTab("leaderboard")} style={{ flex: 1, padding: "12px 5px", border: "none", backgroundColor: activeTab === "leaderboard" ? theme.accent : theme.card, color: activeTab === "leaderboard" ? "white" : theme.textSub, fontWeight: "bold", fontSize: "16px" }}>DOMINANS</button>
        <button onClick={() => setActiveTab("maxlifts")} style={{ flex: 1, padding: "12px 5px", border: "none", backgroundColor: activeTab === "maxlifts" ? theme.accent : theme.card, color: activeTab === "maxlifts" ? "white" : theme.textSub, fontWeight: "bold", fontSize: "16px" }}>RÅSTYRKE</button>
        <button onClick={() => { setActiveTab("profile"); setMyBio(currentUserData.bio || ""); setMyPhoto(currentUserData.photoUrl || ""); }} style={{ flex: 1, padding: "12px 5px", border: "none", backgroundColor: activeTab === "profile" ? theme.accent : theme.card, color: activeTab === "profile" ? "white" : theme.textSub, fontWeight: "bold", fontSize: "16px" }}>EGO</button>
      </div>

      {/* 1. LEADERBOARD FANE */}
      {activeTab === "leaderboard" && (
        <div style={{ fontFamily: "sans-serif" }}>
          {users.sort((a, b) => b.workouts - a.workouts).map(user => {
            const isMe = currentUser.uid === user.id;
            const doneToday = user.lastWorkoutDate === getTodayDate();
            const isExpanded = expandedUserId === user.id;

            return (
              <div key={user.id} style={{ background: theme.card, marginBottom: "12px", border: isMe ? `2px solid ${theme.accent}` : "2px solid #222", overflow: "hidden" }}>
                <div onClick={() => setExpandedUserId(isExpanded ? null : user.id)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "15px", cursor: "pointer", background: isMe ? "rgba(229, 9, 20, 0.1)" : theme.card }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ width: "45px", height: "45px", background: theme.inputBg, backgroundImage: `url(${user.photoUrl})`, backgroundSize: "cover", backgroundPosition: "center", border: `2px solid ${isMe ? theme.accent : "#444"}`, borderRadius: "0" }} />
                    <span style={{ fontSize: "20px", fontWeight: "900", color: isMe ? theme.accent : "white", fontFamily: "impact" }}>{user.name}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "24px", color: theme.accent, fontWeight: "bold", fontFamily: "impact" }}>{user.workouts} 🩸</span>
                    {isMe && !doneToday && (
                      <button onClick={(e) => { e.stopPropagation(); logWorkout(user); }} style={{ padding: "10px 15px", background: theme.accent, color: "white", border: "none", fontWeight: "bold", cursor: "pointer", boxShadow: `0 0 10px ${theme.accent}` }}>
                        FUCKING TJEK IND
                      </button>
                    )}
                    {isMe && doneToday && (
                      <button onClick={(e) => { e.stopPropagation(); undoWorkout(user); }} style={{ padding: "10px", background: "transparent", color: theme.textSub, border: "1px solid #555", fontWeight: "bold", cursor: "pointer" }} title="Slet Dagens Træning">
                        💀 UNDO
                      </button>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ padding: "15px", borderTop: "2px solid #222", background: "#0f0f0f" }}>
                    <p style={{ fontStyle: "italic", color: theme.textSub, marginTop: 0, fontWeight: "bold" }}>"{user.bio || 'INGEN BIO. BARE GRIND.'}"</p>
                    <h4 style={{ color: theme.accent, marginBottom: "10px", fontFamily: "impact", fontSize: "18px" }}>KAMP HISTORIK:</h4>
                    {user.history && user.history.length > 0 ? (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                        {[...user.history].reverse().slice(0, 10).map((date, index) => (
                          <span key={index} style={{ fontSize: "12px", background: theme.bg, border: `1px solid ${theme.accent}`, padding: "5px 8px", color: theme.neon, fontWeight: "bold" }}>{date}</span>
                        ))}
                      </div>
                    ) : (
                      <p style={{ fontSize: "13px", color: theme.textSub, fontWeight: "bold" }}>HAR ALDRIG RØRT ET VÆGTSTANG.</p>
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
        <div style={{ fontFamily: "sans-serif" }}>
          {users.map(user => {
             const isMe = currentUser.uid === user.id;
             return (
              <div key={user.id} style={{ background: theme.card, padding: "20px", marginBottom: "15px", border: isMe ? `2px solid ${theme.accent}` : "2px solid #222" }}>
                <h3 style={{ margin: "0 0 15px 0", color: isMe ? theme.accent : "white", fontFamily: "impact", fontSize: "24px" }}>{user.name}</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontWeight: "bold", fontSize: "18px" }}>
                  <div onClick={() => isMe && updateMaxLift(user.id, 'bench', user.maxLifts.bench)} style={{ display: "flex", justifyContent: "space-between", paddingBottom: "10px", borderBottom: "1px solid #333", cursor: isMe ? "pointer" : "default" }}>
                    <span>BÆNKPRES:</span> <strong style={{ color: theme.neon }}>{user.maxLifts?.bench || 0} KG {isMe && "🛠️"}</strong>
                  </div>
                  <div onClick={() => isMe && updateMaxLift(user.id, 'squat', user.maxLifts.squat)} style={{ display: "flex", justifyContent: "space-between", paddingBottom: "10px", borderBottom: "1px solid #333", cursor: isMe ? "pointer" : "default" }}>
                    <span>SQUAT:</span> <strong style={{ color: theme.neon }}>{user.maxLifts?.squat || 0} KG {isMe && "🛠️"}</strong>
                  </div>
                  <div onClick={() => isMe && updateMaxLift(user.id, 'deadlift', user.maxLifts.deadlift)} style={{ display: "flex", justifyContent: "space-between", cursor: isMe ? "pointer" : "default" }}>
                    <span>DØDLØFT:</span> <strong style={{ color: theme.neon }}>{user.maxLifts?.deadlift || 0} KG {isMe && "🛠️"}</strong>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 3. MIN PROFIL FANE */}
      {activeTab === "profile" && (
        <div style={{ background: theme.card, padding: "20px", border: `2px solid ${theme.accent}` }}>
          <h3 style={{ color: theme.accent, marginTop: 0, fontFamily: "impact", fontSize: "24px" }}>DIT EGO TRIP</h3>
          
          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", marginBottom: "5px", color: theme.neon, fontSize: "16px", fontWeight: "bold", fontFamily: "impact" }}>DIN KAMP-BIO:</label>
            <textarea 
              value={myBio} 
              onChange={(e) => setMyBio(e.target.value)} 
              placeholder="SKRIV NOGET BRUTALT HER..."
              style={{ width: "100%", padding: "15px", border: `1px solid ${theme.accent}`, background: theme.bg, color: theme.textMain, height: "100px", boxSizing: "border-box", fontWeight: "bold" }}
            />
          </div>

          <div style={{ marginBottom: "25px" }}>
            <label style={{ display: "block", marginBottom: "10px", color: theme.neon, fontSize: "16px", fontWeight: "bold", fontFamily: "impact" }}>UPLOAD FLEX BILLEDE:</label>
            
            {myPhoto && <img src={myPhoto} alt="Preview" style={{ display: "block", marginBottom: "15px", width: "120px", height: "120px", objectFit: "cover", border: `4px solid ${theme.accent}` }} />}
            
            <input 
              type="file" 
              accept="image/*"
              onChange={handleImageUpload}
              style={{ width: "100%", padding: "15px", border: `2px dashed ${theme.accent}`, background: theme.bg, color: theme.textMain, boxSizing: "border-box", fontWeight: "bold", cursor: "pointer" }}
            />
            {isUploading && <p style={{ color: theme.neon, fontSize: "14px", marginTop: "10px", fontWeight: "bold" }}>UPLOADER... HOLD VÆGTEN! ⏳</p>}
          </div>

          <button onClick={saveProfile} style={{ width: "100%", padding: "15px", background: theme.accent, color: "white", border: "none", fontWeight: "bold", fontSize: "20px", cursor: "pointer", fontFamily: "impact", letterSpacing: "1px", boxShadow: `0 0 15px ${theme.accent}60` }}>
            GEM LORTET 💥
          </button>
        </div>
      )}

    </div>
  );
}
