import { initializeApp } from "firebase/app";
import {
  getFirestore,
  serverTimestamp,
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  addDoc,
  query,
  where,
  getDocs
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

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

// ===============================
// SERVICES
// ===============================
export const db = getFirestore(app);
export const auth = getAuth(app);

// ===============================
// HELPERS
// ===============================
export const criarIdConversa = (userRemetente, idDestinatario) => {
  const idsOrdenados = [userRemetente, idDestinatario].sort();
  const numeroAleatorio = Math.floor(Math.random() * 100000);
  return `${idsOrdenados[0]}${numeroAleatorio}_${idsOrdenados[1]}`;
};

export const criarIdChat = () => {
  return doc(collection(db, "_dummy")).id;
};

// ===============================
// CHAT
// ===============================
export const enviarChat = async ({
  idContato,
  idConversa,
  userRemetente,
  mensagem
}) => {
  const conversaRef = doc(db, "contatos", idContato, "conversas", idConversa);

  const conversaSnap = await getDoc(conversaRef);
  if (!conversaSnap.exists()) {
    console.error("Conversa não encontrada");
    return;
  }

  const idChat = criarIdChat();

  await setDoc(
    doc(db, "contatos", idContato, "conversas", idConversa, "chat", idChat),
    {
      mensagem,
      data: serverTimestamp(),
      userRemetente,
      idConversa,
      idChat
    }
  );

  await updateDoc(conversaRef, {
    ultimaMensagem: mensagem,
    dataUltimaMensagem: serverTimestamp()
  });

  await updateDoc(doc(db, "contatos", idContato), {
    ultimaConversaData: serverTimestamp()
  });
};

// ===============================
// EMAIL / CONVERSA
// ===============================
export const enviarMensagem = async (
  skinLogado,
  idDestinatario,
  assunto,
  mensagem,
  valorTextareaEmail
) => {
  const contatoRef = doc(collection(db, "contatos"));
  const idContato = contatoRef.id;

  await setDoc(contatoRef, {
    idContato,
    ultimaConversaData: serverTimestamp(),
    skinRemetente: skinLogado,
    skinDestinatario: "savannaoliveira"
  });

  const idConversa = assunto ? criarIdChat() : "principal";
  const conversaRef = doc(db, "contatos", idContato, "conversas", idConversa);

  await setDoc(
    conversaRef,
    {
      assunto: assunto || "PRINCIPAL",
      data: serverTimestamp(),
      idContato,
      idConversa,
      ultimaMensagem: mensagem,
      email: valorTextareaEmail,
      dataUltimaMensagem: serverTimestamp()
    },
    { merge: true }
  );

  const idChat = criarIdChat();
  await setDoc(
    doc(db, "contatos", idContato, "conversas", idConversa, "chat", idChat),
    {
      mensagem,
      data: serverTimestamp(),
      userRemetente: skinLogado,
      idConversa,
      idChat
    }
  );
};

// ===============================
// USER
// ===============================
export const verificaUser = async (campo, valor) => {
  const q = query(collection(db, "users"), where(campo, "==", valor));
  const snapshot = await getDocs(q);

  if (!snapshot.empty) {
    snapshot.forEach(async (docSnap) => {
      await addDoc(collection(docSnap.ref, "logins"), {
        data: serverTimestamp()
      });
    });
  } else {
    const userRef = doc(db, "users", idGoogleCap);

    await setDoc(userRef, {
      idGoogle: idGoogleCap,
      nomeGoogle: primeiroNomeCap,
      nomeCompletoGoogle: fullnameCap,
      emailGoogle: emailCap,
      picGoogle: picGoogleCap,
      data: new Date(),
      isAdmin: false
    });

    await addDoc(collection(userRef, "logins"), {
      data: serverTimestamp()
    });
  }
};

export { app };