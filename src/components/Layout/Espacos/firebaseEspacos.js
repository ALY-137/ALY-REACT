import {
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
  updateDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";

import { activeFirebaseProjectKey, db } from "../../Banco/init-firebase";
import {
  getFirstExistingProjectDocSnapshot,
  getLegacyProjectCollection,
  getLegacyProjectDoc,
  getPrimaryProjectCollection,
  getProjectCollectionCandidates,
  getProjectDocCandidates,
} from "../../Banco/projectDataRefs";
import { isProjectDataNamespaced } from "../../Banco/projectDataNamespace";
import { normalizeCyberpinkSubtheme } from "../Temas/cyberpink/subthemes";

const VISIBILIDADES_ESPACO_AUTENTICADO = [
  "publico",
  "publico_restritivo",
  "privado",
];

const getEstruturaPublicaEspacosRefs = (userId) =>
  getProjectCollectionCandidates(db, "users", userId, "espacos_publicos");
const getEstruturaPublicaEspacosRef = (userId) =>
  getPrimaryProjectCollection(db, "users", userId, "espacos_publicos");
const getLegacyEstruturaPublicaEspacosRef = (userId) =>
  getLegacyProjectCollection(db, "users", userId, "espacos_publicos");
const getEspacosRefs = (userId) =>
  getProjectCollectionCandidates(db, "users", userId, "espacos");
const getLegacyEspacosRef = (userId) =>
  getLegacyProjectCollection(db, "users", userId, "espacos");
const getEspacoDocRefs = (userId, espacoId) =>
  getProjectDocCandidates(db, "users", userId, "espacos", espacoId);
const getLegacyEspacoDocRef = (userId, espacoId) =>
  getLegacyProjectDoc(db, "users", userId, "espacos", espacoId);
const getSkinsRefs = (userId) =>
  getProjectCollectionCandidates(db, "users", userId, "skins");
const getSkinDocRefs = (userId, skinId) =>
  getProjectDocCandidates(db, "users", userId, "skins", skinId);

const namespaceAtivo = () => isProjectDataNamespaced(activeFirebaseProjectKey);

async function migrarEstruturaPublicaLegadaParaNamespace(userId, docs = []) {
  const userIdNormalizado = String(userId || "").trim();
  if (!userIdNormalizado || !namespaceAtivo() || !Array.isArray(docs) || !docs.length) {
    return false;
  }

  const destino = getEstruturaPublicaEspacosRef(userIdNormalizado);
  let migrou = false;

  for (const docSnap of docs) {
    const data = docSnap?.data?.() || {};
    const idEspaco = String(docSnap?.id || data?.id || data?.id_espaco || "").trim();
    if (!idEspaco) continue;

    await setDoc(
      doc(destino, idEspaco),
      {
        ...data,
        id_espaco: idEspaco,
        ownerUserId: String(data?.ownerUserId || userIdNormalizado).trim() || userIdNormalizado,
        atualizadoEm: serverTimestamp(),
      },
      { merge: true }
    );
    migrou = true;
  }

  return migrou;
}

async function migrarEspacosLegadosParaNamespace(userId, docs = []) {
  const userIdNormalizado = String(userId || "").trim();
  if (!userIdNormalizado || !namespaceAtivo() || !Array.isArray(docs) || !docs.length) {
    return false;
  }

  const destino = getPrimaryProjectCollection(db, "users", userIdNormalizado, "espacos");
  let migrou = false;

  for (const docSnap of docs) {
    const data = docSnap?.data?.() || {};
    const idEspaco = String(docSnap?.id || data?.id || data?.id_espaco || "").trim();
    if (!idEspaco) continue;

    const payload = {
      ...data,
      id: idEspaco,
      id_espaco: idEspaco,
      ownerUserId: String(data?.ownerUserId || userIdNormalizado).trim() || userIdNormalizado,
      atualizadoEm: serverTimestamp(),
    };

    await setDoc(doc(destino, idEspaco), payload, { merge: true });
    await sincronizarEstruturaPublicaEspaco(userIdNormalizado, payload);
    migrou = true;
  }

  return migrou;
}

export function construirEstruturaPublicaEspaco(espaco = {}, userId = "") {
  const ownerUserId = String(espaco?.ownerUserId || userId || "").trim();
  const idEspaco = String(espaco?.id || espaco?.id_espaco || "").trim();

  return {
    id_espaco: idEspaco,
    nome: String(espaco?.nome || "").trim(),
    ordem: Number.isFinite(espaco?.ordem) ? Number(espaco.ordem) : 0,
    ownerUserId,
    skinOwner: String(espaco?.skinOwner || "").trim() || null,
    visibilidade: String(espaco?.visibilidade || "publico").trim() || "publico",
    ordenacaoBlocos:
      String(espaco?.ordenacaoBlocos || "").trim() === "livre" ? "livre" : "postagem",
    iconCollectionId: String(espaco?.iconCollectionId || "").trim(),
    iconId: String(espaco?.iconId || "").trim(),
    iconUrl: String(espaco?.iconUrl || "").trim(),
    iconLabel: String(espaco?.iconLabel || "").trim(),
    subtema: normalizeCyberpinkSubtheme(espaco?.subtema),
    isHome: espaco?.isHome === true,
    skins_relacionadas: Array.isArray(espaco?.skins_relacionadas)
      ? espaco.skins_relacionadas.filter(Boolean)
      : [],
    atualizadoEm: serverTimestamp(),
  };
}

export async function sincronizarEstruturaPublicaEspaco(userId, espaco = {}) {
  const userIdNormalizado = String(userId || "").trim();
  const idEspaco = String(espaco?.id || espaco?.id_espaco || "").trim();

  if (!userIdNormalizado || !idEspaco) return;

  try {
    for (const estruturaRef of getEstruturaPublicaEspacosRefs(userIdNormalizado)) {
      await setDoc(
        doc(estruturaRef, idEspaco),
        construirEstruturaPublicaEspaco(espaco, userIdNormalizado),
        { merge: true }
      );
    }
  } catch (error) {
    if (error?.code === "permission-denied") {
      return false;
    }
    throw error;
  }

  return true;
}

export async function removerEstruturaPublicaEspaco(userId, espacoId) {
  const userIdNormalizado = String(userId || "").trim();
  const espacoIdNormalizado = String(espacoId || "").trim();
  if (!userIdNormalizado || !espacoIdNormalizado) return;

  try {
    for (const estruturaRef of getEstruturaPublicaEspacosRefs(userIdNormalizado)) {
      try {
        await deleteDoc(doc(estruturaRef, espacoIdNormalizado));
      } catch (errorDelete) {
        if (errorDelete?.code !== "not-found") {
          throw errorDelete;
        }
      }
    }
  } catch (error) {
    if (error?.code === "permission-denied") {
      return false;
    }
    throw error;
  }

  return true;
}

export async function getEspacosEstruturaPublica(userId) {
  const userIdNormalizado = String(userId || "").trim();
  if (!userIdNormalizado) return [];

  let snapshot = null;
  for (const estruturaRef of getEstruturaPublicaEspacosRefs(userIdNormalizado)) {
    const snapAtual = await getDocs(query(estruturaRef));
    if (!snapshot || !snapAtual.empty) {
      snapshot = snapAtual;
    }
    if (snapAtual.docs.length) break;
  }
  if ((!snapshot || snapshot.empty) && namespaceAtivo()) {
    const legacySnap = await getDocs(query(getLegacyEstruturaPublicaEspacosRef(userIdNormalizado)));
    if (legacySnap.docs.length) {
      snapshot = legacySnap;
      await migrarEstruturaPublicaLegadaParaNamespace(userIdNormalizado, legacySnap.docs);
    }
  }
  if (!snapshot && !namespaceAtivo()) return [];
  if (!snapshot) {
    snapshot = { empty: true, docs: [] };
  }

  return snapshot.docs
    .map((docSnap) => {
      const data = docSnap.data() || {};
      return {
        id: docSnap.id,
        ownerUserId: data.ownerUserId || userIdNormalizado,
        ...data,
      };
    })
    .sort((a, b) => (Number(a?.ordem) || 0) - (Number(b?.ordem) || 0));
}

export async function getEspacoCompleto(userId, espacoId) {
  const userIdNormalizado = String(userId || "").trim();
  const espacoIdNormalizado = String(espacoId || "").trim();
  if (!userIdNormalizado || !espacoIdNormalizado) return null;

  const snap = await getFirstExistingProjectDocSnapshot(
    db,
    "users",
    userIdNormalizado,
    "espacos",
    espacoIdNormalizado
  );
  if (!snap?.exists?.()) {
    if (!namespaceAtivo()) return null;

    const legacySnap = await getDoc(getLegacyEspacoDocRef(userIdNormalizado, espacoIdNormalizado));
    if (!legacySnap.exists()) return null;

    await migrarEspacosLegadosParaNamespace(userIdNormalizado, [legacySnap]);

    return {
      id: legacySnap.id,
      ownerUserId: legacySnap.data()?.ownerUserId || userIdNormalizado,
      ...legacySnap.data(),
    };
  }

  return {
    id: snap.id,
    ownerUserId: snap.data()?.ownerUserId || userIdNormalizado,
    ...snap.data(),
  };
}

/* -------------------------------------------------------
   PEGAR TODAS AS PÁGINAS DO USER
------------------------------------------------------- */
export async function getEspacosDaSkin({ userId, skinId, viewerUserId = null }) {
  const espacosRefs = getEspacosRefs(userId);
  const isOwner = viewerUserId && viewerUserId === userId;
  let snapshot = null;
  for (const espacosRef of espacosRefs) {
    const espacosQuery = query(
      espacosRef,
      where("skins_relacionadas", "array-contains", skinId)
    );
    try {
      const snapAtual = await getDocs(espacosQuery);
      if (!snapshot || !snapAtual.empty) {
        snapshot = snapAtual;
      }
      if (!snapAtual.empty) break;
      continue;
    } catch (err) {
      if (err?.code !== "permission-denied") {
        throw err;
      }
    }

    let compatQuery = query(
      espacosRef,
      where("skins_relacionadas", "array-contains", skinId),
      where("visibilidade", "==", "publico")
    );
    if (viewerUserId && !isOwner) {
      compatQuery = query(
        espacosRef,
        where("skins_relacionadas", "array-contains", skinId),
        where("visibilidade", "in", VISIBILIDADES_ESPACO_AUTENTICADO)
      );
    }
    if (isOwner) {
      compatQuery = query(
        espacosRef,
        where("skins_relacionadas", "array-contains", skinId)
      );
    }
    const compatSnap = await getDocs(compatQuery);
    if (!snapshot || !compatSnap.empty) {
      snapshot = compatSnap;
    }
    if (!compatSnap.empty) break;
  }
  if (!snapshot && !namespaceAtivo()) return [];
  if (!snapshot) {
    snapshot = { empty: true, docs: [] };
  }

  // Fallback para esquema legado: documentos sem skins_relacionadas, mas com skinOwner.
  if (snapshot.empty) {
    for (const espacosRef of espacosRefs) {
      const legacyQuery = query(espacosRef, where("skinOwner", "==", skinId));

      try {
        const legacySnap = await getDocs(legacyQuery);
        if (!snapshot || !legacySnap.empty) {
          snapshot = legacySnap;
        }
        if (!legacySnap.empty) break;
        continue;
      } catch (err) {
        if (err?.code !== "permission-denied") {
          throw err;
        }
      }

      let compatLegacyQuery = query(
        espacosRef,
        where("skinOwner", "==", skinId),
        where("visibilidade", "==", "publico")
      );
      if (viewerUserId && !isOwner) {
        compatLegacyQuery = query(
          espacosRef,
          where("skinOwner", "==", skinId),
          where("visibilidade", "in", VISIBILIDADES_ESPACO_AUTENTICADO)
        );
      }
      if (isOwner) {
        compatLegacyQuery = query(
          espacosRef,
          where("skinOwner", "==", skinId)
        );
      }
      const compatLegacySnap = await getDocs(compatLegacyQuery);
      if (!snapshot || !compatLegacySnap.empty) {
        snapshot = compatLegacySnap;
      }
      if (!compatLegacySnap.empty) break;
    }
  }

  if (snapshot.empty && namespaceAtivo()) {
    const legacyEspacosRef = getLegacyEspacosRef(userId);
    const consultasLegadas = [];

    consultasLegadas.push(query(legacyEspacosRef, where("skins_relacionadas", "array-contains", skinId)));
    consultasLegadas.push(query(legacyEspacosRef, where("skinOwner", "==", skinId)));

    for (const consulta of consultasLegadas) {
      try {
        const legacySnap = await getDocs(consulta);
        if (!legacySnap.empty) {
          snapshot = legacySnap;
          await migrarEspacosLegadosParaNamespace(userId, legacySnap.docs);
          break;
        }
      } catch (err) {
        if (err?.code !== "permission-denied" && err?.code !== "failed-precondition") {
          throw err;
        }
      }
    }
  }

  // Fallback para docs sem visibilidade definida (null/missing), tratados como públicos.
  if (snapshot.empty) {
    for (const espacosRef of espacosRefs) {
      const nullVisByRelationQuery = query(
        espacosRef,
        where("skins_relacionadas", "array-contains", skinId),
        where("visibilidade", "==", null)
      );
      try {
        const nullSnap = await getDocs(nullVisByRelationQuery);
        if (!snapshot || !nullSnap.empty) {
          snapshot = nullSnap;
        }
        if (!nullSnap.empty) break;
      } catch (err) {
        if (err?.code !== "permission-denied") throw err;
      }
    }
  }

  if (snapshot.empty) {
    for (const espacosRef of espacosRefs) {
      const nullVisByOwnerQuery = query(
        espacosRef,
        where("skinOwner", "==", skinId),
        where("visibilidade", "==", null)
      );
      try {
        const nullOwnerSnap = await getDocs(nullVisByOwnerQuery);
        if (!snapshot || !nullOwnerSnap.empty) {
          snapshot = nullOwnerSnap;
        }
        if (!nullOwnerSnap.empty) break;
      } catch (err) {
        if (err?.code !== "permission-denied") throw err;
      }
    }
  }

  return snapshot.docs
    .map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ownerUserId: data.ownerUserId || userId,
        ...data,
      };
    })
    .sort((a, b) => a.ordem - b.ordem);
}

export async function getEspacosDoOwner({
  userId,
  viewerUserId = null,
  ignorarVisibilidade = false,
}) {
  const espacosRefs = getEspacosRefs(userId);
  const isOwner = viewerUserId && viewerUserId === userId;

  let snapshot = null;
  for (const espacosRef of espacosRefs) {
    try {
      const snapAtual = await getDocs(query(espacosRef));
      if (!snapshot || !snapAtual.empty) {
        snapshot = snapAtual;
      }
      if (!snapAtual.empty) break;
      continue;
    } catch (err) {
      if (err?.code !== "permission-denied") {
        throw err;
      }
      if (ignorarVisibilidade) {
        throw err;
      }
    }

    let compatQuery = query(espacosRef, where("visibilidade", "==", "publico"));

    if (viewerUserId && !isOwner) {
      compatQuery = query(
        espacosRef,
        where("visibilidade", "in", VISIBILIDADES_ESPACO_AUTENTICADO)
      );
    }

    if (isOwner) {
      compatQuery = query(espacosRef);
    }

    const compatSnap = await getDocs(compatQuery);
    if (!snapshot || !compatSnap.empty) {
      snapshot = compatSnap;
    }
    if (!compatSnap.empty) break;
  }
  if (!snapshot) return [];

  if (snapshot.empty && !ignorarVisibilidade) {
    for (const espacosRef of espacosRefs) {
      const nullVisibilityQuery = query(
        espacosRef,
        where("visibilidade", "==", null)
      );
      try {
        const nullSnap = await getDocs(nullVisibilityQuery);
        if (!snapshot || !nullSnap.empty) {
          snapshot = nullSnap;
        }
        if (!nullSnap.empty) break;
      } catch (err) {
        if (err?.code !== "permission-denied") throw err;
      }
    }
  }

  if (snapshot.empty && namespaceAtivo()) {
    try {
      const legacySnap = await getDocs(query(getLegacyEspacosRef(userId)));
      if (!legacySnap.empty) {
        snapshot = legacySnap;
        await migrarEspacosLegadosParaNamespace(userId, legacySnap.docs);
      }
    } catch (err) {
      if (err?.code !== "permission-denied" && err?.code !== "failed-precondition") {
        throw err;
      }
    }
  }

  return snapshot.docs
    .map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ownerUserId: data.ownerUserId || userId,
        ...data,
      };
    })
    .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
}

/* -------------------------------------------------------
   CRIAR PÁGINA
------------------------------------------------------- */
export const createEspaco = async (userId, nome, skins = []) => {
  const espacosRefs = getEspacosRefs(userId);
  const espacosRef = espacosRefs[0];

  const snapshot = await getDocs(espacosRef);
  const ordem = snapshot.docs.filter(d =>
  d.data().skins_relacionadas?.includes(skinId)
).length;

  const novaEspacoRef = doc(espacosRef);

  const novoEspaco = {
    id_espaco: novaEspacoRef.id,
    nome,
    conteudo: "",
    is_main: true,
    ordem,
    skins_relacionadas: skins,
    data: serverTimestamp(),
  };

  for (const espacosRefItem of espacosRefs) {
    await setDoc(doc(espacosRefItem, novaEspacoRef.id), novoEspaco, { merge: true });
  }
  await sincronizarEstruturaPublicaEspaco(userId, {
    ...novoEspaco,
    id: novaEspacoRef.id,
    ownerUserId: userId,
  });

  // atualizar skins
  for (const skinId of skins) {
    for (const skinRef of getSkinDocRefs(userId, skinId)) {
      await setDoc(
        skinRef,
        {
          espacos_relacionadas: arrayUnion(novaEspacoRef.id),
        },
        { merge: true }
      );
    }
  }

  return novaEspacoRef.id;
};

/* -------------------------------------------------------
   ATUALIZAR NOME
------------------------------------------------------- */
export const updateEspacoNome = async (userId, espacoId, novoNome) => {
  for (const ref of getEspacoDocRefs(userId, espacoId)) {
    await setDoc(ref, { nome: novoNome }, { merge: true });
  }
  const espacoAtualizado = await getEspacoCompleto(userId, espacoId);
  await sincronizarEstruturaPublicaEspaco(userId, espacoAtualizado);
};

/* -------------------------------------------------------
   DEFINIR PÁGINA PRINCIPAL
------------------------------------------------------- */
export const setEspacoMain = async (userId, espacoId) => {
  for (const espacosRef of getEspacosRefs(userId)) {
    const snapshot = await getDocs(espacosRef);
    const batch = writeBatch(db);
    snapshot.forEach((docSnap) => {
      batch.update(docSnap.ref, {
        is_main: docSnap.id === espacoId,
      });
    });
    await batch.commit();
  }
};

/* -------------------------------------------------------
   ATUALIZAR ORDEM
------------------------------------------------------- */
export const updateOrdemEspacos = async (userId, espacosOrdenadas) => {
  for (const espacosRef of getEspacosRefs(userId)) {
    const batch = writeBatch(db);
    espacosOrdenadas.forEach((espaco, index) => {
      const ref = doc(espacosRef, espaco.id_espaco);
      batch.set(ref, { ordem: index }, { merge: true });
    });
    await batch.commit();
  }

  await Promise.all(
    espacosOrdenadas.map((espaco, index) =>
      sincronizarEstruturaPublicaEspaco(userId, {
        ...espaco,
        ordem: index,
      })
    )
  );
};

/* -------------------------------------------------------
   EXCLUIR PÁGINA
------------------------------------------------------- */
export const deleteEspaco = async (userId, espacoId) => {
  for (const skinsRef of getSkinsRefs(userId)) {
    const skinsSnap = await getDocs(skinsRef);
    for (const skin of skinsSnap.docs) {
      await updateDoc(skin.ref, {
        espacos_relacionadas: arrayRemove(espacoId),
      });
    }
  }

  for (const espacoRef of getEspacoDocRefs(userId, espacoId)) {
    try {
      await deleteDoc(espacoRef);
    } catch (errorDelete) {
      if (errorDelete?.code !== "not-found") {
        throw errorDelete;
      }
    }
  }
  await removerEstruturaPublicaEspaco(userId, espacoId);
};
