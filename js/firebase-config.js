// ============================
// FIREBASE CONFIGURATION
// ============================

const firebaseConfig = {
    apiKey: "AIzaSyBqNdCf9nO7eTQLpxN5NHfAmYYCpKadmuM",
    authDomain: "warzone-tactical-pj.firebaseapp.com",
    projectId: "warzone-tactical-pj",
    storageBucket: "warzone-tactical-pj.firebasestorage.app",
    messagingSenderId: "130507237178",
    appId: "1:130507237178:web:a3b2214a7fd421a3ef1203"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);

const db = firebase.firestore();
const auth = firebase.auth();
