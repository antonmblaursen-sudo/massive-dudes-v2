import React, { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  increment,
  arrayUnion,
  arrayRemove,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
  deleteDoc,
} from "firebase/firestore";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

// --- 👑 ADMIN & STRAVA INDSTILLINGER ---
const ADMIN_EMAIL = "antonmblaursen@gmail.com";

const STRAVA_CLIENT_ID = "256210";
const STRAVA_CLIENT_SECRET = "3253dcc72e09c9cf03c2a285dca5ea6afe507d2a";

const firebaseConfig = {
  apiKey: "AIzaSyAi-l2FOylk76ZKU-1CyVtt2HdIavf4w5g",
  authDomain: "massive-brutale-dudes.firebaseapp.com",
  projectId: "massive-brutale-dudes",
  storageBucket: "massive-brutale-dudes.firebasestorage.app",
  messagingSenderId: "45686943799",
  appId: "1:45686943799:web:95628cd0039d908ec40fb2",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

export default function App() {
  const [activeTab, setActiveTab] = useState("feed");
  const [users, setUsers] = useState([]);
  const [feed, setFeed] = useState([]);
  const [recipes, setRecipes] = useState([]);

  const [weather, setWeather] = useState(null);
  const [expandedUserId, setExpandedUserId] = useState(null);
  const [showLogModal, setShowLogModal] = useState(false);

  const [postText, setPostText] = useState("");
  const [postFile, setPostFile] = useState(null);
  const [isPosting, setIsPosting] = useState(false);

  const [recipeTitle, setRecipeTitle] = useState("");
  const [recipeText, setRecipeText] = useState("");
  const [recipeFile, setRecipeFile] = useState(null);
  const [isPostingRecipe, setIsPostingRecipe] = useState(false);

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

  const isAdmin = currentUser && currentUser.email === ADMIN_EMAIL;
  const theme = {
    bg: "#121212",
    card: "#1E1E1E",
    accent: "#F59E0B",
    textMain: "#F3F4F6",
    textSub: "#9CA3AF",
    inputBg: "#374151",
    border: "#333333",
  };
  const mainStyle = {
    minHeight: "100vh",
    backgroundColor: theme.bg,
    color: theme.textMain,
    fontFamily: "sans-serif",
    paddingBottom: "80px",
  };

  useEffect(() => {
    fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=55.6761&longitude=12.5683&current_weather=true"
    )
      .then((res) => res.json())
      .then((data) => setWeather(data.current_weather));
  }, []);

  useEffect(() => {
    onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });

    onSnapshot(collection(db, "users"), (snapshot) => {
      setUsers(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });

    const qFeed = query(
      collection(db, "feed"),
      orderBy("createdAt", "desc"),
      limit(40)
    );
    onSnapshot(qFeed, (snapshot) =>
      setFeed(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })))
    );

    const qRecipes = query(
      collection(db, "recipes"),
      orderBy("createdAt", "desc")
    );
    onSnapshot(qRecipes, (snapshot) =>
      setRecipes(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })))
    );

    document.body.style.backgroundColor = theme.bg;
    document.body.style.margin = "0";
  }, []);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    if (code && currentUser) {
      fetch("https://www.strava.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: STRAVA_CLIENT_ID,
          client_secret: STRAVA_CLIENT_SECRET,
          code: code,
          grant_type: "authorization_code",
        }),
      })
        .then((res) => res.json())
        .then(async (data) => {
          if (data.access_token) {
            await updateDoc(doc(db, "users", currentUser.uid), {
              stravaTokens: {
                accessToken: data.access_token,
                refreshToken: data.refresh_token,
                expiresAt: data.expires_at,
              },
            });
            alert("Strava er forbundet! 🏃‍♂️🔥");
            window.history.replaceState(
              {},
              document.title,
              window.location.pathname
            );
          }
        });
    }
  }, [currentUser]);

  const connectStrava = () => {
    const redirectUri = window.location.origin;
    window.location.href = `https://www.strava.com/oauth/authorize?client_id=${STRAVA_CLIENT_ID}&response_type=code&redirect_uri=${redirectUri}&approval_prompt=force&scope=activity:read_all`;
  };

  const fetchStravaActivity = async () => {
    const userData = users.find((u) => u.id === currentUser.uid);
    if (!userData?.stravaTokens)
      return alert("Gå ind på 'Profil' og forbind Strava først! 🟠");

    setShowLogModal(false);
    let token = userData.stravaTokens.accessToken;

    if (Date.now() / 1000 > userData.stravaTokens.expiresAt) {
      const refreshRes = await fetch("https://www.strava.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: STRAVA_CLIENT_ID,
          client_secret: STRAVA_CLIENT_SECRET,
          refresh_token: userData.stravaTokens.refreshToken,
          grant_type: "refresh_token",
        }),
      }).then((r) => r.json());
      token = refreshRes.access_token;
      await updateDoc(doc(db, "users", currentUser.uid), {
        "stravaTokens.accessToken": token,
        "stravaTokens.refreshToken": refreshRes.refresh_token,
        "stravaTokens.expiresAt": refreshRes.expires_at,
      });
    }

    try {
      const res = await fetch(
        "https://www.strava.com/api/v3/athlete/activities?per_page=5",
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();

      if (data && data.length > 0) {
        let addedCount = 0;
        const userHistory = userData.history || [];

        for (const act of data) {
          const distanceKm = (act.distance / 1000).toFixed(2);
          const title = act.name;
          const actDate = act.start_date_local.split("T")[0];
          const stravaId = act.id.toString();

          const alreadyLogged = userHistory.some(
            (h) => h.stravaId === stravaId
          );

          if (!alreadyLogged && act.distance > 0) {
            // --- BEREGN STATS TIL FEED KORTET ---
            const hrs = Math.floor(act.moving_time / 3600);
            const mins = Math.floor((act.moving_time % 3600) / 60)
              .toString()
              .padStart(2, "0");
            const secs = (act.moving_time % 60).toString().padStart(2, "0");
            const timeStr = hrs > 0 ? `${hrs}t ${mins}m` : `${mins}m ${secs}s`;

            let paceStr = "0:00";
            if (act.average_speed > 0) {
              const paceDecimal = 16.6667 / act.average_speed;
              const paceMin = Math.floor(paceDecimal);
              const paceSec = Math.floor((paceDecimal - paceMin) * 60)
                .toString()
                .padStart(2, "0");
              paceStr = `${paceMin}:${paceSec}`;
            }

            const elevation = act.total_elevation_gain || 0;

            const activityObj = {
              date: actDate,
              type: "cardio",
              title: `🟠 ${title}`,
              value: Number(distanceKm),
              stravaId: stravaId,
            };

            await updateDoc(doc(db, "users", currentUser.uid), {
              lastWorkoutDate: actDate,
              history: arrayUnion(activityObj),
            });

            await addDoc(collection(db, "feed"), {
              userId: currentUser.uid,
              userName: userData.name,
              userPhoto: userData.photoUrl || "",
              text: title,
              imageUrl: "", // Intet standardbillede længere!
              likes: [],
              createdAt: serverTimestamp(),
              isStrava: true,
              stravaStats: {
                distance: distanceKm,
                time: timeStr,
                pace: paceStr,
                elevation: elevation,
              },
            });
            addedCount++;
          }
        }

        if (addedCount > 0) {
          alert(
            `SUCCES! Sugede ${addedCount} nye Strava-ture ind på feedet! 🦍💨`
          );
        } else {
          alert(
            "Ingen nye ture fundet. Du har allerede logget dine seneste ture. Ud og sved igen! 🏃‍♂️"
          );
        }
      } else {
        alert("Fandt slet ingen aktiviteter på din Strava.");
      }
    } catch (e) {
      alert(
        "Fejl ved hentning fra Strava. Prøv at genforbinde under din Profil."
      );
    }
  };

  const getTodayDate = () => new Date().toISOString().split("T")[0];
  const currentMonthStr = getTodayDate().substring(0, 7);
  const monthNames = [
    "Januar",
    "Februar",
    "Marts",
    "April",
    "Maj",
    "Juni",
    "Juli",
    "August",
    "September",
    "Oktober",
    "November",
    "December",
  ];
  const currentMonthName = monthNames[new Date().getMonth()];

  const getStatsForMonth = (history = []) => {
    let gym = 0,
      cardioKm = 0,
      cardioRuns = 0;
    history.forEach((h) => {
      const d = typeof h === "string" ? h : h.date;
      if (d.startsWith(currentMonthStr)) {
        if (typeof h === "string" || h.type === "gym") gym++;
        else if (h.type === "cardio") {
          cardioRuns++;
          if (h.value) cardioKm += Number(h.value);
        }
      }
    });
    return {
      gym,
      cardioKm: parseFloat(cardioKm.toFixed(1)),
      totalActivities: gym + cardioRuns,
    };
  };

  const getRankInfo = (history = []) => {
    const totalXP = history.length;
    if (totalXP >= 100) return { title: "GLOBAL ELITE", color: "#ef4444" };
    if (totalXP >= 50) return { title: "LEGENDARY EAGLE", color: "#c084fc" };
    if (totalXP >= 25) return { title: "MASTER GUARDIAN", color: "#60a5fa" };
    if (totalXP >= 10) return { title: "GOLD NOVA", color: "#FBBF24" };
    return { title: "SILVER", color: "#9CA3AF" };
  };

  const calculateStreak = (history = []) => {
    if (!history.length) return 0;
    const datesOnly = history.map((h) => (typeof h === "string" ? h : h.date));
    const sortedDates = [...new Set(datesOnly)].sort(
      (a, b) => new Date(b) - new Date(a)
    );
    let streak = 0;
    let checkDate = new Date();
    if (sortedDates[0] !== getTodayDate())
      checkDate.setDate(checkDate.getDate() - 1);
    for (let i = 0; i < sortedDates.length; i++) {
      const dString = checkDate.toISOString().split("T")[0];
      if (sortedDates.includes(dString)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else break;
    }
    return streak;
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    try {
      if (isRegistering) {
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );
        await setDoc(doc(db, "users", userCredential.user.uid), {
          name: name,
          workouts: 0,
          lastWorkoutDate: null,
          history: [],
          bio: "Rush B, don't stop.",
          photoUrl: "",
          arc: "Vinter Arc ❄️",
          maxLifts: { bench: 0, squat: 0, deadlift: 0 },
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error) {
      setErrorMsg("Fejl: " + error.message);
    }
  };

  const logActivity = async (type) => {
    const today = getTodayDate();
    let title = "",
      distance = "";
    if (type === "gym") {
      title = prompt("Hvad har du trænet?");
      if (title === null) return;
    } else {
      distance = prompt("Hvor mange km?");
      if (distance === null) return;
      title = prompt("Beskrivelse (f.eks. Løbetur)");
    }
    const activityObj = {
      date: today,
      type: type,
      title: title || (type === "gym" ? "Styrke" : "Cardio"),
      value: distance ? Number(distance.replace(",", ".")) : null,
    };
    const updateData = {
      lastWorkoutDate: today,
      history: arrayUnion(activityObj),
    };
    if (type === "gym") updateData.workouts = increment(1);
    await updateDoc(doc(db, "users", currentUser.uid), updateData);

    const userData = users.find((u) => u.id === currentUser.uid);
    const feedText =
      type === "gym"
        ? `Har lige trænet: ${title} 🏋️🔥`
        : `Har lige løbet ${distance} km! 🏃‍♂️💨\n"${title}"`;
    await addDoc(collection(db, "feed"), {
      userId: currentUser.uid,
      userName: userData.name,
      userPhoto: userData.photoUrl || "",
      text: feedText,
      imageUrl: "",
      likes: [],
      createdAt: serverTimestamp(),
      isActivityLog: true,
    });

    setShowLogModal(false);
  };

  const undoWorkout = async (user) => {
    if (window.confirm(`Slet seneste log for ${user.name}?`)) {
      const lastEntry = user.history[user.history.length - 1];
      const isGym = lastEntry.type === "gym" || typeof lastEntry === "string";
      await updateDoc(doc(db, "users", user.id), {
        workouts: isGym ? increment(-1) : increment(0),
        history: arrayRemove(lastEntry),
      });
    }
  };

  const submitPost = async (e) => {
    e.preventDefault();
    if (!postFile && !postText)
      return alert("Skriv noget eller upload et billede! 📸");
    setIsPosting(true);
    try {
      let url = "";
      if (postFile) {
        const imgRef = ref(storage, `feed/${currentUser.uid}_${Date.now()}`);
        await uploadBytes(imgRef, postFile);
        url = await getDownloadURL(imgRef);
      }
      const userData = users.find((u) => u.id === currentUser.uid);
      await addDoc(collection(db, "feed"), {
        userId: currentUser.uid,
        userName: userData.name,
        userPhoto: userData.photoUrl || "",
        text: postText,
        imageUrl: url,
        likes: [],
        createdAt: serverTimestamp(),
      });
      setPostText("");
      setPostFile(null);
    } catch (err) {
      alert("Fejl ved upload: " + err.message);
    }
    setIsPosting(false);
  };

  const submitRecipe = async (e) => {
    e.preventDefault();
    if (!recipeFile) return alert("Husk et lækkert billede af maden! 🥩");
    if (!recipeTitle) return alert("Giv opskriften en titel!");
    setIsPostingRecipe(true);
    try {
      const imgRef = ref(storage, `recipes/${currentUser.uid}_${Date.now()}`);
      await uploadBytes(imgRef, recipeFile);
      const url = await getDownloadURL(imgRef);
      const userData = users.find((u) => u.id === currentUser.uid);
      await addDoc(collection(db, "recipes"), {
        userId: currentUser.uid,
        userName: userData.name,
        userPhoto: userData.photoUrl || "",
        title: recipeTitle,
        text: recipeText,
        imageUrl: url,
        createdAt: serverTimestamp(),
      });
      setRecipeTitle("");
      setRecipeText("");
      setRecipeFile(null);
    } catch (err) {
      alert("Fejl ved upload: " + err.message);
    }
    setIsPostingRecipe(false);
  };

  const toggleLike = async (postId, currentLikes) => {
    const postRef = doc(db, "feed", postId);
    if (currentLikes.includes(currentUser.uid)) {
      await updateDoc(postRef, { likes: arrayRemove(currentUser.uid) });
    } else {
      await updateDoc(postRef, { likes: arrayUnion(currentUser.uid) });
    }
  };

  const deletePost = async (postId, collectionName = "feed") => {
    if (window.confirm("Slet dette opslag?")) {
      await deleteDoc(doc(db, collectionName, postId));
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const imageRef = ref(storage, `profile_pictures/${currentUser.uid}`);
    try {
      await uploadBytes(imageRef, file);
      const url = await getDownloadURL(imageRef);
      setMyPhoto(url);
      await updateDoc(doc(db, "users", currentUser.uid), { photoUrl: url });
    } catch (error) {
      alert(error.message);
    }
  };

  if (loading)
    return (
      <div
        style={{
          ...mainStyle,
          textAlign: "center",
          paddingTop: "100px",
          color: theme.accent,
        }}
      >
        <h2>Indlæser...</h2>
      </div>
    );

  if (!currentUser) {
    return (
      <div style={mainStyle}>
        <div
          style={{
            padding: "40px 20px",
            maxWidth: "400px",
            margin: "0 auto",
            textAlign: "center",
          }}
        >
          <div
            style={{
              background: theme.card,
              borderRadius: "16px",
              padding: "30px",
              marginTop: "50px",
            }}
          >
            <h1 style={{ color: theme.accent, marginTop: 0 }}>MIN APP</h1>
            {errorMsg && <p style={{ color: "#ef4444" }}>{errorMsg}</p>}
            <form
              onSubmit={handleAuth}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                marginTop: "20px",
              }}
            >
              {isRegistering && (
                <input
                  type="text"
                  placeholder="Navn"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{
                    padding: "12px",
                    background: theme.inputBg,
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                  }}
                />
              )}
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  padding: "12px",
                  background: theme.inputBg,
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                }}
              />
              <input
                type="password"
                placeholder="Kodeord"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  padding: "12px",
                  background: theme.inputBg,
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                }}
              />
              <button
                type="submit"
                style={{
                  padding: "12px",
                  background: theme.accent,
                  color: "#000",
                  borderRadius: "8px",
                  border: "none",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                {isRegistering ? "Opret" : "Log Ind"}
              </button>
            </form>
            <p
              onClick={() => setIsRegistering(!isRegistering)}
              style={{
                color: theme.textSub,
                cursor: "pointer",
                marginTop: "15px",
              }}
            >
              {isRegistering ? "Log ind" : "Opret profil"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const currentUserData = users.find((u) => u.id === currentUser.uid) || {};

  return (
    <div style={mainStyle}>
      <div style={{ padding: "15px", maxWidth: "600px", margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "15px",
            paddingTop: "10px",
          }}
        >
          <h2 style={{ color: theme.accent, margin: 0, letterSpacing: "1px" }}>
            MASSIVE DUDES
          </h2>
          {weather && (
            <div style={{ fontSize: "11px", color: theme.textSub }}>
              {weather.temperature}°C udenfor
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            gap: "5px",
            marginBottom: "20px",
            background: theme.card,
            padding: "5px",
            borderRadius: "10px",
            position: "sticky",
            top: "10px",
            zIndex: 50,
            boxShadow: "0 4px 10px rgba(0,0,0,0.5)",
          }}
        >
          {[
            { id: "feed", icon: "📱", label: "Feed" },
            { id: "kogebog", icon: "🥩", label: "Opskrifter" },
            { id: "leaderboard", icon: "🏆", label: "Dudes" },
            { id: "profile", icon: "⚙️", label: "Profil" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setActiveTab(t.id);
                if (t.id === "profile") {
                  setMyBio(currentUserData.bio || "");
                  setMyArc(currentUserData.arc || "Vinter Arc ❄️");
                }
              }}
              style={{
                flex: 1,
                padding: "10px 0",
                borderRadius: "8px",
                border: "none",
                backgroundColor:
                  activeTab === t.id ? theme.accent : "transparent",
                color: activeTab === t.id ? "#000" : theme.textSub,
                fontWeight: "bold",
                fontSize: "11px",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <span style={{ fontSize: "16px" }}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === "feed" && (
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "15px",
              }}
            >
              <h3 style={{ margin: 0, color: theme.textMain }}>Aktivitet</h3>
              <button
                onClick={() => setShowLogModal(true)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "20px",
                  background: theme.accent,
                  color: "#000",
                  border: "none",
                  fontSize: "13px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  boxShadow: "0 2px 10px rgba(245, 158, 11, 0.3)",
                }}
              >
                + Log Træning
              </button>
            </div>

            <div
              style={{
                background: theme.card,
                padding: "15px",
                borderRadius: "12px",
                marginBottom: "20px",
                border: `1px solid ${theme.border}`,
              }}
            >
              <form onSubmit={submitPost}>
                <textarea
                  value={postText}
                  onChange={(e) => setPostText(e.target.value)}
                  placeholder="Hvad sker der bro? Smid et flex..."
                  style={{
                    width: "100%",
                    height: "50px",
                    background: theme.inputBg,
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    padding: "10px",
                    boxSizing: "border-box",
                    marginBottom: "10px",
                    resize: "none",
                  }}
                />
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setPostFile(e.target.files[0])}
                    style={{
                      color: theme.textSub,
                      fontSize: "12px",
                      width: "60%",
                    }}
                  />
                  <button
                    type="submit"
                    disabled={isPosting}
                    style={{
                      padding: "8px 15px",
                      background: isPosting ? "#555" : theme.accent,
                      color: isPosting ? "#ccc" : "#000",
                      border: "none",
                      borderRadius: "8px",
                      fontWeight: "bold",
                      cursor: isPosting ? "default" : "pointer",
                    }}
                  >
                    {isPosting ? "..." : "Post 📸"}
                  </button>
                </div>
              </form>
            </div>

            {feed.map((post) => {
              const hasLiked =
                post.likes && post.likes.includes(currentUser.uid);
              const likeCount = post.likes ? post.likes.length : 0;
              const isOwner = currentUser.uid === post.userId;

              return (
                <div
                  key={post.id}
                  style={{
                    background: theme.card,
                    borderRadius: "12px",
                    marginBottom: "20px",
                    overflow: "hidden",
                    border: post.isStrava
                      ? "2px solid #fc4c02"
                      : post.isActivityLog
                      ? "1px solid #3b82f6"
                      : `1px solid ${theme.border}`,
                  }}
                >
                  <div
                    style={{
                      padding: "12px",
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      background: post.isStrava
                        ? "rgba(252, 76, 2, 0.1)"
                        : post.isActivityLog
                        ? "rgba(59, 130, 246, 0.1)"
                        : "transparent",
                    }}
                  >
                    <img
                      src={post.userPhoto || "https://via.placeholder.com/40"}
                      alt=""
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "50%",
                        objectFit: "cover",
                      }}
                    />
                    <div>
                      <div style={{ fontWeight: "bold", fontSize: "14px" }}>
                        {post.userName} {post.isStrava && "🟠"}
                      </div>
                      <div style={{ fontSize: "11px", color: theme.textSub }}>
                        {post.createdAt
                          ? new Date(post.createdAt.toDate()).toLocaleString(
                              [],
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                                day: "2-digit",
                                month: "short",
                              }
                            )
                          : "Lige nu"}
                      </div>
                    </div>
                  </div>

                  {/* === DET NYE BRUTALE STRAVA STAT-CARD === */}
                  {post.isStrava && post.stravaStats ? (
                    <div
                      style={{
                        background:
                          "linear-gradient(135deg, #fc4c02 0%, #e34402 100%)",
                        padding: "20px",
                        color: "white",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: "15px",
                        }}
                      >
                        <h4
                          style={{
                            margin: 0,
                            fontSize: "16px",
                            textShadow: "1px 1px 2px rgba(0,0,0,0.3)",
                          }}
                        >
                          {post.text}
                        </h4>
                        <span style={{ fontSize: "20px" }}>🏃‍♂️</span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          background: "rgba(0,0,0,0.2)",
                          borderRadius: "12px",
                          padding: "15px",
                        }}
                      >
                        <div style={{ textAlign: "center", flex: 1 }}>
                          <div
                            style={{
                              fontSize: "10px",
                              opacity: 0.8,
                              textTransform: "uppercase",
                              letterSpacing: "1px",
                              marginBottom: "4px",
                            }}
                          >
                            Distance
                          </div>
                          <div style={{ fontSize: "18px", fontWeight: "900" }}>
                            {post.stravaStats.distance}
                            <span
                              style={{ fontSize: "11px", fontWeight: "normal" }}
                            >
                              {" "}
                              km
                            </span>
                          </div>
                        </div>
                        <div
                          style={{
                            textAlign: "center",
                            flex: 1,
                            borderLeft: "1px solid rgba(255,255,255,0.2)",
                            borderRight: "1px solid rgba(255,255,255,0.2)",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "10px",
                              opacity: 0.8,
                              textTransform: "uppercase",
                              letterSpacing: "1px",
                              marginBottom: "4px",
                            }}
                          >
                            Pace
                          </div>
                          <div style={{ fontSize: "18px", fontWeight: "900" }}>
                            {post.stravaStats.pace}
                            <span
                              style={{ fontSize: "11px", fontWeight: "normal" }}
                            >
                              {" "}
                              /km
                            </span>
                          </div>
                        </div>
                        <div style={{ textAlign: "center", flex: 1 }}>
                          <div
                            style={{
                              fontSize: "10px",
                              opacity: 0.8,
                              textTransform: "uppercase",
                              letterSpacing: "1px",
                              marginBottom: "4px",
                            }}
                          >
                            Tid
                          </div>
                          <div style={{ fontSize: "18px", fontWeight: "900" }}>
                            {post.stravaStats.time}
                          </div>
                        </div>
                      </div>
                      {post.stravaStats.elevation > 0 && (
                        <div
                          style={{
                            textAlign: "center",
                            marginTop: "12px",
                            fontSize: "12px",
                            opacity: 0.9,
                            fontWeight: "bold",
                          }}
                        >
                          ⛰️ {post.stravaStats.elevation} m stigning
                        </div>
                      )}
                    </div>
                  ) : post.imageUrl ? (
                    <img
                      src={post.imageUrl}
                      alt="Post"
                      style={{
                        width: "100%",
                        maxHeight: "500px",
                        objectFit: "cover",
                        display: "block",
                      }}
                    />
                  ) : null}
                  {/* ========================================== */}

                  <div style={{ padding: "15px" }}>
                    {post.text && !post.isStrava && (
                      <p
                        style={{
                          margin: "0 0 15px 0",
                          fontSize: "14px",
                          lineHeight: "1.5",
                          whiteSpace: "pre-line",
                          fontWeight: post.isActivityLog ? "bold" : "normal",
                        }}
                      >
                        {post.text}
                      </p>
                    )}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <button
                        onClick={() => toggleLike(post.id, post.likes || [])}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          padding: "8px 12px",
                          background: hasLiked
                            ? "rgba(245, 158, 11, 0.2)"
                            : theme.inputBg,
                          border: hasLiked
                            ? `1px solid ${theme.accent}`
                            : "none",
                          borderRadius: "20px",
                          cursor: "pointer",
                          color: hasLiked ? theme.accent : "white",
                          fontWeight: "bold",
                          transition: "0.2s",
                        }}
                      >
                        <span style={{ fontSize: "16px" }}>🔥</span> {likeCount}
                      </button>
                      {(isOwner || isAdmin) && (
                        <button
                          onClick={() => deletePost(post.id)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "#ef4444",
                            fontSize: "12px",
                            cursor: "pointer",
                          }}
                        >
                          Slet
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === "kogebog" && (
          <div>
            <h3 style={{ margin: "0 0 15px 0", color: theme.textMain }}>
              Min Kogebog 🥩🔥
            </h3>
            <p
              style={{
                fontSize: "13px",
                color: theme.textSub,
                marginBottom: "20px",
              }}
            >
              Smid opskrifter op med kernetemperaturer, marinader og
              grill-tider, så de aldrig bliver glemt.
            </p>

            <div
              style={{
                background: theme.card,
                padding: "15px",
                borderRadius: "12px",
                marginBottom: "30px",
                border: `1px solid ${theme.accent}`,
              }}
            >
              <h4 style={{ margin: "0 0 10px 0", color: theme.accent }}>
                Tilføj Ny Opskrift
              </h4>
              <form onSubmit={submitRecipe}>
                <input
                  value={recipeTitle}
                  onChange={(e) => setRecipeTitle(e.target.value)}
                  placeholder="Titel (f.eks. Perfekt Grillet Ribeye)"
                  style={{
                    width: "100%",
                    padding: "12px",
                    background: theme.inputBg,
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    boxSizing: "border-box",
                    marginBottom: "10px",
                    fontWeight: "bold",
                  }}
                />
                <textarea
                  value={recipeText}
                  onChange={(e) => setRecipeText(e.target.value)}
                  placeholder="Kernetemperatur, timer, ingredienser og marinader..."
                  style={{
                    width: "100%",
                    height: "120px",
                    background: theme.inputBg,
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    padding: "10px",
                    boxSizing: "border-box",
                    marginBottom: "10px",
                    resize: "vertical",
                  }}
                />
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setRecipeFile(e.target.files[0])}
                    style={{
                      color: theme.textSub,
                      fontSize: "12px",
                      width: "60%",
                    }}
                  />
                  <button
                    type="submit"
                    disabled={isPostingRecipe}
                    style={{
                      padding: "10px 20px",
                      background: isPostingRecipe ? "#555" : theme.accent,
                      color: "#000",
                      border: "none",
                      borderRadius: "8px",
                      fontWeight: "bold",
                      cursor: isPostingRecipe ? "default" : "pointer",
                    }}
                  >
                    {isPostingRecipe ? "Gemmer..." : "Gem Opskrift 📖"}
                  </button>
                </div>
              </form>
            </div>

            {recipes.map((recipe) => (
              <div
                key={recipe.id}
                style={{
                  background: theme.card,
                  borderRadius: "12px",
                  marginBottom: "25px",
                  overflow: "hidden",
                  border: `1px solid ${theme.border}`,
                }}
              >
                {recipe.imageUrl && (
                  <img
                    src={recipe.imageUrl}
                    alt="Mad"
                    style={{
                      width: "100%",
                      height: "250px",
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                )}
                <div style={{ padding: "20px" }}>
                  <h2 style={{ margin: "0 0 10px 0", color: theme.accent }}>
                    {recipe.title}
                  </h2>
                  <div
                    style={{
                      fontSize: "11px",
                      color: theme.textSub,
                      marginBottom: "15px",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <img
                      src={recipe.userPhoto || "https://via.placeholder.com/20"}
                      alt=""
                      style={{
                        width: "20px",
                        height: "20px",
                        borderRadius: "50%",
                      }}
                    />
                    Af {recipe.userName} •{" "}
                    {recipe.createdAt
                      ? new Date(recipe.createdAt.toDate()).toLocaleDateString()
                      : "Lige nu"}
                  </div>
                  <p
                    style={{
                      margin: "0 0 15px 0",
                      fontSize: "15px",
                      lineHeight: "1.6",
                      whiteSpace: "pre-line",
                      color: theme.textMain,
                    }}
                  >
                    {recipe.text}
                  </p>

                  {(currentUser.uid === recipe.userId || isAdmin) && (
                    <button
                      onClick={() => deletePost(recipe.id, "recipes")}
                      style={{
                        background: "none",
                        border: "1px solid #ef4444",
                        color: "#ef4444",
                        padding: "6px 12px",
                        borderRadius: "6px",
                        fontSize: "12px",
                        cursor: "pointer",
                      }}
                    >
                      Slet Opskrift
                    </button>
                  )}
                </div>
              </div>
            ))}
            {recipes.length === 0 && (
              <div
                style={{
                  textAlign: "center",
                  color: theme.textSub,
                  padding: "40px 0",
                }}
              >
                Ingen opskrifter endnu. Fyr op for grillen! 🥩
              </div>
            )}
          </div>
        )}

        {activeTab === "leaderboard" && (
          <div>
            <h3 style={{ margin: "0 0 15px 0", color: theme.textMain }}>
              Sæson: {currentMonthName}
            </h3>
            {users
              .map((u) => ({
                ...u,
                currentMonthStats: getStatsForMonth(u.history),
              }))
              .sort(
                (a, b) =>
                  b.currentMonthStats.totalActivities -
                  a.currentMonthStats.totalActivities
              )
              .map((user, index) => {
                const isMe = currentUser.uid === user.id;
                const streak = calculateStreak(user.history);
                const rank = getRankInfo(user.history);

                return (
                  <div
                    key={user.id}
                    style={{
                      background: theme.card,
                      marginBottom: "10px",
                      borderRadius: "12px",
                      border: isMe
                        ? `1px solid ${theme.accent}`
                        : "1px solid #333",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      onClick={() =>
                        setExpandedUserId(
                          expandedUserId === user.id ? null : user.id
                        )
                      }
                      style={{
                        padding: "15px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        cursor: "pointer",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                        }}
                      >
                        <div
                          style={{
                            fontWeight: "bold",
                            fontSize: "18px",
                            color: index === 0 ? theme.accent : theme.textSub,
                            width: "15px",
                          }}
                        >
                          {index + 1}
                        </div>
                        <img
                          src={user.photoUrl}
                          alt=""
                          style={{
                            width: "40px",
                            height: "40px",
                            borderRadius: "50%",
                            background: "#444",
                            objectFit: "cover",
                          }}
                        />
                        <div>
                          <div
                            style={{
                              fontWeight: "bold",
                              fontSize: "15px",
                              display: "flex",
                              alignItems: "center",
                              flexWrap: "wrap",
                              gap: "4px",
                            }}
                          >
                            {user.name}
                            <span
                              style={{
                                background: rank.color + "20",
                                color: rank.color,
                                padding: "2px 6px",
                                borderRadius: "4px",
                                fontSize: "9px",
                                textTransform: "uppercase",
                                fontWeight: "900",
                              }}
                            >
                              {rank.title}
                            </span>
                          </div>
                          <div
                            style={{
                              fontSize: "11px",
                              color: theme.accent,
                              marginTop: "2px",
                            }}
                          >
                            {user.arc || "Vinter Arc ❄️"} | {streak} streak 🔥
                          </div>
                        </div>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                        }}
                      >
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontWeight: "bold", fontSize: "14px" }}>
                            {user.currentMonthStats.gym} 🏋️
                          </div>
                          <div style={{ fontSize: "11px", color: "#60a5fa" }}>
                            {user.currentMonthStats.cardioKm} km 🏃‍♂️
                          </div>
                        </div>
                      </div>
                    </div>
                    {expandedUserId === user.id && (
                      <div
                        style={{
                          padding: "15px",
                          background: "#151515",
                          borderTop: "1px solid #333",
                          fontSize: "13px",
                        }}
                      >
                        <p
                          style={{
                            color: theme.textSub,
                            margin: "0 0 10px 0",
                            fontStyle: "italic",
                          }}
                        >
                          "{user.bio}"
                        </p>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                          }}
                        >
                          <div
                            style={{
                              fontWeight: "bold",
                              color: theme.accent,
                              marginBottom: "5px",
                            }}
                          >
                            Seneste logs:
                          </div>
                          {(isMe || isAdmin) && user.history.length > 0 && (
                            <button
                              onClick={() => undoWorkout(user)}
                              style={{
                                color: "#ef4444",
                                border: "none",
                                background: "none",
                                fontSize: "11px",
                                cursor: "pointer",
                              }}
                            >
                              Slet log 💀
                            </button>
                          )}
                        </div>
                        {[...user.history]
                          .reverse()
                          .slice(0, 5)
                          .map((h, i) => (
                            <div
                              key={i}
                              style={{
                                marginBottom: "4px",
                                fontSize: "12px",
                                display: "flex",
                                justifyContent: "space-between",
                              }}
                            >
                              <span>
                                {h.type === "gym" ? "🏋️" : "🏃‍♂️"} {h.title}{" "}
                                {h.value && `(${h.value} km)`}
                              </span>
                              <span style={{ color: theme.textSub }}>
                                {h.date}
                              </span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )}

        {showLogModal && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              background: "rgba(0,0,0,0.8)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 100,
            }}
          >
            <div
              style={{
                background: theme.card,
                padding: "25px",
                borderRadius: "16px",
                width: "280px",
                textAlign: "center",
                border: `1px solid ${theme.border}`,
              }}
            >
              <h3 style={{ marginTop: 0 }}>Log Træning</h3>
              <p
                style={{
                  fontSize: "12px",
                  color: theme.textSub,
                  marginBottom: "20px",
                }}
              >
                Deles automatisk i feedet!
              </p>
              <button
                onClick={() => logActivity("gym")}
                style={{
                  width: "100%",
                  padding: "12px",
                  background: theme.accent,
                  border: "none",
                  borderRadius: "8px",
                  fontWeight: "bold",
                  marginBottom: "10px",
                  color: "#000",
                  cursor: "pointer",
                }}
              >
                🏋️ Styrketræning
              </button>
              <button
                onClick={() => logActivity("cardio")}
                style={{
                  width: "100%",
                  padding: "12px",
                  background: "#3b82f6",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontWeight: "bold",
                  marginBottom: "15px",
                  cursor: "pointer",
                }}
              >
                🏃‍♂️ Cardio / Løb
              </button>

              <div
                style={{ height: "1px", background: "#444", margin: "15px 0" }}
              ></div>

              {currentUserData.stravaTokens ? (
                <button
                  onClick={fetchStravaActivity}
                  style={{
                    width: "100%",
                    padding: "12px",
                    background: "#fc4c02",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    fontWeight: "bold",
                    marginBottom: "15px",
                    cursor: "pointer",
                  }}
                >
                  Hent fra Strava 🟠
                </button>
              ) : (
                <div
                  style={{
                    fontSize: "11px",
                    color: theme.textSub,
                    marginBottom: "15px",
                  }}
                >
                  Forbind Strava under 'Profil' for auto-log
                </div>
              )}

              <button
                onClick={() => setShowLogModal(false)}
                style={{
                  color: theme.textSub,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                Annuller
              </button>
            </div>
          </div>
        )}

        {activeTab === "profile" && (
          <div
            style={{
              background: theme.card,
              padding: "20px",
              borderRadius: "12px",
            }}
          >
            <div
              style={{
                marginBottom: "20px",
                padding: "15px",
                background: "rgba(252, 76, 2, 0.1)",
                borderRadius: "8px",
                border: "1px solid #fc4c02",
                textAlign: "center",
              }}
            >
              <h4
                style={{ color: "#fc4c02", marginTop: 0, marginBottom: "10px" }}
              >
                STRAVA INTEGRATION
              </h4>
              {currentUserData.stravaTokens ? (
                <p
                  style={{
                    color: "#10b981",
                    margin: 0,
                    fontWeight: "bold",
                    fontSize: "13px",
                  }}
                >
                  ✅ Strava er forbundet!
                </p>
              ) : (
                <button
                  onClick={connectStrava}
                  style={{
                    background: "#fc4c02",
                    color: "white",
                    border: "none",
                    padding: "10px 15px",
                    borderRadius: "8px",
                    fontWeight: "bold",
                    cursor: "pointer",
                    width: "100%",
                  }}
                >
                  Forbind Strava 🟠
                </button>
              )}
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "12px",
                  color: theme.textSub,
                  marginBottom: "5px",
                }}
              >
                Nuværende Arc
              </label>
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  onClick={() => setMyArc("Vinter Arc ❄️")}
                  style={{
                    flex: 1,
                    padding: "10px",
                    borderRadius: "8px",
                    border:
                      myArc === "Vinter Arc ❄️"
                        ? `2px solid ${theme.accent}`
                        : "2px solid transparent",
                    background: theme.inputBg,
                    color: "white",
                    cursor: "pointer",
                  }}
                >
                  Vinter ❄️
                </button>
                <button
                  onClick={() => setMyArc("Sommer Arc ☀️")}
                  style={{
                    flex: 1,
                    padding: "10px",
                    borderRadius: "8px",
                    border:
                      myArc === "Sommer Arc ☀️"
                        ? `2px solid ${theme.accent}`
                        : "2px solid transparent",
                    background: theme.inputBg,
                    color: "white",
                    cursor: "pointer",
                  }}
                >
                  Sommer ☀️
                </button>
              </div>
            </div>
            <label
              style={{
                display: "block",
                fontSize: "12px",
                color: theme.textSub,
                marginBottom: "5px",
              }}
            >
              Din Bio
            </label>
            <textarea
              value={myBio}
              onChange={(e) => setMyBio(e.target.value)}
              style={{
                width: "100%",
                height: "60px",
                background: theme.inputBg,
                color: "white",
                border: "none",
                borderRadius: "8px",
                padding: "10px",
                boxSizing: "border-box",
              }}
            />
            <label
              style={{
                display: "block",
                fontSize: "12px",
                color: theme.textSub,
                marginTop: "15px",
                marginBottom: "5px",
              }}
            >
              Profilbillede
            </label>
            <input
              type="file"
              onChange={handleImageUpload}
              style={{ marginTop: "5px" }}
            />
            <button
              onClick={async () => {
                await updateDoc(doc(db, "users", currentUser.uid), {
                  bio: myBio,
                  arc: myArc,
                });
                alert("Gemt!");
              }}
              style={{
                width: "100%",
                padding: "12px",
                background: theme.accent,
                color: "#000",
                border: "none",
                borderRadius: "8px",
                marginTop: "25px",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              Gem Profil
            </button>
            <button
              onClick={() => signOut(auth)}
              style={{
                width: "100%",
                background: "none",
                color: "#ef4444",
                border: "1px solid #ef4444",
                padding: "10px",
                borderRadius: "8px",
                marginTop: "10px",
                cursor: "pointer",
              }}
            >
              Log ud
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
