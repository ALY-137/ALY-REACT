import { collection, doc, getDoc } from "firebase/firestore";
import { activeFirebaseProjectKey } from "./init-firebase";
import { buildProjectDataPathCandidates } from "./projectDataNamespace";

function normalizeSegments(segments = []) {
  return Array.isArray(segments) ? segments.filter(Boolean) : [];
}

function resolvePathCandidates(segments = []) {
  const normalized = normalizeSegments(segments);
  return buildProjectDataPathCandidates(normalized, {
    activeProjectKey: activeFirebaseProjectKey,
  });
}

function resolveLegacyPath(segments = []) {
  return normalizeSegments(segments);
}

export function getProjectDocCandidates(db, ...segments) {
  return resolvePathCandidates(segments).map((path) => doc(db, ...path));
}

export function getProjectCollectionCandidates(db, ...segments) {
  return resolvePathCandidates(segments).map((path) => collection(db, ...path));
}

export function getPrimaryProjectDoc(db, ...segments) {
  return getProjectDocCandidates(db, ...segments)[0];
}

export function getPrimaryProjectCollection(db, ...segments) {
  return getProjectCollectionCandidates(db, ...segments)[0];
}

export async function getFirstExistingProjectDocSnapshot(db, ...segments) {
  const refs = getProjectDocCandidates(db, ...segments);
  for (const refItem of refs) {
    const snap = await getDoc(refItem);
    if (snap.exists()) return snap;
  }
  return null;
}

export function getLegacyProjectDoc(db, ...segments) {
  return doc(db, ...resolveLegacyPath(segments));
}

export function getLegacyProjectCollection(db, ...segments) {
  return collection(db, ...resolveLegacyPath(segments));
}
