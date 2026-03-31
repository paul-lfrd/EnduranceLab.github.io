# Endurance Lab — Guide de configuration Firebase

## Étapes pour activer les comptes et la synchronisation multi-appareils

---

### 1. Créer un projet Firebase (gratuit)

1. Va sur **https://console.firebase.google.com**
2. Clique sur **"Ajouter un projet"**
3. Nomme-le `endurance-lab` (ou ce que tu veux)
4. Désactive Google Analytics si tu ne veux pas de tracking
5. Clique **"Créer le projet"**

---

### 2. Activer l'authentification Email/Password

1. Dans le menu gauche : **Authentication**
2. Clique **"Commencer"**
3. Onglet **"Sign-in method"**
4. Clique **"Email/Mot de passe"** → Active la première option
5. Sauvegarde

---

### 3. Créer la base de données Firestore

1. Dans le menu gauche : **Firestore Database**
2. Clique **"Créer une base de données"**
3. Choisis **"Commencer en mode production"**
4. Sélectionne une région proche (ex: `europe-west1`)
5. Clique **"Activer"**

---

### 4. Configurer les règles de sécurité Firestore

1. Dans Firestore → onglet **"Règles"**
2. Remplace tout le contenu par :

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

3. Clique **"Publier"**

> Ces règles garantissent que chaque utilisateur ne peut accéder qu'à ses propres données.

---

### 5. Récupérer la configuration Firebase

1. Dans les paramètres du projet (⚙️ en haut à gauche → **"Paramètres du projet"**)
2. Descends jusqu'à **"Tes applications"**
3. Clique **"</>"** (ajouter une app Web)
4. Nomme-la `endurance-lab-web`, clique **"Enregistrer"**
5. Copie l'objet `firebaseConfig` affiché

Il ressemble à ça :
```js
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "endurance-lab.firebaseapp.com",
  projectId: "endurance-lab",
  storageBucket: "endurance-lab.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

---

### 6. Coller la config dans firebase.js

Ouvre le fichier `firebase.js` et remplace le bloc `FIREBASE_CONFIG` au début du fichier :

```js
const FIREBASE_CONFIG = {
  apiKey: "COLLE_TA_VRAIE_CLE_ICI",
  authDomain: "ton-projet.firebaseapp.com",
  projectId: "ton-projet",
  storageBucket: "ton-projet.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

---

### 7. Héberger le site (pour y accéder depuis tous tes appareils)

Option A — **Firebase Hosting** (recommandé, gratuit) :
```bash
npm install -g firebase-tools
firebase login
firebase init hosting   # sélectionne ton projet, dossier public = "."
firebase deploy
```
→ Tu obtiens une URL du type `https://endurance-lab.web.app`

Option B — **Ouvrir directement** `index.html` dans le navigateur :
- Fonctionne en local, mais Firebase nécessite une origine HTTP pour l'auth.
- Utilise une extension Live Server (VS Code) ou Python : `python -m http.server 8080`

---

### 8. Inviter d'autres utilisateurs

Il n'y a pas de système d'invitation à gérer : chaque personne se crée simplement un compte sur le site avec son email et un mot de passe. Les données de chaque compte sont totalement séparées.

---

## Quotas Firebase gratuits (Spark Plan)

| Ressource | Limite gratuite |
|-----------|----------------|
| Authentification | Illimitée |
| Firestore lectures | 50 000 / jour |
| Firestore écritures | 20 000 / jour |
| Firestore stockage | 1 GB |
| Hosting | 10 GB/mois |

Pour un usage sportif personnel (quelques utilisateurs), ces quotas sont largement suffisants et ne seront jamais atteints.

---

## Fonctionnement hors ligne

L'app fonctionne hors ligne grâce au cache IndexedDB de Firestore. Les modifications faites sans connexion sont synchronisées automatiquement dès que la connexion revient. L'indicateur dans la sidebar indique l'état de connexion.
