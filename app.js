// ==========================
// FIREBASE IMPORTS
// ==========================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged
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
  where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";


// ==========================
// FIREBASE CONFIG
// ==========================

const firebaseConfig = {
  apiKey: "AIzaSyCyR9t974slq_63KePie4stTqg3fbN9uD4",
  authDomain: "capital-dance-vic-reserves.firebaseapp.com",
  projectId: "capital-dance-vic-reserves",
  storageBucket: "capital-dance-vic-reserves.firebasestorage.app",
  messagingSenderId: "550487696683",
  appId: "1:550487696683:web:e15891d9c9dab4512cd16e"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);


// ==========================
// AUTH PROTECTION
// ==========================

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    if (window.location.pathname.includes("dashboard") ||
        window.location.pathname.includes("admin")) {
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

    const email = document.getElementById("registerEmail").value;
    const password = document.getElementById("registerPassword").value;

    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    await setDoc(doc(db, "users", user.uid), {
      email: email,
      role: "user"
    });

    alert("Registered!");
  });
}


// ==========================
// LOGIN
// ==========================

const loginBtn = document.getElementById("loginBtn");

if (loginBtn) {
  loginBtn.addEventListener("click", async () => {

    const email = document.getElementById("loginEmail").value;
    const password = document.getElementById("loginPassword").value;

    await signInWithEmailAndPassword(auth, email, password);
    window.location.href = "dashboard.html";
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
      alert("Fill all fields");
      return;
    }

    await addDoc(collection(db, "activities"), {
      title,
      date,
      spots_total: spots,
      spots_remaining: spots,
      visible: true,
      createdAt: new Date()
    });

    alert("Activity created");
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

    div.innerHTML = `
      <h3>${data.title}</h3>
      <p>${data.date}</p>
      <p>Spots left: ${data.spots_remaining}</p>
      <button data-id="${docSnap.id}">Reserve</button>
      <hr>
    `;

    const button = div.querySelector("button");

    button.addEventListener("click", () => {
      reserve(docSnap.id);
    });

    container.appendChild(div);
  });
}

loadActivities();


// ==========================
// RESERVE
// ==========================

async function reserve(activityId) {

  const user = auth.currentUser;
  if (!user) return;

  const activityRef = doc(db, "activities", activityId);
  const activitySnap = await getDoc(activityRef);
  const data = activitySnap.data();

  if (data.spots_remaining <= 0) {
    alert("No spots left");
    return;
  }

  // CHECK duplicate reservation
  const q = query(
    collection(db, "reservations"),
    where("userId", "==", user.uid),
    where("activityId", "==", activityId)
  );

  const existing = await getDocs(q);

  if (!existing.empty) {
    alert("You already reserved this activity");
    return;
  }

  // CREATE RESERVATION
  await addDoc(collection(db, "reservations"), {
    userId: user.uid,
    activityId: activityId,
    createdAt: new Date()
  });

  // UPDATE SPOTS
  await updateDoc(activityRef, {
    spots_remaining: data.spots_remaining - 1
  });

  alert("Reserved successfully!");

  loadActivities();
}
