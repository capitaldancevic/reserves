
// IMPORTS FIREBASE
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyCyR9t974slq_63KePie4stTqg3fbN9uD4",
  authDomain: "capital-dance-vic-reserves.firebaseapp.com",
  projectId: "capital-dance-vic-reserves",
  storageBucket: "capital-dance-vic-reserves.firebasestorage.app",
  messagingSenderId: "550487696683",
  appId: "1:550487696683:web:e15891d9c9dab4512cd16e"
};

// INIT
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

import { createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged } 
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import { doc, setDoc, getDoc } 
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// REGISTER
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

// LOGIN
const loginBtn = document.getElementById("loginBtn");

if (loginBtn) {
  loginBtn.addEventListener("click", async () => {
    const email = document.getElementById("loginEmail").value;
    const password = document.getElementById("loginPassword").value;

    await signInWithEmailAndPassword(auth, email, password);
    window.location.href = "dashboard.html";
  });
}

import { collection, addDoc, getDocs } 
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const createBtn = document.getElementById("createActivity");

if (createBtn) {
  createBtn.addEventListener("click", async () => {
    const title = document.getElementById("title").value;
    const date = document.getElementById("date").value;
    const spots = parseInt(document.getElementById("spots").value);

    await addDoc(collection(db, "activities"), {
      title,
      date,
      spots_total: spots,
      spots_remaining: spots,
      visible: true
    });

    alert("Activity created");
  });
}

import { getDocs, collection, updateDoc, doc } 
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

async function loadActivities() {
  const container = document.getElementById("activitiesContainer");
  if (!container) return;

  const querySnapshot = await getDocs(collection(db, "activities"));

  querySnapshot.forEach((docSnap) => {
    const data = docSnap.data();

    if (data.visible && data.spots_remaining > 0) {
      const div = document.createElement("div");
      div.innerHTML = `
        <h3>${data.title}</h3>
        <p>${data.date}</p>
        <p>Spots left: ${data.spots_remaining}</p>
        <button onclick="reserve('${docSnap.id}')">Reserve</button>
      `;
      container.appendChild(div);
    }
  });
}

loadActivities();

window.reserve = async function(activityId) {
  const activityRef = doc(db, "activities", activityId);

  const activitySnap = await getDoc(activityRef);
  const data = activitySnap.data();

  const qrData = auth.currentUser.uid + "_" + activityId;

  QRCode.toCanvas(document.createElement('canvas'), qrData, function (error, canvas) {
    document.body.appendChild(canvas);
  });

  if (data.spots_remaining <= 0) {
    alert("No spots left");
    return;
  }

  await updateDoc(activityRef, {
    spots_remaining: data.spots_remaining - 1
  });

  alert("Reserved!");
}
