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

// ACCESS CONTROL
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    if (window.location.pathname.includes("dashboard") ||
        window.location.pathname.includes("admin")) {
        window.location.href = "index.html";
    }
  } else {
    // Comprovem rol
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (!userDoc.exists()) return;

    const role = userDoc.data().role;

    if (window.location.pathname.includes("admin") && role !== "admin") {
      // Usuari normal no pot accedir a admin
      alert("No tens permisos per accedir a aquesta pàgina");
      window.location.href = "dashboard.html";
    }

    if (window.location.pathname.includes("dashboard")) {
      loadMyReservations();
    }
  }
});

// ==========================
// LOGOUT
// ==========================

const logoutBtn = document.getElementById("logoutBtn");

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "index.html";
  });
}

// ==========================
// REGISTER
// ==========================

const registerBtn = document.getElementById("registerBtn");

if (registerBtn) {
  registerBtn.addEventListener("click", async () => {
    try {

      const nom = document.getElementById("registerNom").value.trim();
      const cognoms = document.getElementById("registerCognoms").value.trim();
      const escola = document.getElementById("registerEscola").value.trim();
      const email = document.getElementById("registerEmail").value.trim();
      const password = document.getElementById("registerPassword").value;

      if (!nom || !cognoms || !escola || !email || !password) {
        alert("Omple tots els camps!");
        return;
      }

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Guardem a Firestore
      await setDoc(doc(db, "users", user.uid), {
        nom,
        cognoms,
        escola,
        email,
        role: "user",
        createdAt: new Date()
      });

      alert("Registre completat correctament!");
      window.location.href = "dashboard.html";

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
// CREATE ACTIVITY (ADMIN)
// ==========================

const createBtn = document.getElementById("createActivity");

if (createBtn) {
  createBtn.addEventListener("click", async () => {
    const lloc = document.getElementById("lloc").value;
const data = document.getElementById("data").value;
const horari = document.getElementById("horari").value;
const professor = document.getElementById("professor").value;
const disciplina = document.getElementById("disciplina").value;
const nivell = document.getElementById("nivell").value;
const spots = parseInt(document.getElementById("spots").value);

if (!lloc || !data || !horari || !professor || !disciplina || !nivell || !spots) {
  alert("Omple tots els camps!");
  return;
}

await addDoc(collection(db, "activities"), {
  type: "master",
  lloc,
  data: new Date(data),
  horari,
  professor,
  disciplina,
  nivell,
  spots_total: spots,
  spots_remaining: spots,
  visible: true,
  createdAt: new Date()
});

    alert("Activitat creada correctament!");
  });
}

// ==========================
// LOAD PARTICIPANTS (ADMIN) + VISIBILITAT
// ==========================
async function loadParticipants() {
  const container = document.getElementById("participantsContainer");
  if (!container) return;

  container.innerHTML = "";

  const activitiesSnap = await getDocs(collection(db, "activities"));

  for (const activityDoc of activitiesSnap.docs) {
    const activityData = activityDoc.data();
    const activityId = activityDoc.id;

    const div = document.createElement("div");
    div.style.border = "1px solid #ccc";
    div.style.padding = "10px";
    div.style.marginBottom = "10px";
    div.style.borderRadius = "6px";
    div.style.backgroundColor = "#f9f9f9";

    div.innerHTML = `<h3>${activityData.title} (${activityData.spots_remaining}/${activityData.spots_total} places left)</h3>`;

    // === Checkbox de visibilitat ===
    const visibleCheckbox = document.createElement("input");
    visibleCheckbox.type = "checkbox";
    visibleCheckbox.checked = activityData.visible;
    visibleCheckbox.style.marginLeft = "10px";

    const label = document.createElement("label");
    label.textContent = "Visible per usuaris";
    label.style.marginLeft = "5px";
    label.prepend(visibleCheckbox);

    div.appendChild(label);

    // Quan es canvia, actualitzem Firestore
    visibleCheckbox.addEventListener("change", async () => {
      await updateDoc(doc(db, "activities", activityId), {
        visible: visibleCheckbox.checked
      });
      alert(`Activitat ${visibleCheckbox.checked ? "visible" : "invisible"} per usuaris`);
    });

    // Busquem les reserves d’aquesta activitat
    const reservationsSnap = await getDocs(
      query(collection(db, "reservations"), where("activityId", "==", activityId))
    );

    if (reservationsSnap.empty) {
      div.innerHTML += `<p>No participants yet</p>`;
    } else {
      const ul = document.createElement("ul");
      for (const resDoc of reservationsSnap.docs) {
        const resData = resDoc.data();
        const userDoc = await getDoc(doc(db, "users", resData.userId));
        const userData = userDoc.data();
        const li = document.createElement("li");
        li.textContent = `${userData.nom} ${userData.cognoms} - ${userData.escola}`;
        ul.appendChild(li);
      }
      div.appendChild(ul);
    }

    container.appendChild(div);
  }
}

if (window.location.pathname.includes("admin")) {
  loadParticipants();
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
  if (!user) {
    alert("Fes login primer!");
    return false;
  }

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

      transaction.update(activityRef, {
        spots_remaining: data.spots_remaining - 1
      });

      transaction.set(doc(reservationsRef), {
        userId: user.uid,
        userEmail: user.email,
        activityId,
        createdAt: new Date()
      });
    });

    return true;

  } catch (err) {
    alert(err);
    return false;
  }
}


async function loadMyReservations() {
  const user = auth.currentUser;
  if (!user) return;

  const container = contentArea;
  if (!container) return;

  container.innerHTML = ""; // neteja abans

  const reservationsSnap = await getDocs(
    query(collection(db, "reservations"), where("userId", "==", user.uid))
  );

  if (reservationsSnap.empty) {
    container.innerHTML = "<p>No tens cap reserva.</p>";
    return;
  }

  for (const resDoc of reservationsSnap.docs) {
    const resData = resDoc.data();
    const activitySnap = await getDoc(doc(db, "activities", resData.activityId));
    if (!activitySnap.exists()) continue;

    const activity = activitySnap.data();

    // Crear div reserva simple
    const div = document.createElement("div");
    div.style.border = "1px solid #ccc";
    div.style.padding = "10px";
    div.style.margin = "10px 0";
    div.style.borderRadius = "6px";

    div.innerHTML = `
      <h4>${activity.title}</h4>
      <p>${new Date(activity.date.toDate ? activity.date.toDate() : activity.date).toLocaleString()}</p>
    `;

    container.appendChild(div);
  }
}

// ==========================
// TAB SYSTEM
// ==========================

const contentArea = document.getElementById("contentArea");
const tabButtons = document.querySelectorAll(".tab-btn");

if (tabButtons.length > 0) {
  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      tabButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const tab = btn.dataset.tab;

      if (tab === "master") {
        loadActivitiesByType("master");
      } else if (tab === "foto") {
        loadActivitiesByType("foto");
      } else if (tab === "reserves") {
        loadMyReservations();
      }
    });
  });

  // Carrega Master per defecte
  loadActivitiesByType("master");
}

async function loadActivitiesByType(type) {
  if (!contentArea) return;

  contentArea.innerHTML = "";

  const q = query(
    collection(db, "activities"),
    where("type", "==", type),
    where("visible", "==", true)
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    contentArea.innerHTML = "<p>No hi ha activitats disponibles.</p>";
    return;
  }

  if (type === "master") {
    const grid = document.createElement("div");
    grid.className = "master-grid";

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();

      const dateFormatted = new Date(
        data.date.toDate ? data.date.toDate() : data.data
      ).toLocaleDateString("ca-ES");

      const card = document.createElement("div");
      card.className = "master-card";

      card.innerHTML = `
        <div class="master-discipline">${data.disciplina || "Disciplina"}</div>
        <div class="master-professor">${data.professor || "Professor"}</div>

        <div class="master-info">
          <div class="master-info-item">
            <span>Data</span>
            <strong>${dateFormatted}</strong>
          </div>

          <div class="master-info-item">
            <span>Horari</span>
            <strong>${data.horari || "-"}</strong>
          </div>

          <div class="master-info-item">
            <span>Nivell</span>
            <strong>${data.nivell || "-"}</strong>
          </div>

          <div class="master-info-item">
            <span>Lloc</span>
            <strong>${data.lloc || "-"}</strong>
          </div>
        </div>

        <div class="master-footer">
          <div class="master-spots">
            ${data.spots_remaining} places disponibles
          </div>
          <button class="btn master-btn">Reservar</button>
        </div>
      `;

      const button = card.querySelector("button");

      if (data.spots_remaining <= 0) {
        button.disabled = true;
        button.textContent = "Complet";
      } else {
        button.addEventListener("click", async () => {
        button.disabled = true;
      
        const success = await reserve(docSnap.id);
      
        if (success) {
          const spotsDiv = card.querySelector(".master-spots");
          let currentSpots = parseInt(spotsDiv.textContent);
      
          currentSpots -= 1;
      
          if (currentSpots <= 0) {
            spotsDiv.textContent = "0 places disponibles";
            button.textContent = "Complet";
            button.disabled = true;
          } else {
            spotsDiv.textContent = `${currentSpots} places disponibles`;
            button.disabled = false;
          }
      
        } else {
          button.disabled = false;
        }
      });
      }

      grid.appendChild(card);
    });

    contentArea.appendChild(grid);
  }
}

const adminTabs = document.querySelectorAll(".admin-tab");

adminTabs.forEach(tab => {
  tab.addEventListener("click", () => {

    adminTabs.forEach(t => t.classList.remove("active"));
    tab.classList.add("active");

    document.querySelectorAll(".admin-view").forEach(view => {
      view.classList.remove("active");
    });

    const target = tab.dataset.adminTab;

    if (target === "create") {
      document.getElementById("adminCreateView").classList.add("active");
    }

    if (target === "manage") {
      document.getElementById("adminManageView").classList.add("active");
      loadAdminActivities();
    }

  });
});

async function loadAdminActivities() {

  const container = document.getElementById("adminActivitiesGrid");
  if (!container) return;

  container.innerHTML = "";

  const snapshot = await getDocs(collection(db, "activities"));

  for (const docSnap of snapshot.docs) {

    const data = docSnap.data();
    const activityId = docSnap.id;

    const card = document.createElement("div");
    card.className = "admin-activity-card";

    const formattedDate = new Date(
      data.data?.toDate ? data.data.toDate() : data.data
    ).toLocaleDateString("ca-ES");

    card.innerHTML = `
      <div class="admin-activity-header">
        <div class="admin-activity-title">
          ${data.disciplina} - ${data.professor}
        </div>
        <div class="admin-activity-meta">
          ${formattedDate} | ${data.horari} | ${data.lloc}
        </div>
        <div class="admin-activity-meta">
          ${data.spots_remaining}/${data.spots_total} places
        </div>
      </div>

      <div class="admin-participants">
        <h4>Participants</h4>
        <ul id="participants-${activityId}"></ul>
      </div>
    `;

    container.appendChild(card);

    // Carregar participants
    const reservationsSnap = await getDocs(
      query(collection(db, "reservations"), where("activityId", "==", activityId))
    );

    const list = document.getElementById(`participants-${activityId}`);

    if (reservationsSnap.empty) {
      list.innerHTML = "<li>Cap participant</li>";
    } else {
      for (const resDoc of reservationsSnap.docs) {
        const userDoc = await getDoc(doc(db, "users", resDoc.data().userId));
        if (!userDoc.exists()) continue;

        const u = userDoc.data();
        const li = document.createElement("li");
        li.textContent = `${u.nom} ${u.cognoms} - ${u.escola}`;
        list.appendChild(li);
      }
    }
  }
}
