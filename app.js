
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
