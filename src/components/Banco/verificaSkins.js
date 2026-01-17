// verificaSkins.js
import { 
  getFirestore, 
  doc, 
  collection, 
  setDoc, 
  getDocs, 
  query, 
  where, 
  serverTimestamp 
} from "firebase/firestore";
import { initializeApp } from "firebase/app";

import {
  idGoogleCap,
  primeiroNomeCap,
  emailCap,
  picGoogleCap,
  fullnameCap
} from "../../App";

// ===============================
// CONFIG
// ===============================
const firebaseConfig = {
  apiKey: "AIzaSyAhSNGCUOM_nRiVwtRmmPz9o6ciQA6lSYA",
  authDomain: "teste-aa015.firebaseapp.com",
  projectId: "teste-aa015",
  storageBucket: "teste-aa015.appspot.com",
  messagingSenderId: "99960275074",
  appId: "1:99960275074:web:e2923f7e34a0c0c18c749b"
};

// ===============================
// INIT
// ===============================
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ===============================
// FUNÇÃO PARA VERIFICAR E CRIAR SKIN
// ===============================
export const verificarESalvarskins = async (userId, username, theme) => {
  try {
    const userRef = doc(db, "users", userId);
    const skinsRef = collection(userRef, "skins");

    // ── Verificar se a skin já existe
    const q = query(collection(db, "users"), where("username", "==", username));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      console.log("O nome de usuário da skin já existe.");
      return true;
    }

    // ── Definir se é a skin principal
    const allSkinsSnapshot = await getDocs(skinsRef);
    const is_main = allSkinsSnapshot.empty;

    // ── Criar a skin
    const id_skin = doc(skinsRef).id;
    await setDoc(doc(skinsRef, id_skin), {
      id_skin,
      username,
      theme,
      is_main,
      data: serverTimestamp(),
      iconSkin:
        "https://firebasestorage.googleapis.com/v0/b/teste-aa015.appspot.com/o/imagens%2Fthemes%2Fcyberpink%2Fviolet%2Fet.png?alt=media&token=4c09e6d5-5a0e-48d7-88ae-f56a9a5c1a5b",
    });

    // ── Criar a página principal
    const espacosRef = collection(userRef, "espacos");
    const id_espaco = doc(espacosRef).id;

    await setDoc(doc(espacosRef, id_espaco), {
      id_espaco,
      nome: "Home",
      conteudo: "Conteúdo da página principal",
      ordem: 0,
      is_main: true,
      skinOwner: id_skin,
      data: serverTimestamp(),
    });

    console.log("Skin e página principal criadas com sucesso!");
    return false;
  } catch (error) {
    console.error("Erro ao verificar e salvar skin:", error);
    return false;
  }
};
