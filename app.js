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
  deleteDoc,
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
    const userData = userDoc.data();
    const isDashboard = window.location.pathname.includes("dashboard");
    const isAdminPage = window.location.pathname.includes("admin");
    const params = new URLSearchParams(window.location.search);
    const adminWantsUserView = params.get("view") === "user";

    // Si sóc admin:
    // - Normalment vaig a admin.html
    // - EXCEPCIÓ: si estic a dashboard amb ?view=user, em deixes quedar
    // ===== Mostrar botó "Tornar a Admin" si sóc admin en vista usuari =====
    if (role === "admin") {
      const params = new URLSearchParams(window.location.search);
      const isUserView = params.get("view") === "user";

      if (isUserView && window.location.pathname.includes("dashboard")) {

        const headerContent = document.querySelector(".header-content");

        if (headerContent && !document.getElementById("backToAdminBtn")) {

          const backBtn = document.createElement("button");
          backBtn.id = "backToAdminBtn";
          backBtn.className = "logout-btn";
          backBtn.textContent = "Tornar a Admin";

          backBtn.addEventListener("click", () => {
            window.location.href = "admin.html";
          });

          headerContent.appendChild(backBtn);
        }
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

      if (!nom || !cognoms || !escola || !email || !password) {
	    showToast("Omple tots els camps", "error");
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
        createdAt: new Date()
      });

      showToast("Activitat creada correctament ✅", "success");

    } catch (err) {
      console.error(err);
      showToast("Error en crear l'activitat.", "error");
    }
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
  if (!user || !contentArea) return;

  contentArea.innerHTML = "";

  // reserves de l'usuari
  const reservationsSnap = await getDocs(
    query(collection(db, "reservations"), where("userId", "==", user.uid))
  );

  if (reservationsSnap.empty) {
    contentArea.innerHTML = "<p>No tens cap reserva.</p>";
    return;
  }

  const grid = document.createElement("div");
  grid.className = "master-grid reservations-grid";

  for (const resDoc of reservationsSnap.docs) {
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
        <div class="reservation-status">✅ Reserva confirmada</div>
        <button class="btn master-btn cancel-btn">Cancel·lar</button>
      </div>
    `;

    const cancelBtn = card.querySelector(".cancel-btn");
    cancelBtn.addEventListener("click", async () => {
      cancelBtn.disabled = true;
      cancelBtn.textContent = "Cancel·lant...";

      const ok = await cancelReservation(resDoc.id, resData.activityId);

      if (ok) {
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
      const resSnap = await transaction.get(reservationRef);
      if (!resSnap.exists()) throw "Reserva no trobada.";

      const resData = resSnap.data();
      if (resData.userId !== user.uid) throw "No tens permisos per cancel·lar aquesta reserva.";

      const actSnap = await transaction.get(activityRef);
      if (!actSnap.exists()) throw "Activitat no trobada.";

      const a = actSnap.data();
      const currentRemaining = Number(a.spots_remaining ?? 0);
      const total = Number(a.spots_total ?? currentRemaining);

      // pugem 1 plaça (sense passar del total)
      const nextRemaining = Math.min(total, currentRemaining + 1);

      transaction.update(activityRef, { spots_remaining: nextRemaining });
      transaction.delete(reservationRef);
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
    // Evitar duplicats (si ja hi és)
    const existing = await getDocs(
      query(
        collection(db, "waitlist"),
        where("activityId", "==", activityId),
        where("userId", "==", user.uid)
      )
    );

    if (!existing.empty) return true;

    await addDoc(collection(db, "waitlist"), {
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
    grid.className = "master-grid";

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();

      const rawDate = data.date ?? data.data;
      let dateFormatted = "-";
      if (rawDate) {
        const jsDate = typeof rawDate.toDate === "function" ? rawDate.toDate() : new Date(rawDate);
        dateFormatted = jsDate.toLocaleDateString("ca-ES");
      }

      // Si ja tinc reserva d'aquesta activitat, NO la mostrem a Master Class / Foto
      if (myResMap.has(docSnap.id)) return;

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

        // Card “diferent” per indicar llista d’espera
        card.classList.add("waitlist-card");

        // Si ja hi soc, informatiu i desactivat
        if (myWaitlistMap.has(docSnap.id)) {

        const waitlistId = myWaitlistMap.get(docSnap.id);

        if (!waitlistId) {
          showToast("No s'ha trobat la teva entrada de llista d'espera.", "error");
          return;
        }

        button.textContent = "Sortir de la llista";
        button.classList.remove("primary");

        button.addEventListener("click", async () => {

          button.disabled = true;

          const ok = await leaveWaitlist(waitlistId);

          if (ok) {
  showToast("Has sortit de la llista d'espera.", "success");

  // Manté la card i torna a estat "Entrar a llista"
  button.disabled = false;
  button.textContent = "Entrar a llista d'espera";

  // ⚠️ Important: perquè no acumulis listeners duplicats,
  // recarreguem la pestanya actual (Master Class) de manera neta
  // (és el camí més segur i curt)
  loadActivitiesByType("master");

          } else {
            button.disabled = false;
          }
        });
      } else {
          // Si no hi soc, permet entrar
          button.textContent = "Entrar a llista d'espera";

          button.addEventListener("click", async () => {
            button.disabled = true;

            const ok = await joinWaitlist(docSnap.id);

            if (ok) {
              showToast("Afegit a la llista d'espera 🕒", "success");

              // Manté la card i actualitza el botó
              button.disabled = false;
              button.textContent = "En llista d'espera";
              button.disabled = true;

              // assegura estil waitlist
              card.classList.add("waitlist-card");

            } else {
              button.disabled = false;
            }
          });
        }

      } else {
        button.addEventListener("click", async () => {
        button.disabled = true;
      
        const success = await reserve(docSnap.id);
      
        if (success) {
          showToast("Reserva confirmada ✅", "success");

          // Fade out i treu la card
          card.classList.add("fade-out");
          setTimeout(() => {
            card.remove();

            // Si ja no queden cards, mostra missatge
            if (!grid.querySelector(".master-card")) {
              contentArea.innerHTML = "<p>No hi ha activitats disponibles.</p>";
            }
          }, 280);

        } else {
          showToast("No s'ha pogut reservar (ja la tens o no queden places).", "error");
          button.disabled = false;
        }
      });
      }

      grid.appendChild(card);
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
