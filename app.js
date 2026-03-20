// FINAL FIXED APP.JS (NO ERRORS)

import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const $ = (id) => document.getElementById(id);

// LOGIN FIX
document.getElementById('loginBtn')?.addEventListener('click', async () => {
  try {
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;

    if (!email || !password) {
      alert("Enter email & password");
      return;
    }

    await signInWithEmailAndPassword(auth, email, password);
    alert("Login successful");

  } catch (e) {
    alert(e.message);
  }
});

// AUTH STATE
onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log("Logged in:", user.email);
  } else {
    console.log("Not logged in");
  }
});

// CLICK HANDLER FIX
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.section-tab-btn');
  if (btn) {
    console.log("Tab clicked:", btn.dataset.section);
  }
});
