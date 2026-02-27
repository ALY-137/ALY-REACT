import { arrayUnion, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { getMessaging, getToken, isSupported, onMessage } from "firebase/messaging";
import {
  app,
  auth,
  db,
  activeFirebaseConfig,
  activeFirebaseMessagingVapidKey,
  activeFirebaseProjectKey,
} from "../../Banco/init-firebase";

let foregroundListenerAtivo = false;
let ultimoRegistroKey = "";

function sanitizeString(value) {
  return String(value || "").trim();
}

function suportaPushNoNavegador() {
  if (typeof window === "undefined") return false;
  return "Notification" in window && "serviceWorker" in navigator;
}

async function garantirPermissaoNotificacao() {
  if (!suportaPushNoNavegador()) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return Notification.requestPermission();
}

async function registrarServiceWorkerMessaging() {
  const registro = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
  await navigator.serviceWorker.ready;

  const initPayload = {
    type: "INIT_FIREBASE_MESSAGING",
    firebaseConfig: activeFirebaseConfig || {},
  };

  if (registro.active) {
    registro.active.postMessage(initPayload);
  } else if (registro.waiting) {
    registro.waiting.postMessage(initPayload);
  } else if (registro.installing) {
    registro.installing.postMessage(initPayload);
  }

  return registro;
}

function ativarListenerForeground(messaging) {
  if (foregroundListenerAtivo) return;

  onMessage(messaging, (payload) => {
    const title = sanitizeString(payload?.notification?.title);
    const body = sanitizeString(payload?.notification?.body);
    if (!title || Notification.permission !== "granted") return;

    try {
      const link = sanitizeString(payload?.data?.link) || "/menu/admin/solicitacoes";
      new Notification(title, {
        body: body || "Nova solicitacao recebida.",
        icon: "/favicon.ico",
        data: { link },
      });
    } catch {
      // Ignora erro de notificacao no foreground.
    }
  });

  foregroundListenerAtivo = true;
}

export async function registrarTokenPushAdmin() {
  const usuario = auth.currentUser;
  const uid = sanitizeString(usuario?.uid);
  if (!uid) {
    return { ok: false, reason: "unauthenticated" };
  }

  if (!suportaPushNoNavegador()) {
    return { ok: false, reason: "unsupported" };
  }

  const supported = await isSupported().catch(() => false);
  if (!supported) {
    return { ok: false, reason: "messaging-unsupported" };
  }

  const permissao = await garantirPermissaoNotificacao();
  if (permissao !== "granted") {
    return { ok: false, reason: permissao || "permission-not-granted" };
  }

  const registroSw = await registrarServiceWorkerMessaging();
  const messaging = getMessaging(app);
  const vapidKey = sanitizeString(activeFirebaseMessagingVapidKey);
  const token = await getToken(messaging, {
    serviceWorkerRegistration: registroSw,
    ...(vapidKey ? { vapidKey } : {}),
  });

  if (!sanitizeString(token)) {
    return { ok: false, reason: "token-empty" };
  }

  ativarListenerForeground(messaging);

  const registroAtual = `${activeFirebaseProjectKey}:${uid}:${token}`;
  if (registroAtual === ultimoRegistroKey) {
    return { ok: true, token, skipped: true };
  }

  await setDoc(
    doc(db, "users", uid),
    {
      adminPushTokens: arrayUnion(token),
      adminPushTokensUpdatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  ultimoRegistroKey = registroAtual;
  return { ok: true, token, skipped: false };
}
