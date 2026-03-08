import { getDocs, limit, query, where } from "firebase/firestore";
import { getProjectCollectionCandidates } from "../../Banco/projectDataRefs";

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

async function firstSkinDocFromQueries(queries = []) {
  for (const skinQuery of queries) {
    try {
      const snap = await getDocs(skinQuery);
      if (!snap.empty) return snap.docs[0];
    } catch (error) {
      if (!isRecoverableSkinQueryError(error)) {
        throw error;
      }
    }
  }
  return null;
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

