import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import { activeFirebaseProjectKey, db } from "./init-firebase";
import { getProjectCollectionCandidates } from "./projectDataRefs";
import { buildProjectDataPathCandidates } from "./projectDataNamespace";
import { buildSharedFunctionsUrl } from "./sharedFunctionsApi";

function normalizeText(value) {
  return String(value || "").trim();
}

function buildUserDocRefs(uid = "") {
  const caminhos = buildProjectDataPathCandidates(["users", uid], {
    activeProjectKey: activeFirebaseProjectKey,
  });
  const refs = caminhos.map((segmentos) => doc(db, ...segmentos));
  const dedupe = new Map();
  refs.forEach((ref) => {
    if (!dedupe.has(ref.path)) {
      dedupe.set(ref.path, ref);
    }
  });
  return Array.from(dedupe.values());
}

async function readFirstExisting(refs = []) {
  for (const refItem of refs) {
    const snap = await getDoc(refItem);
    if (snap.exists()) {
      return snap;
    }
  }
  return null;
}

async function writeMirror(refs = [], payload = {}) {
  for (const refItem of refs) {
    await setDoc(refItem, payload, { merge: true });
  }
}

async function appendLoginMirror(userRefs = []) {
  if (!userRefs.length) return;
  const loginId = doc(collection(userRefs[0], "logins")).id;
  for (const userRef of userRefs) {
    await setDoc(
      doc(collection(userRef, "logins"), loginId),
      {
        data: serverTimestamp(),
      },
      { merge: true }
    );
  }
}

function getProjectSystemKeyForMirror() {
  try {
    const fromContext = normalizeText(localStorage.getItem("systemProjectContextKey")).toLowerCase();
    if (fromContext) return fromContext;
  } catch {
    // Ignora indisponibilidade de storage.
  }
  return normalizeText(activeFirebaseProjectKey).toLowerCase();
}

function normalizarSkinsResumo(lista = []) {
  const dedupe = new Map();

  (Array.isArray(lista) ? lista : []).forEach((item, index) => {
    const id = normalizeText(item?.id || item?.id_skin || `skin_${index}`);
    const username = normalizeText(item?.username);
    if (!id && !username) return;

    const chave = id || username.toLowerCase();
    if (!chave || dedupe.has(chave)) return;

    dedupe.set(chave, {
      id,
      username,
      is_main: Boolean(item?.is_main),
      theme: normalizeText(item?.theme),
    });
  });

  return Array.from(dedupe.values());
}

async function coletarResumoSkinsDoUsuario(uid = "") {
  const uidNormalizado = normalizeText(uid);
  if (!uidNormalizado) return [];

  const skinsRefs = getProjectCollectionCandidates(db, "users", uidNormalizado, "skins");
  const skinsMap = new Map();

  for (const skinsRef of skinsRefs) {
    try {
      const snap = await getDocs(skinsRef);
      snap.docs.forEach((docItem) => {
        if (skinsMap.has(docItem.id)) return;
        const data = docItem.data() || {};
        skinsMap.set(docItem.id, {
          id: docItem.id,
          username: normalizeText(data?.username),
          is_main: Boolean(data?.is_main),
          theme: normalizeText(data?.theme),
        });
      });
    } catch {
      // Segue com os snapshots disponiveis.
    }
  }

  return normalizarSkinsResumo(Array.from(skinsMap.values()));
}

export async function espelharUsuarioNoGerenciador(user, extras = {}) {
  if (!user?.uid || typeof user?.getIdToken !== "function") return;
  if (user?.isAnonymous === true) return;

  const url = buildSharedFunctionsUrl("espelharUsuarioProjeto");
  if (!url) return;

  const token = await user.getIdToken();
  const projectSystemKey = getProjectSystemKeyForMirror();
  const skinsResumo =
    extras?.ignorarSkins === true
      ? []
      : normalizarSkinsResumo(
          Array.isArray(extras?.skinsResumo) ? extras.skinsResumo : await coletarResumoSkinsDoUsuario(user.uid)
        );

  await fetch(url, {
    method: "POST",
    mode: "cors",
    credentials: "omit",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      uid: normalizeText(user.uid),
      nomeGoogle: normalizeText(user.displayName?.split(" ")[0] || ""),
      nomeCompletoGoogle: normalizeText(user.displayName),
      emailGoogle: normalizeText(user.email),
      picGoogle: normalizeText(user.photoURL),
      runtimeProjectKey: normalizeText(activeFirebaseProjectKey),
      projectSystemKey,
      skinsResumo,
    }),
  }).then(async (response) => {
    if (response.ok) return;
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error || "Falha ao espelhar usuario no gerenciador.");
  });
}

export const bootstrapUser = async (user) => {
  if (!user?.uid) return;
  if (user?.isAnonymous === true) {
    return { ignored: true, reason: "anonymous-user" };
  }
  if (typeof user.getIdToken === "function") {
    try {
      await user.getIdToken();
    } catch {
      // Mantem tentativa de bootstrap mesmo com falha transitoria de token.
    }
  }

  const userRefs = buildUserDocRefs(user.uid);
  const userSnap = await readFirstExisting(userRefs);

  if (!userSnap?.exists?.()) {
    await writeMirror(userRefs, {
      uid: user.uid,
      idGoogle: user.uid,
      nomeGoogle: user.displayName?.split(" ")[0] || "",
      nomeCompletoGoogle: user.displayName || "",
      emailGoogle: user.email || "",
      picGoogle: user.photoURL || "",
      isAdmin: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await appendLoginMirror(userRefs);
    try {
      await espelharUsuarioNoGerenciador(user);
    } catch (error) {
      console.warn("Falha ao espelhar usuario no gerenciador:", error);
    }
    return { isNew: true };
  }

  await writeMirror(userRefs, {
    uid: user.uid,
    nomeGoogle: user.displayName?.split(" ")[0] || "",
    nomeCompletoGoogle: user.displayName || "",
    emailGoogle: user.email || "",
    picGoogle: user.photoURL || "",
    updatedAt: serverTimestamp(),
  });

  await appendLoginMirror(userRefs);
  try {
    await espelharUsuarioNoGerenciador(user);
  } catch (error) {
    console.warn("Falha ao espelhar usuario no gerenciador:", error);
  }
  return { isNew: false };
};
