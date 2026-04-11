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

  const getStatsForMonth = (history = []) => {
    let gym = 0, cardioKm = 0, cardioRuns = 0;
    history.forEach(h => {
      const d = typeof h === 'string' ? h : h.date;
      if (d.startsWith(currentMonthStr)) {
        if (typeof h === 'string' || h.type === 'gym') gym++;
        else if (h.type === 'cardio') { cardioRuns++; if (h.value) cardioKm += Number(h.value); }
      }
    });
    return { gym, cardioKm: parseFloat(cardioKm.toFixed(1)), totalActivities: gym + cardioRuns };
  };

  // --- 🔥 COUNTER-STRIKE RANK SYSTEM UDEN EMOJIS 🔥 ---
  const getRankInfo = (history = []) => {
    const totalXP = history.length;
    if (totalXP >= 100) return { title: "GLOBAL ELITE", color: "#ef4444" }; // Rød
    if (totalXP >= 50) return { title: "LEGENDARY EAGLE", color: "#c084fc" }; // Lilla
    if (totalXP >= 25) return { title: "MASTER GUARDIAN", color: "#60a5fa" }; // Blå
    if (totalXP >= 10) return { title: "GOLD NOVA", color: "#FBBF24" }; // Guld
    return { title: "SILVER", color: "#9CA3AF" }; // Grå
  };

  const getLastMonthWinner = () => {
    if (!users.length) return null;
    let winner = null, maxScore = 0;
    users.forEach(u => {
      let prevMonthActs = 0;
      (u.history || []).forEach(h => {
        const d = typeof h === 'string' ? h : h.date;
        if (d.startsWith(prevMonthStr)) prevMonthActs++;
      });
      if (prevMonthActs > maxScore && prevMonthActs > 0) { maxScore = prevMonthActs; winner = u.id; }
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
          name: name, workouts: 0, lastWorkoutDate: null, history: [], bio: "Rush B, don't stop.", photoUrl: "", arc: "Vinter Arc ❄️", maxLifts: { bench: 0, squat: 0, deadlift: 0 }
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
              }} style={{ flex: 1, padding: "10px 0", borderRadius: "8px", border: "none", backgroundColor: activeTab === t ? theme.accent : "transparent", color: activeTab === t ? "#000" : theme.textSub, fontWeight: "bold", fontSize: "11px", cursor: "pointer", textTransform: "capitalize" }}>
              {t === "leaderboard" ? "Sæson" : t === "feed" ? "Flex" : t}
            </button>
          ))}
        </div>

        {activeTab === "leaderboard" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
              <h3 style={{ margin: 0, fontSize: "16px", textTransform: "uppercase", color: theme.textSub }}>SÆSON: {currentMonthName}</h3>
            </div>
            {users.map(u => ({ ...u, currentMonthStats: getStatsForMonth(u.history) })).sort((a, b) => b.currentMonthStats.totalActivities - a.currentMonthStats.totalActivities).map((user, index) => {
              const isMe = currentUser.uid === user.id;
              const streak = calculateStreak(user.history);
              const rank = getRankInfo(user.history);

              return (
                <div key={user.id} style={{ background: theme.card, marginBottom: "10px", borderRadius: "12px", border: isMe ? `1px solid ${theme.accent}` : "1px solid #333", overflow: "hidden" }}>
                  <div onClick={() => setExpandedUserId(expandedUserId === user.id ? null : user.id)} style={{ padding: "15px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div style={{ fontWeight: "bold", fontSize: "18px", color: index === 0 ? theme.accent : theme.textSub, width: "15px" }}>{index + 1}</div>
                      <img src={user.photoUrl} alt="" style={{ width: "40px", height: "40px", borderRadius: "50%", background: "#444", objectFit: "cover" }} />
                      <div>
                        <div style={{ fontWeight: "bold", fontSize: "15px", display: "flex", alignItems: "center", flexWrap: "wrap", gap: "4px" }}>
                          {user.name} {user.id === lastMonthWinnerId && "🏆"}
                          <span style={{ background: rank.color + "20", color: rank.color, padding: "2px 6px", borderRadius: "4px", fontSize: "9px", textTransform: "uppercase", fontWeight: "900", letterSpacing: "0.5px" }}>
                            {rank.title}
                          </span>
                        </div>
                        <div style={{ fontSize: "11px", color: theme.accent, marginTop: "2px" }}>{user.arc || "Vinter Arc ❄️"} | {streak} streak 🔥</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontWeight: "bold", fontSize: "14px" }}>{user.currentMonthStats.gym} 🏋️</div>
                        <div style={{ fontSize: "11px", color: "#60a5fa" }}>{user.currentMonthStats.cardioKm} km 🏃‍♂️</div>
                      </div>
                      {isMe && <button onClick={(e) => { e.stopPropagation(); setShowLogModal(true); }} style={{ padding: "8px 12px", borderRadius: "8px", background: theme.accent, color: "#000", border: "none", fontSize: "12px", fontWeight: "bold", cursor: "pointer" }}>+ Log</button>}
                    </div>
                  </div>
                  {expandedUserId === user.id && (
                    <div style={{ padding: "15px", background: "#151515", borderTop: "1px solid #333", fontSize: "13px" }}>
                      <p style={{ color: theme.textSub, margin: "0 0 10px 0", fontStyle: "italic" }}>"{user.bio}"</p>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <div style={{ fontWeight: "bold", color: theme.accent, marginBottom: "5px" }}>Seneste logs:</div>
                        {(isMe || isAdmin) && user.history.length > 0 && <button onClick={() => undoWorkout(user)} style={{ color: "#ef4444", border: "none", background: "none", fontSize: "11px", cursor: "pointer" }}>Slet log 💀</button>}
                      </div>
                      {[...user.history].reverse().slice(0, 5).map((h, i) => (
                        <div key={i} style={{ marginBottom: "4px", fontSize: "12px", display: "flex", justifyContent: "space-between" }}>
                          <span>{h.type === "gym" ? "🏋️" : "🏃‍♂️"} {h.title} {h.value && `(${h.value} km)`}</span>
                          <span style={{color: theme.textSub}}>{h.date}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {activeTab === "feed" && (
          <div>
            <div style={{ background: theme.card, padding: "15px", borderRadius: "12px", marginBottom: "20px", border: `1px solid ${theme.border}` }}>
              <h3 style={{ marginTop: 0, fontSize: "16px", color: theme.textMain }}>Upload et Flex</h3>
              <form onSubmit={submitPost}>
                <textarea value={postText} onChange={(e) => setPostText(e.target.value)} placeholder="Skriv noget blæret..." style={{ width: "100%", height: "60px", background: theme.inputBg, color: "white", border: "none", borderRadius: "8px", padding: "10px", boxSizing: "border-box", marginBottom: "10px" }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <input type="file" accept="image/*" onChange={(e) => setPostFile(e.target.files[0])} style={{ color: theme.textSub, fontSize: "12px", width: "60%" }} />
                  <button type="submit" disabled={isPosting} style={{ padding: "10px 15px", background: isPosting ? "#555" : theme.accent, color: isPosting ? "#ccc" : "#000", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: isPosting ? "default" : "pointer" }}>
                    {isPosting ? "Uploader..." : "Post Flex 📸"}
                  </button>
                </div>
              </form>
            </div>

            {feed.map(post => {
              const hasLiked = post.likes && post.likes.includes(currentUser.uid);
              const likeCount = post.likes ? post.likes.length : 0;
              const isOwner = currentUser.uid === post.userId;
              
              return (
                <div key={post.id} style={{ background: theme.card, borderRadius: "12px", marginBottom: "20px", overflow: "hidden", border: `1px solid ${theme.border}` }}>
                  <div style={{ padding: "12px", display: "flex", alignItems: "center", gap: "10px" }}>
                    <img src={post.userPhoto || "https://via.placeholder.com/40"} alt="" style={{ width: "36px", height: "36px", borderRadius: "50%", objectFit: "cover" }} />
                    <div>
                      <div style={{ fontWeight: "bold", fontSize: "14px" }}>{post.userName}</div>
                      <div style={{ fontSize: "11px", color: theme.textSub }}>{post.createdAt ? new Date(post.createdAt.toDate()).toLocaleString([], {hour: '2-digit', minute:'2-digit', day: '2-digit', month: 'short'}) : "Lige nu"}</div>
                    </div>
                  </div>
                  <img src={post.imageUrl} alt="Flex" style={{ width: "100%", maxHeight: "400px", objectFit: "cover", display: "block" }} />
                  <div style={{ padding: "15px" }}>
                    {post.text && <p style={{ margin: "0 0 15px 0", fontSize: "14px", lineHeight: "1.4" }}>{post.text}</p>}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <button onClick={() => toggleLike(post.id, post.likes || [])} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px", background: hasLiked ? "rgba(245, 158, 11, 0.2)" : theme.inputBg, border: hasLiked ? `1px solid ${theme.accent}` : "none", borderRadius: "20px", cursor: "pointer", color: hasLiked ? theme.accent : "white", fontWeight: "bold", transition: "0.2s" }}>
                        <span style={{ fontSize: "16px" }}>🔥</span> {likeCount} Hype
                      </button>
                      {(isOwner || isAdmin) && (
                        <button onClick={() => deletePost(post.id)} style={{ background: "none", border: "none", color: "#ef4444", fontSize: "12px", cursor: "pointer" }}>Slet</button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === "stats" && (
          <div>
            {users.map(user => {
              const allTimeCardio = user.history.reduce((sum, h) => (h.type === "cardio" && h.value) ? sum + Number(h.value) : sum, 0);
              const allTimeGym = user.history.filter(h => typeof h === 'string' || h.type === 'gym').length;
              const canEdit = currentUser.uid === user.id || isAdmin;
              const rank = getRankInfo(user.history);
              
              return (
                <div key={user.id} style={{ background: theme.card, padding: "20px", marginBottom: "10px", borderRadius: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <h3 style={{ margin: 0 }}>{user.name}</h3>
                      <span style={{ background: rank.color + "20", color: rank.color, padding: "2px 6px", borderRadius: "4px", fontSize: "10px", textTransform: "uppercase", fontWeight: "bold" }}>
                        {rank.title}
                      </span>
                    </div>
                    {user.id === lastMonthWinnerId && <span style={{fontSize: "20px"}}>🏆</span>}
                  </div>
                  <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
                    <div style={{ flex: 1, background: theme.inputBg, padding: "10px", borderRadius: "8px", textAlign: "center" }}>
                      <div style={{ fontSize: "11px", color: theme.textSub }}>TOTALE LØFT</div>
                      <div style={{ fontSize: "18px", fontWeight: "bold", color: theme.textMain }}>{allTimeGym}</div>
                    </div>
                    <div style={{ flex: 1, background: theme.inputBg, padding: "10px", borderRadius: "8px", textAlign: "center" }}>
                      <div style={{ fontSize: "11px", color: theme.textSub }}>TOTALE KM</div>
                      <div style={{ fontSize: "18px", fontWeight: "bold", color: "#60a5fa" }}>{allTimeCardio > 0 ? parseFloat(allTimeCardio.toFixed(1)) : 0}</div>
                    </div>
                  </div>
                  <div style={{ marginBottom: "15px" }}>
                    <div style={{ fontSize: "12px", color: theme.accent, fontWeight: "bold", marginBottom: "5px" }}>STYRKE (MAKS)</div>
                    {["bench", "squat", "deadlift"].map(lift => (
                      <div key={lift} onClick={() => canEdit && updateMax(user.id, lift, user.maxLifts[lift], user.name)} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #333", cursor: canEdit ? "pointer" : "default" }}>
                        <span style={{textTransform: "capitalize"}}>{lift}:</span> <strong>{user.maxLifts[lift]} kg</strong>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === "chat" && (
          <div style={{ height: "60vh", background: theme.card, borderRadius: "12px", display: "flex", flexDirection: "column" }}>
            <div style={{ flex: 1, overflowY: "auto", padding: "15px" }}>
              {messages.map(m => (
                <div key={m.id} style={{ alignSelf: m.userId === currentUser.uid ? "flex-end" : "flex-start", background: m.userId === currentUser.uid ? theme.accent : "#333", color: m.userId === currentUser.uid ? "#000" : "white", padding: "8px 12px", borderRadius: "10px", marginBottom: "10px", maxWidth: "80%" }}>
                  <div style={{ fontSize: "10px", opacity: 0.7 }}>{m.userName}</div>
                  <div>{m.text}</div>
                </div>
              ))}
            </div>
            <form onSubmit={sendChatMessage} style={{ display: "flex", padding: "10px", gap: "5px" }}>
              <input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Trash talk..." style={{ flex: 1, padding: "10px", borderRadius: "8px", background: theme.inputBg, color: "white", border: "none" }} />
              <button type="submit" style={{ padding: "10px 15px", background: theme.accent, border: "none", borderRadius: "8px", fontWeight: "bold", color: "#000", cursor: "pointer" }}>Send</button>
            </form>
          </div>
        )}

        {showLogModal && (
          <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.8)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 100 }}>
            <div style={{ background: theme.card, padding: "25px", borderRadius: "16px", width: "280px", textAlign: "center" }}>
              <h3 style={{ marginTop: 0 }}>Hvad har du lavet?</h3>
              <button onClick={() => logActivity("gym")} style={{ width: "100%", padding: "12px", background: theme.accent, border: "none", borderRadius: "8px", fontWeight: "bold", marginBottom: "10px", color: "#000", cursor: "pointer" }}>🏋️ Styrketræning</button>
              <button onClick={() => logActivity("cardio")} style={{ width: "100%", padding: "12px", background: "#3b82f6", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold", marginBottom: "15px", cursor: "pointer" }}>🏃‍♂️ Cardio / Løb</button>
              <button onClick={() => setShowLogModal(false)} style={{ color: theme.textSub, background: "none", border: "none", cursor: "pointer" }}>Annuller</button>
            </div>
          </div>
        )}

        {activeTab === "profile" && (
          <div style={{ background: theme.card, padding: "20px", borderRadius: "12px" }}>
            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", fontSize: "12px", color: theme.textSub, marginBottom: "5px" }}>Nuværende Arc</label>
              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={() => setMyArc("Vinter Arc ❄️")} style={{ flex: 1, padding: "10px", borderRadius: "8px", border: myArc === "Vinter Arc ❄️" ? `2px solid ${theme.accent}` : "2px solid transparent", background: theme.inputBg, color: "white", cursor: "pointer" }}>Vinter ❄️</button>
                <button onClick={() => setMyArc("Sommer Arc ☀️")} style={{ flex: 1, padding: "10px", borderRadius: "8px", border: myArc === "Sommer Arc ☀️" ? `2px solid ${theme.accent}` : "2px solid transparent", background: theme.inputBg, color: "white", cursor: "pointer" }}>Sommer ☀️</button>
              </div>
            </div>
            <label style={{ display: "block", fontSize: "12px", color: theme.textSub, marginBottom: "5px" }}>Din Bio</label>
            <textarea value={myBio} onChange={(e) => setMyBio(e.target.value)} style={{ width: "100%", height: "60px", background: theme.inputBg, color: "white", border: "none", borderRadius: "8px", padding: "10px", boxSizing: "border-box" }} />
            <label style={{ display: "block", fontSize: "12px", color: theme.textSub, marginTop: "15px", marginBottom: "5px" }}>Profilbillede</label>
            <input type="file" onChange={handleImageUpload} style={{ marginTop: "5px" }} />
            <button onClick={async () => { await updateDoc(doc(db, "users", currentUser.uid), { bio: myBio, arc: myArc }); alert("Gemt!"); }} style={{ width: "100%", padding: "12px", background: theme.accent, color: "#000", border: "none", borderRadius: "8px", marginTop: "25px", fontWeight: "bold", cursor: "pointer" }}>Gem Profil</button>
            <button onClick={() => signOut(auth)} style={{ width: "100%", background: "none", color: "#ef4444", border: "1px solid #ef4444", padding: "10px", borderRadius: "8px", marginTop: "10px", cursor: "pointer" }}>Log ud</button>
          </div>
        )}

      </div>
    </div>
  );
}
