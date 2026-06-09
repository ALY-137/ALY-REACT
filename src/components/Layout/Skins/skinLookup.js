import { collectionGroup, getDocs, limit, query, where } from "firebase/firestore";
import { activeFirebaseProjectKey } from "../../Banco/init-firebase";
import { getProjectCollectionCandidates } from "../../Banco/projectDataRefs";
import { resolveProjectDataNamespaceKey } from "../../Banco/projectDataNamespace";

const VISIBILIDADES_AUTH = ["publico", "publico_restritivo", "privado"];
const VISIBILIDADES_SEMI_PUBLICAS = ["publico", "publico_restritivo"];

const normalizeUsername = (value = "") => String(value || "").trim();

const isRecoverableSkinQueryError = (error) =>
  error?.code === "permission-denied" || error?.code === "failed-precondition";

function buildSkinQueriesForUsername(
  skinsRef,
  username,
  { authenticated = false, allowPrivateWhenAuthenticated = true, includeLegacy = true } = {}
) {
  const normalized = normalizeUsername(username);
  if (!normalized) return [];

  const queries = [];
  if (authenticated && allowPrivateWhenAuthenticated) {
    queries.push(
      query(
        skinsRef,
        where("username", "==", normalized),
        where("visibilidade", "in", VISIBILIDADES_AUTH),
        limit(1)
      )
    );
    queries.push(
      query(
        skinsRef,
        where("username", "==", normalized),
        where("visibilidade", "in", VISIBILIDADES_SEMI_PUBLICAS),
        limit(1)
      )
    );
  }

  queries.push(
    query(skinsRef, where("username", "==", normalized), where("visibilidade", "==", "publico"), limit(1))
  );

  if (includeLegacy) {
    queries.push(
      query(skinsRef, where("username", "==", normalized), where("visibilidade", "==", null), limit(1))
    );
  }

  queries.push(query(skinsRef, where("username", "==", normalized), limit(1)));
  return queries;
}

function docPertenceAoNamespaceAtivo(docSnap = null) {
  const namespaceKey = resolveProjectDataNamespaceKey(activeFirebaseProjectKey);
  if (!namespaceKey) return true;

  const path = String(docSnap?.ref?.path || "").trim();
  if (!path) return false;

  const segments = path.split("/");
  return segments[0] === "projetos" && segments[1] === namespaceKey;
}

async function firstSkinDocFromQueries(queries = [], { filtrarNamespaceAtivo = false } = {}) {
  for (const skinQuery of queries) {
    try {
      const snap = await getDocs(skinQuery);
      if (!snap.empty) {
        const docValido = filtrarNamespaceAtivo
          ? snap.docs.find((docSnap) => docPertenceAoNamespaceAtivo(docSnap))
          : snap.docs[0];
        if (docValido) return docValido;
      }
    } catch (error) {
      if (!isRecoverableSkinQueryError(error)) {
        throw error;
      }
    }
  }
  return null;
}

function buildCollectionGroupQueriesForUsername(
  db,
  username,
  { authenticated = false, allowPrivateWhenAuthenticated = true, includeLegacy = true } = {}
) {
  const normalized = normalizeUsername(username);
  if (!normalized || !db) return [];

  const skinsGroupRef = collectionGroup(db, "skins");
  const queries = [];

  if (authenticated && allowPrivateWhenAuthenticated) {
    queries.push(
      query(
        skinsGroupRef,
        where("username", "==", normalized),
        where("visibilidade", "in", VISIBILIDADES_AUTH),
        limit(25)
      )
    );
    queries.push(
      query(
        skinsGroupRef,
        where("username", "==", normalized),
        where("visibilidade", "in", VISIBILIDADES_SEMI_PUBLICAS),
        limit(25)
      )
    );
  }

  queries.push(
    query(
      skinsGroupRef,
      where("username", "==", normalized),
      where("visibilidade", "==", "publico"),
      limit(25)
    )
  );

  if (includeLegacy) {
    queries.push(
      query(
        skinsGroupRef,
        where("username", "==", normalized),
        where("visibilidade", "==", null),
        limit(25)
      )
    );
  }

  return queries;
}

export function getOwnerUidFromSkinDoc(skinDoc = null) {
  const ownerFromPath = skinDoc?.ref?.parent?.parent?.id;
  if (ownerFromPath) return String(ownerFromPath || "").trim();
  return String(skinDoc?.data?.()?.ownerUserId || "").trim();
}

export async function findSkinByUsernameForOwner(
  db,
  ownerUid,
  username,
  options = {}
) {
  const ownerNorm = String(ownerUid || "").trim();
  const usernameNorm = normalizeUsername(username);
  if (!ownerNorm || !usernameNorm) return null;

  const skinsRefs = getProjectCollectionCandidates(db, "users", ownerNorm, "skins");
  for (const skinsRef of skinsRefs) {
    const found = await firstSkinDocFromQueries(
      buildSkinQueriesForUsername(skinsRef, usernameNorm, options)
    );
    if (found) return found;
  }
  return null;
}

export async function findSkinByUsernameAcrossProject(db, username, options = {}) {
  const usernameNorm = normalizeUsername(username);
  if (!usernameNorm) return null;

  const ownerUidCandidates = Array.isArray(options?.ownerUidCandidates)
    ? options.ownerUidCandidates.map((value) => String(value || "").trim()).filter(Boolean)
    : [];
  const seenOwners = new Set();

  for (const ownerUid of ownerUidCandidates) {
    if (seenOwners.has(ownerUid)) continue;
    seenOwners.add(ownerUid);
    const foundOwnerDoc = await findSkinByUsernameForOwner(db, ownerUid, usernameNorm, options);
    if (foundOwnerDoc) return foundOwnerDoc;
  }

  // Lookup global por username em todas as skins publicas/permitidas.
  // Evita depender de listagem da colecao /users, que pode ser bloqueada por regras.
  const groupQueries = buildCollectionGroupQueriesForUsername(db, usernameNorm, options);
  const foundByGroup = await firstSkinDocFromQueries(groupQueries, {
    filtrarNamespaceAtivo: true,
  });
  if (foundByGroup) return foundByGroup;

  const usersRefs = getProjectCollectionCandidates(db, "users");
  const maxUsers = Number.isFinite(Number(options?.maxUsers))
    ? Math.max(1, Number(options.maxUsers))
    : 300;

  for (const usersRef of usersRefs) {
    let usersSnap = null;
    try {
      usersSnap = await getDocs(query(usersRef, limit(maxUsers)));
    } catch (error) {
      if (isRecoverableSkinQueryError(error)) {
        continue;
      }
      throw error;
    }

    for (const userDoc of usersSnap.docs) {
      const ownerUid = String(userDoc.id || "").trim();
      if (!ownerUid || seenOwners.has(ownerUid)) continue;
      seenOwners.add(ownerUid);
      const foundDoc = await findSkinByUsernameForOwner(db, ownerUid, usernameNorm, options);
      if (foundDoc) return foundDoc;
    }
  }

  return null;
}

export async function skinUsernameExists(db, username, options = {}) {
  const found = await findSkinByUsernameAcrossProject(db, username, options);
  return Boolean(found);
}
