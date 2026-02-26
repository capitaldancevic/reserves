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
  ibanMasked: "ES** **** **** **** **** 1234",
  ibanFull: "ES12 3456 7890 1234 5678 1234",
  holder: "CAPITAL DANCE VIC"
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
      // Carrega el contingut que correspongui amb la pestanya activa (per defecte: Master Class)
      await updatePriceHeader();
      const activeBtn = document.querySelector(".tab-btn.active");
      const activeTab = activeBtn?.dataset?.tab || "master";

      if (activeTab === "reserves") {
        loadMyReservations();
      } else if (activeTab === "foto") {
        loadActivitiesByType("foto");
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

function totalForCount(n) {
  let total = 0;
  for (let i = 0; i < n; i++) total += priceForIndex(i);
  return total;
}

function toJsDate(v) {
  if (!v) return null;
  return typeof v.toDate === "function" ? v.toDate() : new Date(v);
}

async function updatePriceHeader() {
  const el = document.getElementById("priceSummary");
  if (!el) return;

  const user = auth.currentUser;
  if (!user) { el.innerHTML = ""; return; }

  const snap = await getDocs(query(collection(db, "reservations"), where("userId", "==", user.uid)));
  const n = snap.size; // waitlist no compta perquè no mirem waitlist

  const total = totalForCount(n);
  const next = priceForIndex(n);

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

  const resDocs = reservationsSnap.docs.slice().sort((a,b) => {
    const da = toJsDate(a.data().createdAt) || new Date(0);
    const db = toJsDate(b.data().createdAt) || new Date(0);
    return da - db;
  });

  if (resDocs.length === 0) {
    contentArea.innerHTML = "<p>No tens cap reserva.</p>";
    return;
  }

  const grid = document.createElement("div");
  grid.className = "master-grid reservations-grid";

  for (const [idx, resDoc] of resDocs.entries()) {
    const unitPrice = priceForIndex(idx);
    const resData = resDoc.data();

    const activitySnap = await getDoc(doc(db, "activities", resData.activityId));
    if (!activitySnap.exists()) continue;

    const a = activitySnap.data();

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
          ⏳ Pendent de transferència · Confirma la reserva fent la transferència al mateix dia de la Master Class.
        </div>

        <div class="reservation-price">
          Preu: <strong>${unitPrice}€</strong>
        </div>

        <div class="payment-mini">
          <button type="button" class="btn payment-btn">Veure instruccions</button>
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

async function leaveWaitlist(waitlistId) {
  const user = auth.currentUser;
  if (!user) return false;

  try {
    await deleteDoc(doc(db, "waitlist", waitlistId));
    return true;
  } catch (err) {
    console.error(err);
    showToast("No s'ha pogut sortir de la llista.", "error");
    return false;
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

    const nextPrice = priceForIndex(myResMap.size);

    for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
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
          Preu: <strong>${nextPrice}€</strong>
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
        <div>
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

        <button class="edit-activity-btn" aria-label="Editar activitat" title="Editar">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25Zm2.92 2.83H5v-.92l9.06-9.06.92.92L5.92 20.08ZM20.71 7.04a1.003 1.003 0 0 0 0-1.42l-2.34-2.34a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82Z"></path>
          </svg>
        </button>
      </div>

      <div class="admin-participants">
        <h4>Participants</h4>
        <ul id="participants-${activityId}"></ul>
      </div>
    `;

    const editBtn = card.querySelector(".edit-activity-btn");

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

const exportBtn = document.getElementById("exportExcelBtn");

if (exportBtn) {
  exportBtn.addEventListener("click", exportReservationsToExcel);
}

async function exportReservationsToExcel() {

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

function downloadCSV(data) {

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
  a.download = "reserves_capital_dance_vic.csv";
  a.click();

  URL.revokeObjectURL(url);

  showToast("Excel descarregat correctament ✅", "success");
}
