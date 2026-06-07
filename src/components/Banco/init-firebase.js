import { initializeApp } from "firebase/app";
import {
  arrayUnion,
  getFirestore,
  initializeFirestore,
  collection,
  doc,
  setDoc,
  serverTimestamp,
  getDoc,
} from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";
import { getAuth, GoogleAuthProvider, TwitterAuthProvider } from "firebase/auth";

import { resolveFirebaseProjectAsync } from "../../config/firebaseProjects";
import {
  getProjectCollectionCandidates,
  getProjectDocCandidates,
} from "./projectDataRefs";

export let app = null;
export let activeFirebaseProjectKey = "";
export let activeFirebaseProjectId = "";
export let activeFirebaseStorageBucket = "";
export let activeFirebaseConfig = null;
export let activeFirebaseMessagingVapidKey = "";

const FIRESTORE_COMPAT_SETTINGS = {
  experimentalAutoDetectLongPolling: true,
  useFetchStreams: false,
  ignoreUndefinedProperties: true,
};

export function createFirestoreCompatInstance(firebaseApp) {
  try {
    return initializeFirestore(firebaseApp, FIRESTORE_COMPAT_SETTINGS);
  } catch (error) {
    if (String(error?.code || "") === "failed-precondition") {
      return getFirestore(firebaseApp);
    }
    throw error;
  }
}

// ===============================
// SERVICES
// ===============================
export let db = null;
export let auth = null;
export let storage = null;
export let functions = null;
export let providerGoogle = null;
export let providerTwitter = null;
let firebaseRuntimeInitPromise = null;

export async function initializeFirebaseRuntime() {
  if (firebaseRuntimeInitPromise) {
    return firebaseRuntimeInitPromise;
  }

  firebaseRuntimeInitPromise = resolveFirebaseProjectAsync().then(
    ({ projectKey, firebaseConfig, functionsRegion, messagingVapidKey }) => {
      app = initializeApp(firebaseConfig);
      activeFirebaseProjectKey = projectKey;
      activeFirebaseProjectId = firebaseConfig.projectId;
      activeFirebaseStorageBucket = firebaseConfig.storageBucket || "";
      activeFirebaseConfig = firebaseConfig;
      activeFirebaseMessagingVapidKey = messagingVapidKey || "";

      db = createFirestoreCompatInstance(app);
      auth = getAuth(app);
      storage = activeFirebaseStorageBucket
        ? getStorage(app, `gs://${activeFirebaseStorageBucket}`)
        : getStorage(app);
      functions = getFunctions(app, functionsRegion);
      providerGoogle = new GoogleAuthProvider();
      providerTwitter = new TwitterAuthProvider();

      return {
        app,
        db,
        auth,
        storage,
        functions,
        activeFirebaseProjectKey,
        activeFirebaseProjectId,
        activeFirebaseStorageBucket,
        activeFirebaseConfig,
        activeFirebaseMessagingVapidKey,
      };
    }
  );

  return firebaseRuntimeInitPromise;
}

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

const getContatoRefs = (idContato = "") =>
  getProjectDocCandidates(db, "contatos", String(idContato || "").trim());

const getConversaRefs = (idContato = "", idConversa = "") =>
  getProjectDocCandidates(
    db,
    "contatos",
    String(idContato || "").trim(),
    "conversas",
    String(idConversa || "").trim()
  );

const getChatRefs = (idContato = "", idConversa = "") =>
  getProjectCollectionCandidates(
    db,
    "contatos",
    String(idContato || "").trim(),
    "conversas",
    String(idConversa || "").trim(),
    "chat"
  );

const getFirstExistingDoc = async (refs = []) => {
  for (const refItem of refs) {
    const snap = await getDoc(refItem).catch(() => null);
    if (snap?.exists?.()) return snap;
  }
  return null;
};

// ===============================
// CHAT
// ===============================
export const enviarChat = async ({
  idContato,
  idConversa,
  userRemetente,
  mensagem,
  userUid = "",
  senderSkinId = "",
  iconSkin = "",
}) => {
  const idContatoNorm = String(idContato || "").trim();
  const idConversaNorm = String(idConversa || "").trim();
  const senderUid = String(userUid || auth?.currentUser?.uid || "").trim();
  const conversaRefs = getConversaRefs(idContatoNorm, idConversaNorm);

  const conversaSnap = await getFirstExistingDoc(conversaRefs);
  if (!conversaSnap?.exists?.()) {
    console.error("Conversa nao encontrada");
    return;
  }

  const idChat = criarIdChat();
  const payloadChat = {
    mensagem,
    data: serverTimestamp(),
    userRemetente,
    userUid: senderUid,
    senderSkinId: String(senderSkinId || "").trim(),
    iconSkin: String(iconSkin || "").trim() || null,
    idConversa: idConversaNorm,
    idChat,
  };

  for (const chatRef of getChatRefs(idContatoNorm, idConversaNorm)) {
    await setDoc(doc(chatRef, idChat), payloadChat);
  }

  for (const conversaRef of conversaRefs) {
    await setDoc(
      conversaRef,
      {
        ultimaMensagem: mensagem,
        dataUltimaMensagem: serverTimestamp(),
      },
      { merge: true }
    );
  }

  for (const contatoRef of getContatoRefs(idContatoNorm)) {
    const payloadContato = {
      ultimaConversaData: serverTimestamp(),
    };
    if (senderUid) {
      payloadContato.participantUids = arrayUnion(senderUid);
    }
    await setDoc(
      contatoRef,
      payloadContato,
      { merge: true }
    );
  }
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
  const _idDestinatario = idDestinatario;
  const idContato = criarIdChat();
  const senderUid = String(auth?.currentUser?.uid || "").trim();

  for (const contatoRef of getContatoRefs(idContato)) {
    const payloadContato = {
      idContato,
      ultimaConversaData: serverTimestamp(),
      skinRemetente: skinLogado,
      skinDestinatario: "savannaoliveira",
    };
    if (senderUid) {
      payloadContato.participantUids = arrayUnion(senderUid);
    }
    await setDoc(
      contatoRef,
      payloadContato,
      { merge: true }
    );
  }

  const idConversa = assunto ? criarIdChat() : "principal";
  for (const conversaRef of getConversaRefs(idContato, idConversa)) {
    await setDoc(
      conversaRef,
      {
        assunto: assunto || "PRINCIPAL",
        data: serverTimestamp(),
        idContato,
        idConversa,
        ultimaMensagem: mensagem,
        email: valorTextareaEmail,
        dataUltimaMensagem: serverTimestamp(),
      },
      { merge: true }
    );
  }

  const idChat = criarIdChat();
  for (const chatRef of getChatRefs(idContato, idConversa)) {
    await setDoc(doc(chatRef, idChat), {
      mensagem,
      data: serverTimestamp(),
      userRemetente: skinLogado,
      idConversa,
      idChat,
      destinatarioId: _idDestinatario || null,
    });
  }
};
