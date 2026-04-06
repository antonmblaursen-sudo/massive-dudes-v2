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
} from "firebase/firestore";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from "firebase/auth";

// 1. Din Firebase Konfiguration
const firebaseConfig = {
  apiKey: "AIzaSyAi-l2FOylk76ZKU-1CyVtt2HdIavf4w5g",
  authDomain: "massive-brutale-dudes.firebaseapp.com",
  projectId: "massive-brutale-dudes",
  storageBucket: "massive-brutale-dudes.firebasestorage.app",
  messagingSenderId: "45686943799",
  appId: "1:45686943799:web:95628cd0039d908ec40fb2",
};

// Start Firebase (Nu med Auth!)
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export default function App() {
  const [activeTab, setActiveTab] = useState("leaderboard");
  const [users, setUsers] = useState([]);

  // Login State
  const [currentUser, setCurrentUser] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState(""); // Bruges kun ved oprettelse
  const [isRegistering, setIsRegistering] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Lyt efter om en bruger logger ind eller ud
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  // Hent data (Leaderboard)
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
      setUsers(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  const getTodayDate = () => new Date().toISOString().split("T")[0];

  // --- LOGIN OG OPRETTELSE ---
  const handleAuth = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    try {
      if (isRegistering) {
        // Opret ny bruger i systemet
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );
        const newUser = userCredential.user;
        // Opret brugerens profil i databasen, bundet til deres unikke ID (newUser.uid)
        await setDoc(doc(db, "users", newUser.uid), {
          name: name,
          workouts: 0,
          lastWorkoutDate: null,
          maxLifts: { bench: 0, squat: 0, deadlift: 0 },
        });
      } else {
        // Log ind
        await signInWithEmailAndPassword(auth, email, password);
      }
      setEmail("");
      setPassword("");
      setName("");
    } catch (error) {
      setErrorMsg("Fejl: " + error.message);
    }
  };

  // --- TRÆNINGS FUNKTIONER ---
  const logWorkout = async (user) => {
    const today = getTodayDate();
    if (user.lastWorkoutDate === today) {
      alert("Rolig nu! Du har allerede tjekket ind i dag.");
      return;
    }
    await updateDoc(doc(db, "users", user.id), {
      workouts: increment(1),
      lastWorkoutDate: today,
    });
  };

  const updateMaxLift = async (id, liftType, currentWeight) => {
    const newWeight = prompt(`Nyt maks i ${liftType} (kg):`, currentWeight);
    if (newWeight && !isNaN(newWeight)) {
      await updateDoc(doc(db, "users", id), {
        [`maxLifts.${liftType}`]: Number(newWeight),
      });
    }
  };

  // --- VISUELT: HVIS MAN IKKE ER LOGGET IND ---
  if (!currentUser) {
    return (
      <div
        style={{
          fontFamily: "sans-serif",
          padding: "20px",
          maxWidth: "400px",
          margin: "50px auto",
          background: "#f4f4f4",
          borderRadius: "12px",
          textAlign: "center",
        }}
      >
        <h1 style={{ color: "#E91E63" }}>MASSIVE DUDES 💪</h1>
        <h2>{isRegistering ? "Opret Profil" : "Log Ind"}</h2>
        {errorMsg && (
          <p style={{ color: "red", fontSize: "12px" }}>{errorMsg}</p>
        )}

        <form
          onSubmit={handleAuth}
          style={{ display: "flex", flexDirection: "column", gap: "10px" }}
        >
          {isRegistering && (
            <input
              type="text"
              placeholder="Dit Navn"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              style={{
                padding: "10px",
                borderRadius: "6px",
                border: "1px solid #ccc",
              }}
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              padding: "10px",
              borderRadius: "6px",
              border: "1px solid #ccc",
            }}
          />
          <input
            type="password"
            placeholder="Adgangskode (min 6 tegn)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{
              padding: "10px",
              borderRadius: "6px",
              border: "1px solid #ccc",
            }}
          />

          <button
            type="submit"
            style={{
              padding: "12px",
              background: "#E91E63",
              color: "white",
              border: "none",
              borderRadius: "6px",
              fontWeight: "bold",
            }}
          >
            {isRegistering ? "Opret Mig" : "Log Ind"}
          </button>
        </form>

        <p
          onClick={() => setIsRegistering(!isRegistering)}
          style={{
            color: "#555",
            cursor: "pointer",
            marginTop: "15px",
            textDecoration: "underline",
          }}
        >
          {isRegistering
            ? "Har du allerede en konto? Log ind"
            : "Ny dude? Opret profil her"}
        </p>
      </div>
    );
  }

  // --- VISUELT: NÅR MAN ER LOGGET IND (Selve Appen) ---
  return (
    <div
      style={{
        fontFamily: "sans-serif",
        padding: "20px",
        maxWidth: "500px",
        margin: "0 auto",
        color: "#333",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h1 style={{ color: "#E91E63", fontSize: "22px" }}>
          MASSIVE BRUTALE DUDES 🦾
        </h1>
        <button
          onClick={() => signOut(auth)}
          style={{
            padding: "5px 10px",
            background: "#333",
            color: "white",
            border: "none",
            borderRadius: "4px",
          }}
        >
          Log ud
        </button>
      </div>

      <div
        style={{
          display: "flex",
          gap: "10px",
          marginBottom: "20px",
          marginTop: "10px",
        }}
      >
        <button
          onClick={() => setActiveTab("leaderboard")}
          style={{
            flex: 1,
            padding: "12px",
            borderRadius: "8px",
            border: "none",
            backgroundColor: activeTab === "leaderboard" ? "#E91E63" : "#eee",
            color: activeTab === "leaderboard" ? "white" : "black",
          }}
        >
          Leaderboard
        </button>
        <button
          onClick={() => setActiveTab("maxlifts")}
          style={{
            flex: 1,
            padding: "12px",
            borderRadius: "8px",
            border: "none",
            backgroundColor: activeTab === "maxlifts" ? "#E91E63" : "#eee",
            color: activeTab === "maxlifts" ? "white" : "black",
          }}
        >
          Maks Løft
        </button>
      </div>

      {activeTab === "leaderboard" && (
        <div>
          {users
            .sort((a, b) => b.workouts - a.workouts)
            .map((user) => {
              const hasWorkedOutToday = user.lastWorkoutDate === getTodayDate();
              // TJEK: Er denne bruger på listen den samme som er logget ind?
              const isMe = currentUser.uid === user.id;

              return (
                <div
                  key={user.id}
                  style={{
                    background: isMe ? "#ffebee" : "#f9f9f9",
                    padding: "15px",
                    marginBottom: "10px",
                    borderRadius: "12px",
                    border: isMe ? "2px solid #E91E63" : "1px solid #eee",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <strong>
                      {user.name}: {user.workouts} gange
                    </strong>

                    {/* Vis KUN tjek ind knappen, hvis det er ens egen profil */}
                    {isMe && (
                      <button
                        onClick={() => logWorkout(user)}
                        disabled={hasWorkedOutToday}
                        style={{
                          padding: "8px 12px",
                          background: hasWorkedOutToday ? "#ccc" : "#4CAF50",
                          color: "white",
                          border: "none",
                          borderRadius: "6px",
                          fontWeight: "bold",
                        }}
                      >
                        {hasWorkedOutToday ? "Færdig i dag" : "+ Tjek ind"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {activeTab === "maxlifts" && (
        <div>
          {users.map((user) => {
            const isMe = currentUser.uid === user.id;
            return (
              <div
                key={user.id}
                style={{
                  background: isMe ? "#ffebee" : "#f9f9f9",
                  padding: "15px",
                  marginBottom: "10px",
                  borderRadius: "12px",
                  border: isMe ? "2px solid #E91E63" : "1px solid #eee",
                }}
              >
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <h3>{user.name}</h3>
                  {isMe && (
                    <span
                      style={{
                        fontSize: "12px",
                        color: "#E91E63",
                        marginTop: "5px",
                      }}
                    >
                      (Din profil)
                    </span>
                  )}
                </div>

                {/* Her tjekker vi også isMe, for at se om man må klikke */}
                <p
                  onClick={() =>
                    isMe && updateMaxLift(user.id, "bench", user.maxLifts.bench)
                  }
                  style={{ cursor: isMe ? "pointer" : "default" }}
                >
                  Bænk: <strong>{user.maxLifts?.bench || 0} kg</strong>{" "}
                  {isMe && "✏️"}
                </p>
                <p
                  onClick={() =>
                    isMe && updateMaxLift(user.id, "squat", user.maxLifts.squat)
                  }
                  style={{ cursor: isMe ? "pointer" : "default" }}
                >
                  Squat: <strong>{user.maxLifts?.squat || 0} kg</strong>{" "}
                  {isMe && "✏️"}
                </p>
                <p
                  onClick={() =>
                    isMe &&
                    updateMaxLift(user.id, "deadlift", user.maxLifts.deadlift)
                  }
                  style={{ cursor: isMe ? "pointer" : "default" }}
                >
                  Dødløft: <strong>{user.maxLifts?.deadlift || 0} kg</strong>{" "}
                  {isMe && "✏️"}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
