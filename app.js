// ==========================
// FIREBASE IMPORTS
// ==========================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  addDoc,
  getDocs,
  updateDoc,
  query,
  where,
  runTransaction
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ==========================
// FIREBASE CONFIG
// ==========================

const firebaseConfig = {
  apiKey: "XXXXX",
  authDomain: "XXXXX",
  projectId: "XXXXX",
  storageBucket: "XXXXX",
  messagingSenderId: "XXXXX",
  appId: "XXXXX"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ==========================
// AUTH PROTECTION
// ==========================

onAuthStateChanged(auth, async (user) => {
  const path = window.location.pathname;

  // Si no està loguejat i és dashboard/admin → redirect
  if (!user) {
    if (path.includes("dashboard") || path.includes("admin")) {
      window.location.href = "index.html";
    }
  }

  // Si està loguejat i és admin.html → comprovar rol
  if (user && path.includes("admin")) {
    const docSnap = await getDoc(doc(db, "users", user.uid));
    if (!docSnap.exists() || docSnap.data().role !== "admin") {
      alert("No tens permisos per entrar aquí");
      window.location.href = "index.html";
    }
  }
});

// ==========================
// REGISTER
// ==========================

const registerBtn = document.getElementById("registerBtn");

if (registerBtn) {
  registerBtn.addEventListener("click", async () => {
    try {
      const email = document.getElementById("registerEmail").value;
      const password = document.getElementById("registerPassword").value;

      if (!email || !password) {
        alert("Omple tots els camps!");
        return;
      }

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Guardar a Firestore
      await setDoc(doc(db, "users", user.uid), {
        email,
        role: "user"
      });

      alert("Registrat correctament!");
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  });
}

// ==========================
// LOGIN
// ==========================

const loginBtn = document.getElementById("loginBtn");

if (loginBtn) {
  loginBtn.addEventListener("click", async () => {
    try {
      const email = document.getElementById("loginEmail").value;
      const password = document.getElementById("loginPassword").value;

      if (!email || !password) {
        alert("Omple tots els camps!");
        return;
      }

      await signInWithEmailAndPassword(auth, email, password);
      window.location.href = "dashboard.html";
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  });
}

// ==========================
// LOGOUT (opcional, afegir botó logout a dashboard/admin)
// ==========================

const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    signOut(auth);
    window.location.href = "index.html";
  });
}

// ==========================
// CREATE ACTIVITY (ADMIN)
// ==========================

const createBtn = document.getElementById("createActivity");

if (createBtn) {
  createBtn.addEventListener("click", async () => {
    const title = document.getElementById("title").value;
    const date = document.getElementById("date").value;
    const spots = parseInt(document.getElementById("spots").value);

    if (!title || !date || !spots) {
      alert("Omple tots els camps!");
      return;
    }

    await addDoc(collection(db, "activities"), {
      title,
      date: new Date(date), // guardar com Timestamp
      spots_total: spots,
      spots_remaining: spots,
      visible: true,
      createdAt: new Date()
    });

    alert("Activitat creada correctament!");
  });
}

// ==========================
// LOAD ACTIVITIES (DASHBOARD)
// ==========================

async function loadActivities() {
  const container = document.getElementById("activitiesContainer");
  if (!container) return;

  container.innerHTML = "";

  const snapshot = await getDocs(collection(db, "activities"));

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    if (!data.visible) return;

    const div = document.createElement("div");

    // Format data
    let dateStr = "";
    if (data.date.toDate) {
      dateStr = data.date.toDate().toLocaleString("ca-ES", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } else {
      dateStr = new Date(data.date).toLocaleString("ca-ES", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    }

    div.innerHTML = `
      <h3>${data.title}</h3>
      <p>${dateStr}</p>
      <p>Places restants: ${data.spots_remaining}</p>
      <button data-id="${docSnap.id}">Reserva</button>
      <hr>
    `;

    const button = div.querySelector("button");
    if (data.spots_remaining <= 0) {
      button.disabled = true;
      button.textContent = "No queden places";
    } else {
      button.addEventListener("click", () => reserve(docSnap.id));
    }

    container.appendChild(div);
  });
}

loadActivities();

// ==========================
// RESERVE (transacció segura)
// ==========================

async function reserve(activityId) {
  const user = auth.currentUser;
  if (!user) return alert("Fes login primer!");

  const activityRef = doc(db, "activities", activityId);

  try {
    await runTransaction(db, async (transaction) => {
      const activitySnap = await transaction.get(activityRef);
      if (!activitySnap.exists()) throw "Activitat no trobada";

      const data = activitySnap.data();
      if (data.spots_remaining <= 0) throw "No queden places";

      // Comprovar duplicats
      const reservationsRef = collection(db, "reservations");
      const q = query(
        reservationsRef,
        where("userId", "==", user.uid),
        where("activityId", "==", activityId)
      );
      const existing = await getDocs(q);
      if (!existing.empty) throw "Ja tens reserva d'aquesta activitat";

      // Restar plaça + crear reserva
      transaction.update(activityRef, { spots_remaining: data.spots_remaining - 1 });
      transaction.set(doc(reservationsRef), {
        userId: user.uid,
        activityId,
        createdAt: new Date()
      });
    });

    alert("Reserva feta correctament!");
    loadActivities();
  } catch (err) {
    alert(err);
  }
}
