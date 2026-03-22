// ==========================
// APP VERSION CONTROL
// ==========================

const APP_VERSION = "1.0.4";

const storedVersion = localStorage.getItem("app_version");

if (storedVersion && storedVersion !== APP_VERSION) {
  localStorage.setItem("app_version", APP_VERSION);
  location.reload(true);
} else {
  localStorage.setItem("app_version", APP_VERSION);
}

// ==========================
// FIREBASE IMPORTS
// ==========================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  sendEmailVerification,
  reload
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
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
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

const PAYMENT_INFO = {
  ibanMasked: "",
  ibanFull: "",
  holder: "CAPITAL DANCE VIC"
};

const PHOTO_PRICES = {
  solo: 0,   // ← canvia-ho quan et passin preus
  duo: 0,
  trio: 0
};

const PHOTO_DAYS = [
  { key: "2026-03-27", label: "27 març", start: "10:00", end: "21:00" },
  { key: "2026-03-28", label: "28 març", start: "10:00", end: "21:00" },
  { key: "2026-03-29", label: "29 març", start: "10:00", end: "18:00" }
];

const PHOTO_TYPES = ["solo", "duo", "trio"];

let activePhotoDay = "2026-03-27";
let activePhotoType = "solo";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const PHOTO_SETTINGS_DOC_ID = "general";

// ==========================
// DISCIPLINE FILTER (DASHBOARD)
// ==========================

const PRIMARY_DISCS = new Set(["Clàssic", "Contemporani", "Jazz"]);
let activeDiscFilter = "all"; // all | Clàssic | Contemporani | Jazz
let disciplineFilterInitDone = false;

function setDisciplineBarVisible(isVisible) {
  const bar = document.getElementById("disciplineFilterBar");
  if (!bar) return;
  bar.style.display = isVisible ? "flex" : "none";
}

function initDisciplineFilters() {
  if (disciplineFilterInitDone) return; // evita doble binding
  const bar = document.getElementById("disciplineFilterBar");
  if (!bar) return;

  disciplineFilterInitDone = true;

  bar.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-disc]");
    if (!btn) return;

    activeDiscFilter = btn.dataset.disc || "all";

    bar.querySelectorAll(".disc-filter-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    // només recarreguem Master
    loadActivitiesByType("master");
  });
}

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
    const userData = userDoc.data();
    const path = window.location.pathname;
    const isDashboard = path.includes("dashboard");
    const isAdminPage = path.includes("admin");

    const params = new URLSearchParams(window.location.search);
    const adminUserView = params.get("view") === "user"; // dashboard.html?view=user

    if (role === "admin") {
      // Admin per defecte: admin.html
      // EXCEPCIÓ: si està a dashboard amb ?view=user, el deixem (vista usuari)
      if (isDashboard && !adminUserView) {
        window.location.href = "admin.html";
        return;
      }

      if (isAdminPage) {
        // OK: estic a admin
        return;
      }

      // Si admin està en qualsevol altra pàgina (ex: index), envia'l a admin
      if (!isDashboard) {
        window.location.href = "admin.html";
        return;
      }
    } else {
      // Usuari normal: dashboard.html
      if (!isDashboard) {
        window.location.href = "dashboard.html";
        return;
      }
    }

    // Mostrar botó "Tornar a Admin" només si sóc admin i estic a dashboard en vista usuari
    if (role === "admin" && isDashboard && adminUserView) {
      const userArea = document.querySelector(".user-area");

      if (userArea && !document.getElementById("backToAdminBtn")) {
        const backBtn = document.createElement("button");
        backBtn.id = "backToAdminBtn";
        backBtn.className = "logout-btn";
        backBtn.textContent = "Tornar a Admin";

        backBtn.addEventListener("click", () => {
          window.location.href = "admin.html";
        });

        // el posem abans de "Tancar sessió" si existeix
        const logoutBtn = document.getElementById("logoutBtn");
        if (logoutBtn) userArea.insertBefore(backBtn, logoutBtn);
        else userArea.appendChild(backBtn);
      }
    }

    // Pintar nom i cognoms al header si existeix l’element (dashboard)
    const userFullNameEl = document.getElementById("userFullName");
    if (userFullNameEl) {
      const nom = (userData.nom || "").trim();
      const cognoms = (userData.cognoms || "").trim();
      userFullNameEl.textContent = `${nom} ${cognoms}`.trim() || userData.email || "Usuari";
    }

    if (window.location.pathname.includes("admin") && role !== "admin") {
      // Usuari normal no pot accedir a admin
      alert("No tens permisos per accedir a aquesta pàgina");
      window.location.href = "dashboard.html";
    }

    if (window.location.pathname.includes("dashboard")) {
      await updatePriceHeader();

      initDisciplineFilters();

      const activeBtn = document.querySelector(".tab-btn.active");
      const activeTab = activeBtn?.dataset?.tab || "master";

      setDisciplineBarVisible(activeTab === "master");

      if (activeTab === "reserves") {
        loadMyReservations();
      } else if (activeTab === "foto") {
        loadPhotoStudioGrid();
      } else {
        loadActivitiesByType("master");
      }
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

const goDashboardBtn = document.getElementById("goDashboardBtn");
if (goDashboardBtn) {
  goDashboardBtn.addEventListener("click", () => {
    window.location.href = "dashboard.html?view=user";
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
      const password2 = document.getElementById("registerPassword2").value;

      if (!nom || !cognoms || !escola || !email || !password) {
	    showToast("Omple tots els camps", "error");
        return;
      }

      if (password !== password2) {
        showToast("Les contrasenyes no coincideixen.", "error");
        document.getElementById("registerPassword").value = "";
        document.getElementById("registerPassword2").value = "";
        return;
      }

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Primer guardem a Firestore
      await setDoc(doc(db, "users", user.uid), {
        nom,
        cognoms,
        escola,
        email,
        role: "user",
        createdAt: new Date()
      });

      // Després enviem verificació
      await sendEmailVerification(user);

      showToast("T'hem enviat un correu de confirmació. Revisa la safata d'entrada (i spam).", "success");

      // Forcem logout fins que verifiqui
      await signOut(auth);

      setTimeout(() => {
        window.location.href = "index.html";
      }, 900);

	  showToast("Registre completat! Entrant a la web de reserves…", "success");
	  setTimeout(() => {
	    window.location.href = "dashboard.html";
	  }, 600);

    } catch (err) {
      console.error(err);
	  const code = err?.code || "";
	  const map = {
	    "auth/email-already-in-use": "Aquest correu ja està registrat",
	    "auth/invalid-email": "Correu electrònic no vàlid",
	    "auth/weak-password": "La contrasenya és massa feble (mínim 6 caràcters)",
	    "auth/network-request-failed": "Error de xarxa. Torna-ho a provar"
	  };
	  showToast(map[code] || "No s'ha pogut completar el registre", "error");
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
	    showToast("Omple tots els camps", "error");
        return;
      }

	  await signInWithEmailAndPassword(auth, email, password);
	  showToast("Benvingut/da! Entrant a la web de reserves…", "success");
	  setTimeout(() => {
	    window.location.href = "dashboard.html";
	  }, 450);
    } catch (err) {
      console.error(err);
	  const code = err?.code || "";
	  const map = {
	    "auth/invalid-email": "Correu electrònic no vàlid",
	    "auth/user-not-found": "No existeix cap compte amb aquest correu",
	    "auth/wrong-password": "Contrasenya incorrecta",
	    "auth/invalid-credential": "Credencials incorrectes",
	    "auth/too-many-requests": "Massa intents. Torna-ho a provar més tard",
	    "auth/network-request-failed": "Error de xarxa. Torna-ho a provar"
	  };
	  showToast(map[code] || "No s'ha pogut iniciar sessió", "error");
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
      showToast("Omple tots els camps!", "error");
      return;
    }

    try {

  if (editingActivityId) {

    await updateDoc(doc(db, "activities", editingActivityId), {
      lloc,
      date: new Date(data),
      horari,
      professor,
      disciplina,
      nivell,
      spots_total: spots
    });

    showToast("Activitat actualitzada correctament ✏️", "success");

    resetCreateMode();
    document.querySelector('[data-admin-tab="manage"]').click();

  } else {

    await addDoc(collection(db, "activities"), {
      type: "master",
      lloc,
      date: new Date(data),
      horari,
      professor,
      disciplina,
      nivell,
      spots_total: spots,
      spots_remaining: spots,
      visible: true,
      isOpen: true,
      createdAt: new Date()
    });

    showToast("Activitat creada correctament ✅", "success");
  }

    } catch (err) {
      console.error(err);
      showToast("Error en guardar l'activitat.", "error");
    }
  });
}

const cancelEditBtn = document.getElementById("cancelEditBtn");

if (cancelEditBtn) {
  cancelEditBtn.addEventListener("click", () => {
    resetCreateMode();
    showToast("Edició cancel·lada.", "success");
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
		const emailSpan = document.createElement("span");
		emailSpan.className = "participant-email";
		emailSpan.textContent = ` (${userData.email})`;
		
		li.appendChild(emailSpan);
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

function showToast(message, variant = "success") {
  let container = document.getElementById("toastContainer");

  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast ${variant}`;
  toast.textContent = message;

  container.appendChild(toast);

  // entrada suau
  requestAnimationFrame(() => toast.classList.add("show"));

  // surt automàticament
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 2200);
}

function priceForIndex(i) {
  if (i === 0) return 25;
  if (i === 1) return 20;
  return 15;
}

function isPrimaryDisciplineName(disciplina) {
  const disc = (disciplina || "").trim();
  return disc === "Jazz" || disc === "Contemporani" || disc === "Clàssic";
}

function getActivityPriceByDiscipline(disciplina, paidIndex) {
  return isPrimaryDisciplineName(disciplina) ? priceForIndex(paidIndex) : 0;
}

function totalForCount(n) {
  let total = 0;
  for (let i = 0; i < n; i++) total += priceForIndex(i);
  return total;
}

function toJsDate(v) {
  if (!v) return null;
  return typeof v.toDate === "function" ? v.toDate() : new Date(v);
}

function timeToMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(total) {
  const h = String(Math.floor(total / 60)).padStart(2, "0");
  const m = String(total % 60).padStart(2, "0");
  return `${h}:${m}`;
}

function buildQuarterSlots(start, end) {
  const result = [];
  const startMin = timeToMinutes(start);
  const endMin = timeToMinutes(end);

  for (let t = startMin; t < endMin; t += 15) {
    result.push(minutesToTime(t));
  }

  return result;
}

async function getPhotoGlobalSettings() {
  const ref = doc(db, "photoSettings", PHOTO_SETTINGS_DOC_ID);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, { isOpen: true });
    return { isOpen: true };
  }

  return snap.data();
}

async function setPhotoGlobalOpenState(isOpen) {
  const ref = doc(db, "photoSettings", PHOTO_SETTINGS_DOC_ID);
  await setDoc(ref, { isOpen }, { merge: true });
}

async function updatePriceHeader() {
  const el = document.getElementById("priceSummary");
  if (!el) return;

  const user = auth.currentUser;
  if (!user) { el.innerHTML = ""; return; }

  const snap = await getDocs(
    query(collection(db, "reservations"), where("userId", "==", user.uid))
  );

  let paidReservationsCount = 0;

  for (const resDoc of snap.docs) {
    const r = resDoc.data();
    const activitySnap = await getDoc(doc(db, "activities", r.activityId));
    if (!activitySnap.exists()) continue;

    const a = activitySnap.data();
    if (isPrimaryDisciplineName(a.disciplina)) {
      paidReservationsCount++;
    }
  }

  const total = totalForCount(paidReservationsCount);
  const next = priceForIndex(paidReservationsCount);

  el.innerHTML = `
  <div class="price-main">
    <span>Total:</span>
    <strong class="total-amount">${total}€</strong>
    <span class="divider">·</span>
    <span>Propera reserva:</span>
    <strong>${next}€</strong>
  </div>

  <div class="price-packs">
    <span>Individual 25€</span>
    <span>Pack 2: 45€</span>
    <span>Pack 3: 60€</span>
  </div>
`;
}

async function ensurePhotoTimeSlotsSeeded() {
  const existingSnap = await getDocs(collection(db, "photoTimeSlots"));
  if (!existingSnap.empty) return;

  for (const day of PHOTO_DAYS) {
    for (let t = timeToMinutes(day.start); t < timeToMinutes(day.end); t += 15) {
      const time = minutesToTime(t);
      const hourStart = Math.floor(t / 60) * 60;
      const hourLabel = minutesToTime(hourStart);

      await addDoc(collection(db, "photoTimeSlots"), {
        dateKey: day.key,
        time,
        hourLabel,
        visible: true,
        isOpen: true,
        createdAt: new Date()
      });
    }
  }
}

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

      const paymentRef = `CDV-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

      transaction.set(doc(reservationsRef), {
        userId: user.uid,
        userEmail: user.email,
        activityId,
        createdAt: new Date(),
        paymentStatus: "pending",
        paymentRef
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
  if (!user || !contentArea) return;

  contentArea.innerHTML = "";

  // reserves de l'usuari
  const reservationsSnap = await getDocs(
    query(collection(db, "reservations"), where("userId", "==", user.uid))
  );

  const photoBookingsSnap = await getDocs(
    query(collection(db, "photoTimeBookings"), where("userId", "==", user.uid))
  );

  const resDocs = reservationsSnap.docs.slice().sort((a,b) => {
    const da = toJsDate(a.data().createdAt) || new Date(0);
    const db = toJsDate(b.data().createdAt) || new Date(0);
    return da - db;
  });

  if (resDocs.length === 0 && photoBookingsSnap.empty) {
    contentArea.innerHTML = "<p>No tens cap reserva.</p>";
    return;
  }

  const grid = document.createElement("div");
  grid.className = "master-grid reservations-grid";

  let paidIndex = 0;

  for (const resDoc of resDocs) {
    const resData = resDoc.data();

    const activitySnap = await getDoc(doc(db, "activities", resData.activityId));
    if (!activitySnap.exists()) continue;

    const a = activitySnap.data();

    const unitPrice = getActivityPriceByDiscipline(a.disciplina, paidIndex);

    if (isPrimaryDisciplineName(a.disciplina)) {
      paidIndex++;
    }

    // data robusta
    const rawDate = a.date ?? a.data;
    let dateFormatted = "-";
    if (rawDate) {
      const jsDate = typeof rawDate.toDate === "function" ? rawDate.toDate() : new Date(rawDate);
      dateFormatted = jsDate.toLocaleDateString("ca-ES");
    }

    const card = document.createElement("div");
    card.className = "master-card reservation-card";

    card.innerHTML = `
      <div class="master-discipline">${a.disciplina || (a.type === "foto" ? "Fotografia" : "Activitat")}</div>
      <div class="master-professor">${a.professor || "—"}</div>

      <div class="master-info">
        <div class="master-info-item">
          <span>Data</span>
          <strong>${dateFormatted}</strong>
        </div>

        <div class="master-info-item">
          <span>Horari</span>
          <strong>${a.horari || "-"}</strong>
        </div>

        <div class="master-info-item">
          <span>Nivell</span>
          <strong>${a.nivell || "-"}</strong>
        </div>

        <div class="master-info-item">
          <span>Lloc</span>
          <strong>${a.lloc || "-"}</strong>
        </div>
      </div>

      <div class="master-footer">
      <div>
        <div class="reservation-status pending">
          ⏳ Pendent de pagament. S’ha d’abonar en efectiu el dia de la MasterClass
        </div>

        <div class="reservation-price">
          Preu: <strong>${unitPrice}€</strong>
        </div>
      </div>

      <button class="btn master-btn cancel-btn">Cancel·lar</button>
    </div>
    `;

    const cancelBtn = card.querySelector(".cancel-btn");
    const payBtn = card.querySelector(".payment-btn");
    if (payBtn) {
      const paymentRef = resData.paymentRef || "-";
      payBtn.addEventListener("click", () => openPaymentModal(paymentRef));
    }
    cancelBtn.addEventListener("click", async () => {
      cancelBtn.disabled = true;
      cancelBtn.textContent = "Cancel·lant...";

      const ok = await cancelReservation(resDoc.id, resData.activityId);

      if (ok) {
        await updatePriceHeader();
        showToast("Reserva cancel·lada ✅", "success");

        // Fade out i treu la card
        card.classList.add("fade-out");
        setTimeout(() => {
          card.remove();

          // Si ja no queda cap reserva, mostra missatge
          if (!grid.querySelector(".reservation-card")) {
            contentArea.innerHTML = "<p>No tens cap reserva.</p>";
          }
        }, 280);

      } else {
        showToast("No s'ha pogut cancel·lar la reserva.", "error");
        cancelBtn.disabled = false;
        cancelBtn.textContent = "Cancel·lar";
      }
    });

    grid.appendChild(card);
  }

  for (const photoDoc of photoBookingsSnap.docs) {
  const p = photoDoc.data();

  const photoCard = document.createElement("div");
  photoCard.className = "master-card reservation-card photo-reservation-card";

  const dayLabel =
    p.dateKey === "2026-03-27" ? "27 març" :
    p.dateKey === "2026-03-28" ? "28 març" :
    p.dateKey === "2026-03-29" ? "29 març" :
    p.dateKey;

  photoCard.innerHTML = `
    <div class="master-discipline">Fotografia d'estudi</div>
    <div class="master-professor">${(p.category || "-").toUpperCase()}</div>

    <div class="master-info">
      <div class="master-info-item">
        <span>Dia</span>
        <strong>${dayLabel}</strong>
      </div>

      <div class="master-info-item">
        <span>Hora</span>
        <strong>${p.time || "-"}</strong>
      </div>

      <div class="master-info-item">
        <span>Categoria</span>
        <strong>${p.category || "-"}</strong>
      </div>

      <div class="master-info-item">
        <span>Preu</span>
        <strong>${p.price ?? 0}€</strong>
      </div>
    </div>

    <div class="master-footer">
      <div class="reservation-status pending">
        ⏳ Pendent de pagament. S’ha d’abonar en efectiu el dia de la Sessió Fotogràfica
      </div>

      <button class="btn master-btn cancel-photo-btn">Cancel·lar</button>
    </div>
  `;

  const cancelPhotoBtn = photoCard.querySelector(".cancel-photo-btn");
  cancelPhotoBtn.addEventListener("click", async () => {
    cancelPhotoBtn.disabled = true;
    cancelPhotoBtn.textContent = "Cancel·lant...";

    const ok = await cancelPhotoTimeBooking(photoDoc.id);

    if (ok) {
      showToast("Reserva de fotografia cancel·lada ✅", "success");
      photoCard.classList.add("fade-out");

      setTimeout(() => {
        photoCard.remove();

        if (!grid.querySelector(".reservation-card")) {
          contentArea.innerHTML = "<p>No tens cap reserva.</p>";
        }
      }, 280);
    } else {
      cancelPhotoBtn.disabled = false;
      cancelPhotoBtn.textContent = "Cancel·lar";
    }
  });

  grid.appendChild(photoCard);
}

  contentArea.appendChild(grid);
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
      setDisciplineBarVisible(tab === "master");

      if (tab === "master") {
        loadActivitiesByType("master");
      } else if (tab === "foto") {
        loadPhotoStudioGrid();
      } else if (tab === "reserves") {
        loadMyReservations();
      }
    });
  });
}

async function getMyReservationMap() {
  const user = auth.currentUser;
  const map = new Map(); // activityId -> reservationDocId
  if (!user) return map;

  const snap = await getDocs(
    query(collection(db, "reservations"), where("userId", "==", user.uid))
  );

  snap.forEach((d) => {
    const r = d.data();
    if (r?.activityId) map.set(r.activityId, d.id);
  });

  return map;
}

async function getMyWaitlistMap() {
  const user = auth.currentUser;
  const map = new Map(); // activityId -> waitlistDocId
  if (!user) return map;

  const snap = await getDocs(
    query(collection(db, "waitlist"), where("userId", "==", user.uid))
  );

  snap.forEach((d) => {
    const w = d.data();
    if (w?.activityId) map.set(w.activityId, d.id);
  });

  return map;
}

async function cancelReservation(reservationId, activityId) {
  const user = auth.currentUser;
  if (!user) {
    alert("Has d'iniciar sessió.");
    return false;
  }

  const reservationRef = doc(db, "reservations", reservationId);
  const activityRef = doc(db, "activities", activityId);

  try {
    await runTransaction(db, async (transaction) => {
      // 1) Validar reserva
      const resSnap = await transaction.get(reservationRef);
      if (!resSnap.exists()) throw "Reserva no trobada.";

      const resData = resSnap.data();
      if (resData.userId !== user.uid) throw "No tens permisos per cancel·lar aquesta reserva.";

      // 2) Llegir activitat
      const actSnap = await transaction.get(activityRef);
      if (!actSnap.exists()) throw "Activitat no trobada.";

      const a = actSnap.data();

      const currentRemaining = Number(a.spots_remaining ?? 0);
      const total = Number(a.spots_total ?? currentRemaining);

      // 3) Alliberar 1 plaça (sense passar del total)
      const nextRemaining = Math.min(total, currentRemaining + 1);

      // 4) Esborrar la reserva
      transaction.delete(reservationRef);

      // 5) Intentar promoure la 1a persona de la waitlist (ordre d'arribada)
      // IMPORTANT: només si hi ha plaça (nextRemaining > 0)
      if (nextRemaining > 0) {
        const waitQ = query(
          collection(db, "waitlist"),
          where("activityId", "==", activityId),
          where("status", "==", "waiting"),
          orderBy("createdAt", "asc"),
          limit(1)
        );

        const waitSnap = await getDocs(waitQ);

        if (!waitSnap.empty) {
          const firstWaitDoc = waitSnap.docs[0];
          const firstWaitData = firstWaitDoc.data();
          const promotedUserId = firstWaitData.userId;

          // Evitar duplicat: si ja té reserva (per seguretat)
          const dupQ = query(
            collection(db, "reservations"),
            where("activityId", "==", activityId),
            where("userId", "==", promotedUserId)
          );
          const dupSnap = await getDocs(dupQ);

          if (dupSnap.empty) {
            // Crear reserva per la persona promoguda
            const newResRef = doc(collection(db, "reservations"));
            transaction.set(newResRef, {
              userId: promotedUserId,
              activityId,
              createdAt: new Date(),
              promotedFromWaitlist: true
            });

            // Treure'l de la waitlist
            transaction.delete(doc(db, "waitlist", firstWaitDoc.id));

            // I “consumir” la plaça que havíem alliberat
            transaction.update(activityRef, {
              spots_remaining: nextRemaining - 1
            });
          } else {
            // Si ja tenia reserva, mantenim la plaça alliberada normal
            transaction.update(activityRef, { spots_remaining: nextRemaining });
          }

          return;
        }
      }

      // Si no hi ha waitlist o no hi ha plaça, només actualitzem spots_remaining
      transaction.update(activityRef, { spots_remaining: nextRemaining });
    });

    return true;
  } catch (err) {
    console.error(err);
    alert(err);
    return false;
  }
}

async function adminRemoveParticipant(reservationId, activityId) {
  const activityRef = doc(db, "activities", activityId);
  const reservationRef = doc(db, "reservations", reservationId);

  try {
    await runTransaction(db, async (transaction) => {
      const resSnap = await transaction.get(reservationRef);
      if (!resSnap.exists()) throw "Reserva no trobada";

      const actSnap = await transaction.get(activityRef);
      if (!actSnap.exists()) throw "Activitat no trobada";

      const a = actSnap.data();
      const currentRemaining = Number(a.spots_remaining ?? 0);
      const total = Number(a.spots_total ?? currentRemaining);

      // esborrem la reserva
      transaction.delete(reservationRef);

      // alliberem plaça (sense passar del total)
      const nextRemaining = Math.min(total, currentRemaining + 1);
      transaction.update(activityRef, { spots_remaining: nextRemaining });
    });

    return true;
  } catch (err) {
    console.error(err);
    alert(err);
    return false;
  }
}

async function joinWaitlist(activityId) {
  const user = auth.currentUser;
  if (!user) {
    showToast("Has d'iniciar sessió.", "error");
    return false;
  }

  try {
    const waitlistRef = collection(db, "waitlist");

    // Quanta gent hi ha actualment?
    const snap = await getDocs(
      query(waitlistRef, where("activityId", "==", activityId))
    );

    if (snap.size >= 5) {
      showToast("La llista d'espera està completa.", "error");
      return false;
    }

    // Evitar duplicats
    const existing = snap.docs.find(d => d.data().userId === user.uid);
    if (existing) return true;

    await addDoc(waitlistRef, {
      activityId,
      userId: user.uid,
      createdAt: new Date(),
      status: "waiting"
    });

    return true;

  } catch (err) {
    console.error(err);
    showToast("No s'ha pogut entrar a la llista d'espera.", "error");
    return false;
  }
}

async function getMyPhotoTimeBookingMap() {
  const user = auth.currentUser;
  const map = new Map(); // slotId -> bookingDocId
  if (!user) return map;

  const snap = await getDocs(
    query(collection(db, "photoTimeBookings"), where("userId", "==", user.uid))
  );

  snap.forEach((d) => {
    const b = d.data();
    if (b?.slotId) map.set(b.slotId, d.id);
  });

  return map;
}

async function reservePhotoTimeSlot(slotId, category) {
  const user = auth.currentUser;
  if (!user) {
    showToast("Has d'iniciar sessió.", "error");
    return false;
  }

  const photoSettings = await getPhotoGlobalSettings();
  if (photoSettings.isOpen === false) {
    showToast("Les reserves de fotografia estan tancades.", "error");
    return false;
  }

  try {
    const slotSnap = await getDoc(doc(db, "photoTimeSlots", slotId));
    if (!slotSnap.exists()) {
      showToast("Aquesta franja ja no existeix.", "error");
      return false;
    }

    const slotData = slotSnap.data();

    if (slotData.isOpen === false || slotData.visible === false) {
      showToast("Aquesta franja no està disponible.", "error");
      return false;
    }

    const existingForSlot = await getDocs(
      query(collection(db, "photoTimeBookings"), where("slotId", "==", slotId))
    );

    if (!existingForSlot.empty) {
      showToast("Aquesta franja ja està reservada.", "error");
      return false;
    }

    await addDoc(collection(db, "photoTimeBookings"), {
      userId: user.uid,
      userEmail: user.email,
      slotId,
      dateKey: slotData.dateKey,
      time: slotData.time,
      hourLabel: slotData.hourLabel,
      category,
      price: PHOTO_PRICES[category] || 0,
      createdAt: new Date()
    });

    return true;
  } catch (err) {
    console.error(err);
    showToast("No s'ha pogut reservar la sessió de foto.", "error");
    return false;
  }
}

async function cancelPhotoTimeBooking(bookingId) {
  try {
    await deleteDoc(doc(db, "photoTimeBookings", bookingId));
    return true;
  } catch (err) {
    console.error(err);
    showToast("No s'ha pogut cancel·lar la reserva de fotografia.", "error");
    return false;
  }
}

function ensurePhotoReserveModal() {
  let modal = document.getElementById("photoReserveModal");
  if (modal) return modal;

  modal = document.createElement("div");
  modal.id = "photoReserveModal";
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="modal-card">
      <div class="modal-head">
        <div>
          <h3>Reservar fotografia d'estudi</h3>
          <p>Selecciona categoria i franja de 15 minuts</p>
        </div>
        <button type="button" class="modal-close" aria-label="Tancar">×</button>
      </div>

      <div class="modal-body">
        <div class="photo-modal-summary" id="photoModalSummary"></div>

        <div class="photo-modal-field">
          <label for="photoCategorySelect">Categoria</label>
          <select id="photoCategorySelect">
            <option value="solo">Solo</option>
            <option value="duo">Duo</option>
            <option value="trio">Trio</option>
          </select>
        </div>

        <div class="photo-modal-field">
          <label for="photoQuarterSelect">Franja</label>
          <select id="photoQuarterSelect"></select>
        </div>

        <div class="photo-modal-price" id="photoModalPrice"></div>

        <div class="modal-actions">
          <button type="button" class="btn primary" id="confirmPhotoReserveBtn">Reservar</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const close = () => modal.classList.remove("show");

  modal.addEventListener("click", (e) => {
    if (e.target === modal) close();
  });

  modal.querySelector(".modal-close").addEventListener("click", close);

  return modal;
}

function fillPhotoQuarterOptions(selectEl, slotDocs) {
  selectEl.innerHTML = "";

  slotDocs.forEach((slotDoc) => {
    const slot = slotDoc.data();
    const option = document.createElement("option");
    option.value = slotDoc.id;
    option.textContent = `${slot.time} - ${minutesToTime(timeToMinutes(slot.time) + 15)}`;
    selectEl.appendChild(option);
  });
}

function updatePhotoModalPrice(categorySelect, priceEl) {
  const value = categorySelect.value;
  priceEl.innerHTML = `Preu: <strong>${PHOTO_PRICES[value] || 0}€</strong>`;
}

function openPhotoReserveModal(dayLabel, hourLabel, slotDocs) {
  const modal = ensurePhotoReserveModal();

  const summaryEl = modal.querySelector("#photoModalSummary");
  const categorySelect = modal.querySelector("#photoCategorySelect");
  const quarterSelect = modal.querySelector("#photoQuarterSelect");
  const priceEl = modal.querySelector("#photoModalPrice");
  const confirmBtn = modal.querySelector("#confirmPhotoReserveBtn");

  summaryEl.innerHTML = `
    <strong>${dayLabel}</strong><br>
    Hora seleccionada: <strong>${hourLabel} - ${minutesToTime(timeToMinutes(hourLabel) + 60)}</strong>
  `;

  fillPhotoQuarterOptions(quarterSelect, slotDocs);
  updatePhotoModalPrice(categorySelect, priceEl);

  categorySelect.onchange = () => {
    updatePhotoModalPrice(categorySelect, priceEl);
  };

  confirmBtn.onclick = async () => {
    const slotId = quarterSelect.value;
    const category = categorySelect.value;

    confirmBtn.disabled = true;

    const ok = await reservePhotoTimeSlot(slotId, category);

    if (ok) {
      modal.classList.remove("show");
      showToast("Sessió de foto reservada ✅", "success");
      loadPhotoStudioGrid();
    } else {
      confirmBtn.disabled = false;
    }
  };

  requestAnimationFrame(() => modal.classList.add("show"));
}

async function loadPhotoStudioGrid() {
  if (!contentArea) return;

  contentArea.innerHTML = "";

  await ensurePhotoTimeSlotsSeeded();

  const photoSettings = await getPhotoGlobalSettings();

  const myBookingMap = await getMyPhotoTimeBookingMap();

  const wrapper = document.createElement("div");
  wrapper.className = "photo-timetable-wrapper";

  wrapper.innerHTML = `
    <div class="photo-timetable-intro">
      <h2>Fotografia d'estudi</h2>
      <p>
        ${photoSettings.isOpen === false
          ? "Les reserves de fotografia estan actualment tancades."
          : "Selecciona una hora i prem el botó + per escollir categoria i quart d'hora."}
      </p>
      <div class="photo-price-legend">
        <span>Solo: <strong>${PHOTO_PRICES.solo}€</strong></span>
        <span>Duo: <strong>${PHOTO_PRICES.duo}€</strong></span>
        <span>Trio: <strong>${PHOTO_PRICES.trio}€</strong></span>
      </div>
    </div>

    <div class="photo-timetable" id="photoTimetable"></div>
  `;

  contentArea.appendChild(wrapper);

  const timetable = wrapper.querySelector("#photoTimetable");

  const allSlotsSnap = await getDocs(collection(db, "photoTimeSlots"));
  const allBookingsSnap = await getDocs(collection(db, "photoTimeBookings"));

  const bookedSlotIds = new Set();
  allBookingsSnap.forEach((d) => {
    const b = d.data();
    if (b?.slotId) bookedSlotIds.add(b.slotId);
  });

  for (const day of PHOTO_DAYS) {
    const dayColumn = document.createElement("div");
    dayColumn.className = "photo-day-column";

    dayColumn.innerHTML = `
      <div class="photo-day-header">${day.label}</div>
    `;

    const hours = [];
    for (let t = timeToMinutes(day.start); t < timeToMinutes(day.end); t += 60) {
      hours.push(minutesToTime(t));
    }

    for (const hour of hours) {
      const hourSlotDocs = allSlotsSnap.docs
        .filter((docSnap) => {
          const s = docSnap.data();
          return s.dateKey === day.key && s.hourLabel === hour;
        })
        .sort((a, b) => a.data().time.localeCompare(b.data().time));

      const freeSlots = hourSlotDocs.filter((slotDoc) => {
        const slot = slotDoc.data();
        return !bookedSlotIds.has(slotDoc.id) && slot.visible !== false && slot.isOpen !== false;
      });

      const reservedCount = hourSlotDocs.length - freeSlots.length;
      const myCount = hourSlotDocs.filter(slotDoc => myBookingMap.has(slotDoc.id)).length;

      const quarterHtml = hourSlotDocs.map((slotDoc) => {
      const slot = slotDoc.data();
      const isMine = myBookingMap.has(slotDoc.id);
      const isTaken = bookedSlotIds.has(slotDoc.id);
      const isClosed = slot.visible === false || slot.isOpen === false;

      let cls = "free";
      let label = "Lliure";

      if (isMine) {
        cls = "mine";
        label = "La meva";
      } else if (isClosed) {
        cls = "closed";
        label = "Tancada";
      } else if (isTaken) {
        cls = "taken";
        label = "Reservada";
      }

      return `
        <div class="photo-quarter-pill ${cls}">
          <span>${slot.time}</span>
          <small>${label}</small>
        </div>
      `;
    }).join("");

      const card = document.createElement("div");
      card.className = "photo-hour-card";

      if (freeSlots.length === 0) card.classList.add("full");
      if (myCount > 0) card.classList.add("mine");

      card.innerHTML = `
        <div class="photo-hour-title">${hour} - ${minutesToTime(timeToMinutes(hour) + 60)}</div>
        <div class="photo-hour-meta">
          <span>Lliures: <strong>${freeSlots.length}/4</strong></span>
          <span>Reservades: <strong>${reservedCount}/4</strong></span>
        </div>

        <div class="photo-quarter-grid">
          ${quarterHtml}
        </div>

        <button class="photo-add-btn" type="button">+</button>
      `;

      const addBtn = card.querySelector(".photo-add-btn");

      if (freeSlots.length === 0 || photoSettings.isOpen === false) {
        addBtn.disabled = true;
      } else {
        addBtn.addEventListener("click", () => {
          openPhotoReserveModal(day.label, hour, freeSlots);
        });
      }

      dayColumn.appendChild(card);
    }

    timetable.appendChild(dayColumn);
  }
}

async function loadActivitiesByType(type) {
  if (!contentArea) return;

  contentArea.innerHTML = "";

  const q = query(
    collection(db, "activities"),
    where("type", "==", type),
    where("visible", "==", true)
  );

  const myResMap = await getMyReservationMap(); // activityId -> reservationId

  const myWaitlistMap = await getMyWaitlistMap(); // activityId -> waitlistDocId

  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    contentArea.innerHTML = "<p>No hi ha activitats disponibles.</p>";
    return;
  }

  if (type === "master") {
    const grid = document.createElement("div");

    const grouped = {
      "Clàssic": [],
      "Contemporani": [],
      "Jazz": []
    };

    grid.className = "master-grid";

    let paidReservationsCount = 0;

    for (const activityId of myResMap.keys()) {
      const activitySnap = await getDoc(doc(db, "activities", activityId));
      if (!activitySnap.exists()) continue;

      const a = activitySnap.data();
      if (isPrimaryDisciplineName(a.disciplina)) {
        paidReservationsCount++;
      }
    }

    for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    const disc = (data.disciplina || "Altres").trim();

    const cardPrice = getActivityPriceByDiscipline(disc, paidReservationsCount);

    if (activeDiscFilter !== "all") {
      const isPrimary = PRIMARY_DISCS.has(disc);
      const allow = (disc === activeDiscFilter) || (!isPrimary); // deixa passar "Global" i altres
      if (!allow) continue;
    }
    const isOpen = data.isOpen !== false;

    const rawDate = data.date ?? data.data;
    let dateFormatted = "-";
    if (rawDate) {
      const jsDate = typeof rawDate.toDate === "function" ? rawDate.toDate() : new Date(rawDate);
      dateFormatted = jsDate.toLocaleDateString("ca-ES");
    }

    // Si ja tinc reserva d'aquesta activitat, NO la mostrem a Master Class
    if (myResMap.has(docSnap.id)) continue;

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
        <div class="master-price">
          Preu: <strong>${cardPrice}€</strong>
        </div>
        <div class="waitlist-counter"></div>
        <button class="btn master-btn">Reservar</button>
      </div>
    `;

    const button = card.querySelector("button");

    if (!isOpen) {
      card.classList.add("activity-closed-card");

      button.textContent = "Activitat no disponible";
      button.disabled = true;

      const disciplina = data.disciplina || "Altres";

      if (!grouped[disciplina]) grouped[disciplina] = [];
      grouped[disciplina].push(card);
      grid.appendChild(card);
      continue;
    }

    // Comptar quanta gent hi ha a la waitlist d'aquesta activitat
    const waitSnap = await getDocs(
      query(
        collection(db, "waitlist"),
        where("activityId", "==", docSnap.id),
        where("status", "==", "waiting")
      )
    );

    const waitCount = waitSnap.size;

    const counterEl = card.querySelector(".waitlist-counter");
    if (counterEl) {
      counterEl.textContent = `${waitCount} / 5 en llista d'espera`;
    }

    if (data.spots_remaining <= 0) {

      card.classList.add("waitlist-card");

      // Si la llista ja està plena (5)
      if (waitCount >= 5) {
        card.classList.add("waitlist-full-card");
        button.textContent = "Llista d'espera completa";
        button.disabled = true;

        grid.appendChild(card);
        continue;
      }

      // Si ja hi soc → sortir
      if (myWaitlistMap.has(docSnap.id)) {

        const waitlistId = myWaitlistMap.get(docSnap.id);

        button.textContent = "Sortir de la llista";

        button.addEventListener("click", async () => {
          button.disabled = true;

          const ok = await leaveWaitlist(waitlistId);

          if (ok) {
            showToast("Has sortit de la llista d'espera.", "success");
            loadActivitiesByType("master");
          } else {
            button.disabled = false;
          }
        });

      } else {
        // Si no hi soc → entrar
        button.textContent = "Entrar a llista d'espera";

        button.addEventListener("click", async () => {
          button.disabled = true;

          const ok = await joinWaitlist(docSnap.id);

          if (ok) {
            showToast("Afegit a la llista d'espera 🕒", "success");
            loadActivitiesByType("master"); // recarrega per reflectir estat i límit 5
          } else {
            button.disabled = false;
          }
        });
      }

    } else {
      // Places disponibles → reservar
      button.addEventListener("click", async () => {
        button.disabled = true;

        const success = await reserve(docSnap.id);

        if (success) {
          await updatePriceHeader();
          showToast("Reserva confirmada ✅", "success");
          card.classList.add("fade-out");
          setTimeout(() => card.remove(), 280);
        } else {
          showToast("No s'ha pogut reservar (ja la tens o no queden places).", "error");
          button.disabled = false;
        }
      });
    }

    const disciplina = data.disciplina || "Altres";

    if (!grouped[disciplina]) grouped[disciplina] = [];
    grouped[disciplina].push(card);
    }

    Object.entries(grouped).forEach(([disciplina, cards]) => {

    if (cards.length === 0) return;

    const section = document.createElement("div");
    section.className = "discipline-section";

    const title = document.createElement("h2");
    title.className = "discipline-title";
    title.textContent = disciplina;

    const disciplineGrid = document.createElement("div");
    disciplineGrid.className = "master-grid";

    cards.forEach(card => disciplineGrid.appendChild(card));

    section.appendChild(title);
    section.appendChild(disciplineGrid);

    grid.appendChild(section);
  });

    contentArea.appendChild(grid);
  }
}

const adminTabs = document.querySelectorAll("[data-admin-tab]");

adminTabs.forEach(tab => {
  tab.addEventListener("click", async () => {

    adminTabs.forEach(t => t.classList.remove("active"));
    tab.classList.add("active");

    const view = tab.dataset.adminTab;

    if (editingActivityId && view !== "create") {
      resetCreateMode();
    }

    document.querySelectorAll(".admin-view")
      .forEach(v => v.classList.remove("active"));

    const target = document.getElementById(
      "admin" + view.charAt(0).toUpperCase() + view.slice(1) + "View"
    );

    if (target) target.classList.add("active");

    if (view === "manage") await loadAdminActivities();
    if (view === "photos") await loadAdminPhotoBookingsView();
    if (view === "waitlist") await loadAdminWaitlists();
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

    const rawDate = data.date ?? data.data;
    let dateFormatted = "-";

    if (rawDate) {
      const jsDate = typeof rawDate.toDate === "function"
        ? rawDate.toDate()
        : new Date(rawDate);

      dateFormatted = jsDate.toLocaleDateString("ca-ES");
    }

    card.innerHTML = `
      <div class="admin-activity-header">
        <div class="admin-activity-info">
          <div class="admin-activity-title">
            ${data.disciplina || "Activitat"} - ${data.professor || ""}
          </div>

          <div class="admin-activity-meta">
            ${dateFormatted} · ${data.horari || "-"} · ${data.lloc || "-"}
          </div>

          <div class="admin-activity-toggle">
            <label class="toggle-switch">
              <input type="checkbox" class="activity-open-checkbox" ${data.isOpen !== false ? "checked" : ""}>
              <span class="slider"></span>
              <span class="toggle-label">Activar / Desactivar</span>
            </label>
          </div>
        </div>

        <div class="admin-activity-actions">
          <button class="edit-activity-btn" aria-label="Editar activitat" title="Editar">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25Zm2.92 2.83H5v-.92l9.06-9.06.92.92L5.92 20.08ZM20.71 7.04a1.003 1.003 0 0 0 0-1.42l-2.34-2.34a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82Z"></path>
            </svg>
          </button>

          <button class="delete-activity-btn" aria-label="Esborrar activitat" title="Esborrar">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 7h12l-1 14H7L6 7Zm3-3h6l1 2H8l1-2Z"></path>
            </svg>
          </button>
        </div>
      </div>

      <div class="admin-participants">
        <h4>Participants</h4>
        <ul id="participants-${activityId}"></ul>
      </div>
    `;

    const editBtn = card.querySelector(".edit-activity-btn");

    const deleteBtn = card.querySelector(".delete-activity-btn");

    deleteBtn.addEventListener("click", async () => {

      const confirmDelete = confirm("Segur que vols esborrar aquesta Master Class?");

      if (!confirmDelete) return;

      try {

        // Esborrar reserves associades
        const reservationsSnap = await getDocs(
          query(collection(db, "reservations"), where("activityId", "==", activityId))
        );

        for (const r of reservationsSnap.docs) {
          await deleteDoc(doc(db, "reservations", r.id));
        }

        // Esborrar waitlist associada
        const waitSnap = await getDocs(
          query(collection(db, "waitlist"), where("activityId", "==", activityId))
        );

        for (const w of waitSnap.docs) {
          await deleteDoc(doc(db, "waitlist", w.id));
        }

        // Esborrar activitat
        await deleteDoc(doc(db, "activities", activityId));

        showToast("Activitat esborrada correctament 🗑️", "success");

        loadAdminActivities(); // refresca vista

      } catch (err) {
        console.error(err);
        showToast("Error en esborrar l'activitat.", "error");
      }
    });

    editBtn.addEventListener("click", () => {
      loadActivityIntoForm(activityId, data);
    });

    const openCheckbox = card.querySelector(".activity-open-checkbox");

    if (openCheckbox) {
      openCheckbox.addEventListener("change", async () => {
        await updateDoc(doc(db, "activities", activityId), {
          isOpen: openCheckbox.checked
        });

        showToast(
          openCheckbox.checked
            ? "Activitat activada"
            : "Activitat desactivada",
          "success"
        );
      });
    }

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
      const resData = resDoc.data();

      const userDoc = await getDoc(doc(db, "users", resData.userId));
      if (!userDoc.exists()) continue;

      const u = userDoc.data();

      const li = document.createElement("li");
      li.className = "admin-participant-item";

      const nameSpan = document.createElement("span");
      nameSpan.textContent = `${u.nom} ${u.cognoms} - ${u.escola}`;

      const removeBtn = document.createElement("button");
      removeBtn.className = "admin-remove-participant-btn";
      removeBtn.type = "button";
      removeBtn.title = "Esborrar alumne d'aquesta Master Class";
      removeBtn.innerHTML = "🗑";

      removeBtn.addEventListener("click", async () => {
        const ok = confirm(`Segur que vols esborrar ${u.nom} ${u.cognoms} d’aquesta Master Class?`);
        if (!ok) return;

        removeBtn.disabled = true;

        const done = await adminRemoveParticipant(resDoc.id, activityId);

        if (done) {
          showToast("Alumne esborrat ✅", "success");
          loadAdminActivities(); // refresca la vista
        } else {
          removeBtn.disabled = false;
        }
      });

      li.appendChild(nameSpan);
      li.appendChild(removeBtn);
      list.appendChild(li);
    }
    }
  }
}

let editingActivityId = null;

function loadActivityIntoForm(activityId, activityData) {

  editingActivityId = activityId;

  // Omplir formulari
  document.getElementById("lloc").value = activityData.lloc || "";
  document.getElementById("data").value = 
    activityData.date?.toDate
      ? activityData.date.toDate().toISOString().split("T")[0]
      : "";

  document.getElementById("horari").value = activityData.horari || "";
  document.getElementById("professor").value = activityData.professor || "";
  document.getElementById("disciplina").value = activityData.disciplina || "";
  document.getElementById("nivell").value = activityData.nivell || "";
  document.getElementById("spots").value = activityData.spots_total || "";

  // Canviar botó
  const createBtn = document.getElementById("createActivity");
  createBtn.textContent = "Guardar canvis";

  const cancelBtn = document.getElementById("cancelEditBtn");
  if (cancelBtn) cancelBtn.style.display = "inline-flex";

  const createTabBtn = document.querySelector('[data-admin-tab="create"]');
  if (createTabBtn) createTabBtn.textContent = "Editar activitat";

  // Canviar pestanya a "Crear activitat"
  document.querySelector('[data-admin-tab="create"]').click();
}

function resetCreateMode() {
  editingActivityId = null;

  const createBtn = document.getElementById("createActivity");
  if (createBtn) createBtn.textContent = "Crear Master Class";

  const createTabBtn = document.querySelector('[data-admin-tab="create"]');
  if (createTabBtn) createTabBtn.textContent = "Crear activitat";

  const cancelBtn = document.getElementById("cancelEditBtn");
  if (cancelBtn) cancelBtn.style.display = "none";

  // Buidar formulari
  document.getElementById("lloc").value = "";
  document.getElementById("data").value = "";
  document.getElementById("horari").value = "";
  document.getElementById("professor").value = "";
  document.getElementById("disciplina").value = "";
  document.getElementById("nivell").value = "";
  document.getElementById("spots").value = "";
}

async function loadAdminWaitlists() {
  const grid = document.getElementById("adminWaitlistGrid");
  if (!grid) return;

  grid.innerHTML = "";

  const wSnap = await getDocs(collection(db, "waitlist"));

  if (wSnap.empty) {
    grid.innerHTML = "<p>No hi ha ningú en llista d'espera.</p>";
    return;
  }

  // Agrupar per activitat
  const grouped = new Map(); // activityId -> array waitlist items

  wSnap.forEach((d) => {
    const w = d.data();
    if (!w?.activityId) return;
    if (!grouped.has(w.activityId)) grouped.set(w.activityId, []);
    grouped.get(w.activityId).push({ id: d.id, ...w });
  });

  // Render per cada activitat
  for (const [activityId, items] of grouped.entries()) {
    const actSnap = await getDoc(doc(db, "activities", activityId));
    if (!actSnap.exists()) continue;

    const a = actSnap.data();

    const rawDate = a.date ?? a.data;
    let dateFormatted = "-";
    if (rawDate) {
      const jsDate = typeof rawDate.toDate === "function" ? rawDate.toDate() : new Date(rawDate);
      dateFormatted = jsDate.toLocaleDateString("ca-ES");
    }

    // ordenar per createdAt (Timestamp o Date)
    items.sort((x, y) => {
      const dx = x.createdAt?.toDate ? x.createdAt.toDate() : new Date(x.createdAt);
      const dy = y.createdAt?.toDate ? y.createdAt.toDate() : new Date(y.createdAt);
      return dx - dy;
    });

    const card = document.createElement("div");
    card.className = "admin-activity-card";

    const usersHtml = await renderWaitlistUsers(items);

    card.innerHTML = `
      <div class="admin-activity-header">
        <div class="admin-activity-title">${a.disciplina || "Activitat"} - ${a.professor || ""}</div>
        <div class="admin-activity-meta">${dateFormatted} · ${a.horari || "-"} · ${a.lloc || "-"}</div>
      </div>

      <div class="admin-participants">
        <h4>Llista d'espera</h4>
        <ul>${usersHtml}</ul>
      </div>
    `;

    grid.appendChild(card);
  }
}

async function loadAdminPhotoBookings(container) {
  const bookingsSnap = await getDocs(collection(db, "photoTimeBookings"));

  if (bookingsSnap.empty) {
    const empty = document.createElement("div");
    empty.className = "admin-activity-card";
    empty.innerHTML = `<div class="admin-activity-title">Fotografia d'estudi</div><p>No hi ha reserves de fotografia.</p>`;
    container.appendChild(empty);
    return;
  }

  const card = document.createElement("div");
  card.className = "admin-activity-card";

  card.innerHTML = `
    <div class="admin-activity-header">
      <div class="admin-activity-title">Fotografia d'estudi</div>
      <div class="admin-activity-meta">Reserves de fotografia</div>
    </div>
    <div class="admin-participants">
      <h4>Reserves</h4>
      <ul id="adminPhotoBookingsList"></ul>
    </div>
  `;

  container.appendChild(card);

  const list = card.querySelector("#adminPhotoBookingsList");

  const docs = bookingsSnap.docs.slice().sort((a, b) => {
    const da = toJsDate(a.data().createdAt) || new Date(0);
    const db = toJsDate(b.data().createdAt) || new Date(0);
    return da - db;
  });

  for (const bookingDoc of docs) {
    const p = bookingDoc.data();

    const userSnap = await getDoc(doc(db, "users", p.userId));
    const u = userSnap.exists() ? userSnap.data() : null;

    const li = document.createElement("li");
    li.className = "admin-participant-item";

    const dateLabel =
      p.dateKey === "2026-03-27" ? "27 març" :
      p.dateKey === "2026-03-28" ? "28 març" :
      p.dateKey === "2026-03-29" ? "29 març" :
      p.dateKey;

    const created = toJsDate(p.createdAt);
    const createdStr = created ? created.toLocaleString("ca-ES") : "-";

    const slotEnd = p.time ? minutesToTime(timeToMinutes(p.time) + 15) : "-";

    const nameSpan = document.createElement("span");
    nameSpan.innerHTML = `
      <strong>${u ? `${u.nom} ${u.cognoms}` : "Usuari"}</strong><br>
      <small>${dateLabel} · ${p.time} - ${slotEnd} · ${p.category} · ${p.price ?? 0}€</small><br>
      <small>Reserva feta: ${createdStr}</small>
    `;

    const removeBtn = document.createElement("button");
    removeBtn.className = "admin-remove-participant-btn";
    removeBtn.type = "button";
    removeBtn.title = "Esborrar reserva de fotografia";
    removeBtn.innerHTML = "🗑";

    removeBtn.addEventListener("click", async () => {
      const ok = confirm("Segur que vols esborrar aquesta reserva de fotografia?");
      if (!ok) return;

      removeBtn.disabled = true;

      const done = await cancelPhotoTimeBooking(bookingDoc.id);

      if (done) {
        showToast("Reserva de fotografia esborrada ✅", "success");
        loadAdminActivities();
      } else {
        removeBtn.disabled = false;
      }
    });

    li.appendChild(nameSpan);
    li.appendChild(removeBtn);
    list.appendChild(li);
  }
}

async function loadAdminPhotoBookingsView() {
  const container = document.getElementById("adminPhotoBookingsGrid");
  if (!container) return;

  container.innerHTML = "";

  const settings = await getPhotoGlobalSettings();

  // Card de control global
  const settingsCard = document.createElement("div");
  settingsCard.className = "admin-activity-card";

  settingsCard.innerHTML = `
    <div class="admin-activity-header">
      <div>
        <div class="admin-activity-title">Configuració global de fotografies</div>
        <div class="admin-activity-meta">Activar o desactivar totes les reserves de fotografia</div>
      </div>
      <div class="admin-activity-toggle">
        <label class="toggle-switch">
          <input type="checkbox" id="photoGlobalOpenCheckbox" ${settings.isOpen !== false ? "checked" : ""}>
          <span class="slider"></span>
          <span class="toggle-label">Activar / Desactivar</span>
        </label>
      </div>
    </div>
  `;

  container.appendChild(settingsCard);

  const globalCheckbox = settingsCard.querySelector("#photoGlobalOpenCheckbox");
  if (globalCheckbox) {
    globalCheckbox.addEventListener("change", async () => {
      await setPhotoGlobalOpenState(globalCheckbox.checked);
      showToast(
        globalCheckbox.checked
          ? "Reserves de fotografia activades"
          : "Reserves de fotografia desactivades",
        "success"
      );
    });
  }

  const bookingsSnap = await getDocs(collection(db, "photoTimeBookings"));

  if (bookingsSnap.empty) {
    const empty = document.createElement("div");
    empty.className = "admin-activity-card";
    empty.innerHTML = `
      <div class="admin-activity-title">Fotografia d'estudi</div>
      <p>No hi ha reserves de fotografia.</p>
    `;
    container.appendChild(empty);
    return;
  }

  const grouped = new Map(); // dateKey -> hourLabel -> bookings[]

  for (const bookingDoc of bookingsSnap.docs) {
    const p = bookingDoc.data();
    const dateKey = p.dateKey || "sense-data";
    const hourLabel = p.time ? minutesToTime(Math.floor(timeToMinutes(p.time) / 60) * 60) : "00:00";

    if (!grouped.has(dateKey)) grouped.set(dateKey, new Map());
    if (!grouped.get(dateKey).has(hourLabel)) grouped.get(dateKey).set(hourLabel, []);

    grouped.get(dateKey).get(hourLabel).push({
      id: bookingDoc.id,
      ...p
    });
  }

  const orderedDays = ["2026-03-27", "2026-03-28", "2026-03-29"];

  for (const dayKey of orderedDays) {
    if (!grouped.has(dayKey)) continue;

    const dayMap = grouped.get(dayKey);

    const dayCard = document.createElement("div");
    dayCard.className = "admin-activity-card";

    const dayLabel =
      dayKey === "2026-03-27" ? "27 març" :
      dayKey === "2026-03-28" ? "28 març" :
      dayKey === "2026-03-29" ? "29 març" :
      dayKey;

    dayCard.innerHTML = `
      <div class="admin-activity-header">
        <div class="admin-activity-title">Fotografia d'estudi · ${dayLabel}</div>
        <div class="admin-activity-meta">Reserves agrupades per hora</div>
      </div>
      <div class="admin-photo-hour-groups" id="photo-groups-${dayKey}"></div>
    `;

    container.appendChild(dayCard);

    const groupContainer = dayCard.querySelector(`#photo-groups-${dayKey}`);
    const orderedHours = Array.from(dayMap.keys()).sort((a, b) => a.localeCompare(b));

    for (const hour of orderedHours) {
      const bookings = dayMap.get(hour).sort((a, b) => (a.time || "").localeCompare(b.time || ""));

      const hourBlock = document.createElement("div");
      hourBlock.className = "admin-photo-hour-block";

      const hourEnd = minutesToTime(timeToMinutes(hour) + 60);

      hourBlock.innerHTML = `
        <div class="admin-photo-hour-title">${hour} - ${hourEnd}</div>
        <ul class="admin-photo-hour-list"></ul>
      `;

      const ul = hourBlock.querySelector(".admin-photo-hour-list");

      for (const p of bookings) {
        const userSnap = await getDoc(doc(db, "users", p.userId));
        const u = userSnap.exists() ? userSnap.data() : null;

        const created = toJsDate(p.createdAt);
        const createdStr = created ? created.toLocaleString("ca-ES") : "-";
        const slotEnd = p.time ? minutesToTime(timeToMinutes(p.time) + 15) : "-";

        const li = document.createElement("li");
        li.className = "admin-participant-item";

        const info = document.createElement("span");
        info.innerHTML = `
          <strong>${u ? `${u.nom} ${u.cognoms}` : "Usuari"}</strong><br>
          <small>${p.time} - ${slotEnd} · ${p.category} · ${p.price ?? 0}€</small><br>
          <small>Reserva feta: ${createdStr}</small>
        `;

        const removeBtn = document.createElement("button");
        removeBtn.className = "admin-remove-participant-btn";
        removeBtn.type = "button";
        removeBtn.title = "Esborrar reserva de fotografia";
        removeBtn.innerHTML = "🗑";

        removeBtn.addEventListener("click", async () => {
          const ok = confirm("Segur que vols esborrar aquesta reserva de fotografia?");
          if (!ok) return;

          removeBtn.disabled = true;

          const done = await cancelPhotoTimeBooking(p.id);

          if (done) {
            showToast("Reserva de fotografia esborrada ✅", "success");
            loadAdminPhotoBookingsView();
          } else {
            removeBtn.disabled = false;
          }
        });

        li.appendChild(info);
        li.appendChild(removeBtn);
        ul.appendChild(li);
      }

      groupContainer.appendChild(hourBlock);
    }
  }
}

async function renderWaitlistUsers(items) {
  let html = "";

  for (const w of items) {
    const uSnap = await getDoc(doc(db, "users", w.userId));
    if (!uSnap.exists()) continue;

    const u = uSnap.data();
    const nom = (u.nom || "").trim();
    const cognoms = (u.cognoms || "").trim();

    const dt = w.createdAt?.toDate ? w.createdAt.toDate() : new Date(w.createdAt);
    const when = isNaN(dt.getTime()) ? "-" : dt.toLocaleString("ca-ES");

    html += `
      <li>
        <strong>${(nom + " " + cognoms).trim() || "Usuari"}</strong>
        <br>
        <small>${when}</small>
      </li>
    `;
  }

  return html;
}

function ensurePaymentModal() {
  let modal = document.getElementById("paymentModal");
  if (modal) return modal;

  modal = document.createElement("div");
  modal.id = "paymentModal";
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="modal-card">
      <div class="modal-head">
        <div>
          <h3>Transferència bancària</h3>
          <p>La reserva no quedarà confirmada fins que no s'hagi fet la transferència al mateix dia de la Master Class.</p>
        </div>
        <button type="button" class="modal-close" aria-label="Tancar">×</button>
      </div>

      <div class="modal-body">
        <div class="pay-row">
          <span class="pay-label">Titular</span>
          <strong id="payHolder"></strong>
        </div>

        <div class="pay-row">
          <span class="pay-label">Compte (IBAN)</span>
          <div class="pay-iban">
            <strong id="payIban"></strong>
            <button type="button" class="btn copy-btn" id="copyIbanBtn">Copiar</button>
          </div>
        </div>

        <div class="pay-row">
          <span class="pay-label">Concepte</span>
          <strong id="payRef"></strong>
        </div>

        <div class="modal-actions">
          <button type="button" class="btn primary" id="closePayBtn">Entesos</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Close handlers
  const close = () => modal.classList.remove("show");
  modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
  modal.querySelector(".modal-close").addEventListener("click", close);
  modal.querySelector("#closePayBtn").addEventListener("click", close);

  // Copy handler
  modal.querySelector("#copyIbanBtn").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(PAYMENT_INFO.ibanFull);
      showToast("IBAN copiat ✅", "success");
    } catch {
      showToast("No s'ha pogut copiar l'IBAN", "error");
    }
  });

  return modal;
}

function openPaymentModal(paymentRef) {
  const modal = ensurePaymentModal();

  modal.querySelector("#payHolder").textContent = PAYMENT_INFO.holder;
  modal.querySelector("#payIban").textContent = PAYMENT_INFO.ibanFull;
  modal.querySelector("#payRef").textContent = paymentRef;

  requestAnimationFrame(() => modal.classList.add("show"));
}

const exportMasterBtn = document.getElementById("exportMasterExcelBtn");
if (exportMasterBtn) {
  exportMasterBtn.addEventListener("click", exportMasterReservationsToExcel);
}

const exportPhotoBtn = document.getElementById("exportPhotoExcelBtn");
if (exportPhotoBtn) {
  exportPhotoBtn.addEventListener("click", exportPhotoReservationsToExcel);
}

async function exportMasterReservationsToExcel() {

  showToast("Generant Excel...", "success");

  const reservationsSnap = await getDocs(collection(db, "reservations"));

  if (reservationsSnap.empty) {
    showToast("No hi ha reserves.", "error");
    return;
  }

  const rows = [];

  for (const resDoc of reservationsSnap.docs) {

    const r = resDoc.data();

    const userSnap = await getDoc(doc(db, "users", r.userId));
    const activitySnap = await getDoc(doc(db, "activities", r.activityId));

    if (!userSnap.exists() || !activitySnap.exists()) continue;

    const u = userSnap.data();
    const a = activitySnap.data();

    const rawDate = a.date ?? a.data;
    const jsDate = rawDate?.toDate ? rawDate.toDate() : new Date(rawDate);

    rows.push({
      Nom: u.nom || "",
      Cognoms: u.cognoms || "",
      Email: u.email || "",
      Escola: u.escola || "",
      Activitat: a.disciplina || "",
      Professor: a.professor || "",
      Data: jsDate?.toLocaleDateString("ca-ES") || "",
      Horari: a.horari || "",
      Lloc: a.lloc || "",
      PaymentRef: r.paymentRef || "",
      PaymentStatus: r.paymentStatus || ""
    });
  }

  downloadCSV(rows);
}

async function exportPhotoReservationsToExcel() {
  showToast("Generant Excel de fotografies...", "success");

  const bookingsSnap = await getDocs(collection(db, "photoTimeBookings"));

  if (bookingsSnap.empty) {
    showToast("No hi ha reserves de fotografia.", "error");
    return;
  }

  const rows = [];

  for (const bookingDoc of bookingsSnap.docs) {
    const p = bookingDoc.data();

    const userSnap = await getDoc(doc(db, "users", p.userId));
    const u = userSnap.exists() ? userSnap.data() : {};

    const created = toJsDate(p.createdAt);
    const createdStr = created ? created.toLocaleString("ca-ES") : "";

    const slotEnd = p.time ? minutesToTime(timeToMinutes(p.time) + 15) : "";

    const dateLabel =
      p.dateKey === "2026-03-27" ? "27 març" :
      p.dateKey === "2026-03-28" ? "28 març" :
      p.dateKey === "2026-03-29" ? "29 març" :
      p.dateKey;

    rows.push({
      Nom: u.nom || "",
      Cognoms: u.cognoms || "",
      Email: u.email || "",
      Escola: u.escola || "",
      Dia: dateLabel,
      HoraInici: p.time || "",
      HoraFi: slotEnd,
      Categoria: p.category || "",
      Preu: p.price ?? 0,
      ReservaFeta: createdStr
    });
  }

  downloadCSV(rows, "fotografies_estudi_capital_dance_vic.csv");
}

function downloadCSV(data, filename = "export.csv") {

  const headers = Object.keys(data[0]);
  const csvRows = [];

  csvRows.push(headers.join(","));

  for (const row of data) {
    const values = headers.map(h => {
      const val = row[h] ?? "";
      return `"${String(val).replace(/"/g, '""')}"`;
    });
    csvRows.push(values.join(","));
  }

  const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);

  showToast("Excel descarregat correctament ✅", "success");
}
