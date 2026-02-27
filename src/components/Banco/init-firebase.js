import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  addDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
  getDoc,
  updateDoc
} from "firebase/firestore";

import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

import {
  getAuth,
  GoogleAuthProvider,
  TwitterAuthProvider
} from "firebase/auth";
import { resolveFirebaseProject } from "../../config/firebaseProjects";

// ===============================
// CONFIG
// ===============================
const { projectKey, firebaseConfig, functionsRegion, messagingVapidKey } =
  resolveFirebaseProject();

// ===============================
// INIT
// ===============================
export const app = initializeApp(firebaseConfig);
export const activeFirebaseProjectKey = projectKey;
export const activeFirebaseProjectId = firebaseConfig.projectId;
export const activeFirebaseStorageBucket = firebaseConfig.storageBucket || "";
export const activeFirebaseConfig = firebaseConfig;
export const activeFirebaseMessagingVapidKey = messagingVapidKey || "";

// ===============================
// SERVICES
// ===============================
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = activeFirebaseStorageBucket
  ? getStorage(app, `gs://${activeFirebaseStorageBucket}`)
  : getStorage(app);
export const functions = getFunctions(app, functionsRegion);
export const providerGoogle = new GoogleAuthProvider();
export const providerTwitter = new TwitterAuthProvider();




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
