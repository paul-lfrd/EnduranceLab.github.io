/* ═══════════════════════════════════════════════════
   ENDURANCE LAB — firebase.js
   Gestion authentification + base de données Firestore
   ═══════════════════════════════════════════════════

   INSTRUCTIONS DE CONFIGURATION :
   1. Va sur https://console.firebase.google.com
   2. Crée un projet (ex: "endurance-lab")
   3. Active Authentication > Email/Password
   4. Crée une base Firestore Database (mode production)
   5. Dans Firestore > Règles, colle ces règles :

      rules_version = '2';
      service cloud.firestore {
        match /databases/{database}/documents {
          match /users/{userId}/{document=**} {
            allow read, write: if request.auth != null && request.auth.uid == userId;
          }
        }
      }

   6. Dans Paramètres du projet > Tes applications > </> (Web)
      Crée une app web et copie la config firebaseConfig ci-dessous.
   ═══════════════════════════════════════════════════ */

// ══════════════════════════════════════════════
// ⚙️  COLLE TA CONFIG FIREBASE ICI
// ══════════════════════════════════════════════
const firebaseConfig = {
  apiKey: "AIzaSyDEikCe6emPm7u5Vb4iS5LtvLJQnZxld3M",
  authDomain: "enudrancelab.firebaseapp.com",
  projectId: "enudrancelab",
  storageBucket: "enudrancelab.firebasestorage.app",
  messagingSenderId: "110961505788",
  appId: "1:110961505788:web:e7a09526e8cd1638166e79",
  measurementId: "G-6XQV0YBXQZ"
};
// ══════════════════════════════════════════════

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  enableIndexedDbPersistence
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Init Firebase
const app = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);
const db_firestore = getFirestore(app);

// Offline persistence
try {
  enableIndexedDbPersistence(db_firestore).catch(() => {});
} catch(e) {}

// ══════════════════════════════════════════════
// STATE
// ══════════════════════════════════════════════

let currentUser = null;
let unsubscribeSnapshot = null;
let saveTimeout = null;
let isOnline = navigator.onLine;

window.addEventListener('online',  () => { isOnline = true;  updateOnlineStatus(); });
window.addEventListener('offline', () => { isOnline = false; updateOnlineStatus(); });

function updateOnlineStatus() {
  const dot = document.getElementById('onlineDot');
  const label = document.getElementById('onlineLabel');
  if (dot) dot.style.background = isOnline ? 'var(--success)' : 'var(--warn)';
  if (label) label.textContent = isOnline ? 'En ligne' : 'Hors ligne';
}

// ══════════════════════════════════════════════
// AUTH STATE OBSERVER
// ══════════════════════════════════════════════

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    showApp(user);
    await startDataSync(user.uid);
  } else {
    currentUser = null;
    stopDataSync();
    showAuthScreen();
  }
});

// ══════════════════════════════════════════════
// AUTH UI
// ══════════════════════════════════════════════

function showAuthScreen() {
  document.getElementById('authScreen').style.display = 'flex';
  document.getElementById('appWrapper').style.display = 'none';
}

function showApp(user) {
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('appWrapper').style.display = 'flex';
  const nameEl = document.getElementById('userDisplayName');
  if (nameEl) nameEl.textContent = user.displayName || user.email.split('@')[0];
  updateOnlineStatus();
}

// ══════════════════════════════════════════════
// REGISTER
// ══════════════════════════════════════════════

async function handleRegister(e) {
  e.preventDefault();
  const name  = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const pass  = document.getElementById('regPassword').value;
  const pass2 = document.getElementById('regPassword2').value;

  if (pass !== pass2) { showAuthError('Les mots de passe ne correspondent pas.'); return; }
  if (pass.length < 6) { showAuthError('Mot de passe trop court (6 caractères min.).'); return; }

  setAuthLoading(true);
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(cred.user, { displayName: name });
    // Init empty DB for new user
    await saveToFirestore(cred.user.uid, { races: [], physio: [], materiel: [], composants: [] });
  } catch(err) {
    showAuthError(firebaseErrorMsg(err.code));
  } finally {
    setAuthLoading(false);
  }
}

// ══════════════════════════════════════════════
// LOGIN
// ══════════════════════════════════════════════

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const pass  = document.getElementById('loginPassword').value;

  setAuthLoading(true);
  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch(err) {
    showAuthError(firebaseErrorMsg(err.code));
  } finally {
    setAuthLoading(false);
  }
}

// ══════════════════════════════════════════════
// LOGOUT
// ══════════════════════════════════════════════

async function handleLogout() {
  if (!confirm('Se déconnecter ?')) return;
  await signOut(auth);
}

// ══════════════════════════════════════════════
// RESET PASSWORD
// ══════════════════════════════════════════════

async function handleResetPassword() {
  const email = document.getElementById('loginEmail').value.trim();
  if (!email) { showAuthError('Saisis ton email d\'abord.'); return; }
  try {
    await sendPasswordResetEmail(auth, email);
    showAuthSuccess('Email de réinitialisation envoyé !');
  } catch(err) {
    showAuthError(firebaseErrorMsg(err.code));
  }
}

// ══════════════════════════════════════════════
// FIRESTORE SYNC
// ══════════════════════════════════════════════

async function startDataSync(uid) {
  stopDataSync();
  const docRef = doc(db_firestore, 'users', uid, 'data', 'main');

  // Initial load
  try {
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      applyRemoteData(data);
    }
  } catch(e) {
    console.warn('Initial load failed, using local cache', e);
    loadLocalCache(uid);
  }

  // Realtime listener
  unsubscribeSnapshot = onSnapshot(docRef, (snap) => {
    if (snap.exists() && snap.metadata.hasPendingWrites === false) {
      applyRemoteData(snap.data());
    }
  }, (err) => {
    console.warn('Snapshot error', err);
  });
}

function stopDataSync() {
  if (unsubscribeSnapshot) { unsubscribeSnapshot(); unsubscribeSnapshot = null; }
}

function applyRemoteData(data) {
  if (typeof applyDataToApp === 'function') {
    applyDataToApp({ races: [], physio: [], materiel: [], composants: [], ...data });
  }
}

async function saveToFirestore(uid, data) {
  const docRef = doc(db_firestore, 'users', uid, 'data', 'main');
  await setDoc(docRef, data, { merge: false });
  cacheLocally(uid, data);
}

// ══════════════════════════════════════════════
// DEBOUNCED SAVE (called from app.js)
// ══════════════════════════════════════════════

function scheduleSave(data) {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    if (!currentUser) return;
    try {
      await saveToFirestore(currentUser.uid, data);
    } catch(e) {
      console.error('Save failed', e);
      // Data is cached locally, will sync when back online
    }
  }, 800); // debounce 800ms
}

// ══════════════════════════════════════════════
// LOCAL CACHE (fallback offline)
// ══════════════════════════════════════════════

function cacheLocally(uid, data) {
  try { localStorage.setItem('elcache_' + uid, JSON.stringify(data)); } catch(e) {}
}

function loadLocalCache(uid) {
  try {
    const raw = localStorage.getItem('elcache_' + uid);
    if (raw) applyRemoteData(JSON.parse(raw));
  } catch(e) {}
}

// ══════════════════════════════════════════════
// ERROR MESSAGES
// ══════════════════════════════════════════════

function firebaseErrorMsg(code) {
  const msgs = {
    'auth/email-already-in-use':    'Cet email est déjà utilisé.',
    'auth/invalid-email':           'Email invalide.',
    'auth/user-not-found':          'Aucun compte avec cet email.',
    'auth/wrong-password':          'Mot de passe incorrect.',
    'auth/weak-password':           'Mot de passe trop faible.',
    'auth/too-many-requests':       'Trop de tentatives. Réessaie plus tard.',
    'auth/network-request-failed':  'Erreur réseau. Vérifie ta connexion.',
    'auth/invalid-credential':      'Email ou mot de passe incorrect.',
  };
  return msgs[code] || 'Une erreur est survenue. (' + code + ')';
}

function showAuthError(msg) {
  const el = document.getElementById('authError');
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
  el.className = 'auth-message error';
}

function showAuthSuccess(msg) {
  const el = document.getElementById('authError');
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
  el.className = 'auth-message success';
}

function setAuthLoading(loading) {
  document.querySelectorAll('.auth-submit-btn').forEach(btn => {
    btn.disabled = loading;
    btn.textContent = loading ? 'Chargement…' : btn.dataset.label;
  });
}

// ══════════════════════════════════════════════
// EXPORTS (accessed globally from app.js)
// ══════════════════════════════════════════════
const getCurrentUser = () => currentUser;

export {
  handleLogin,
  handleRegister,
  handleLogout,
  handleResetPassword,
  scheduleSave,
  getCurrentUser 
};
