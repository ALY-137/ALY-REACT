import {
  getDoc,
  collection,
  doc,
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

import { db } from "../../Banco/init-firebase";

const VISIBILIDADES_ESPACO_RESTRITAS = [
  "publico",
  "publico_restritivo",
  "privado",
  "exclusivo_assinante",
  "exclusivo_comprador",
  "comprado",
];

const getEstruturaPublicaEspacosRef = (userId) =>
  collection(db, "users", userId, "espacos_publicos");

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
    iconCollectionId: String(espaco?.iconCollectionId || "").trim(),
    iconId: String(espaco?.iconId || "").trim(),
    iconUrl: String(espaco?.iconUrl || "").trim(),
    iconLabel: String(espaco?.iconLabel || "").trim(),
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
    await setDoc(
      doc(getEstruturaPublicaEspacosRef(userIdNormalizado), idEspaco),
      construirEstruturaPublicaEspaco(espaco, userIdNormalizado),
      { merge: true }
    );
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
    await deleteDoc(doc(getEstruturaPublicaEspacosRef(userIdNormalizado), espacoIdNormalizado));
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

  const snapshot = await getDocs(query(getEstruturaPublicaEspacosRef(userIdNormalizado)));

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

  const snap = await getDoc(doc(db, "users", userIdNormalizado, "espacos", espacoIdNormalizado));
  if (!snap.exists()) return null;

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
  const espacosRef = collection(db, "users", userId, "espacos");
  const isOwner = viewerUserId && viewerUserId === userId;

  const espacosQuery = query(
    espacosRef,
    where("skins_relacionadas", "array-contains", skinId)
  );

  let snapshot;
  try {
    snapshot = await getDocs(espacosQuery);
  } catch (err) {
    if (err?.code !== "permission-denied") {
      throw err;
    }

    // Compatibilidade com regras antigas: tenta faixas mais abertas por perfil de viewer.
    let compatQuery = query(
      espacosRef,
      where("skins_relacionadas", "array-contains", skinId),
      where("visibilidade", "==", "publico")
    );
    if (viewerUserId && !isOwner) {
      compatQuery = query(
        espacosRef,
        where("skins_relacionadas", "array-contains", skinId),
        where("visibilidade", "in", VISIBILIDADES_ESPACO_RESTRITAS)
      );
    }
    if (isOwner) {
      compatQuery = query(
        espacosRef,
        where("skins_relacionadas", "array-contains", skinId)
      );
    }
    snapshot = await getDocs(compatQuery);
  }

  // Fallback para esquema legado: documentos sem skins_relacionadas, mas com skinOwner.
  if (snapshot.empty) {
    const legacyQuery = query(
      espacosRef,
      where("skinOwner", "==", skinId)
    );

    try {
      snapshot = await getDocs(legacyQuery);
    } catch (err) {
      if (err?.code !== "permission-denied") {
        throw err;
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
          where("visibilidade", "in", VISIBILIDADES_ESPACO_RESTRITAS)
        );
      }
      if (isOwner) {
        compatLegacyQuery = query(
          espacosRef,
          where("skinOwner", "==", skinId)
        );
      }
      snapshot = await getDocs(compatLegacyQuery);
    }
  }

  // Fallback para docs sem visibilidade definida (null/missing), tratados como públicos.
  if (snapshot.empty) {
    const nullVisByRelationQuery = query(
      espacosRef,
      where("skins_relacionadas", "array-contains", skinId),
      where("visibilidade", "==", null)
    );
    try {
      snapshot = await getDocs(nullVisByRelationQuery);
    } catch (err) {
      if (err?.code !== "permission-denied") throw err;
    }
  }

  if (snapshot.empty) {
    const nullVisByOwnerQuery = query(
      espacosRef,
      where("skinOwner", "==", skinId),
      where("visibilidade", "==", null)
    );
    try {
      snapshot = await getDocs(nullVisByOwnerQuery);
    } catch (err) {
      if (err?.code !== "permission-denied") throw err;
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
  const espacosRef = collection(db, "users", userId, "espacos");
  const isOwner = viewerUserId && viewerUserId === userId;

  let snapshot;
  try {
    snapshot = await getDocs(query(espacosRef));
  } catch (err) {
    if (err?.code !== "permission-denied") {
      throw err;
    }

    if (ignorarVisibilidade) {
      throw err;
    }

    let compatQuery = query(espacosRef, where("visibilidade", "==", "publico"));

    if (viewerUserId && !isOwner) {
      compatQuery = query(
        espacosRef,
        where("visibilidade", "in", VISIBILIDADES_ESPACO_RESTRITAS)
      );
    }

    if (isOwner) {
      compatQuery = query(espacosRef);
    }

    snapshot = await getDocs(compatQuery);
  }

  if (snapshot.empty && !ignorarVisibilidade) {
    const nullVisibilityQuery = query(
      espacosRef,
      where("visibilidade", "==", null)
    );
    try {
      snapshot = await getDocs(nullVisibilityQuery);
    } catch (err) {
      if (err?.code !== "permission-denied") throw err;
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
  const espacosRef = collection(db, "users", userId, "espacos");

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

  await setDoc(novaEspacoRef, novoEspaco);
  await sincronizarEstruturaPublicaEspaco(userId, {
    ...novoEspaco,
    id: novaEspacoRef.id,
    ownerUserId: userId,
  });

  // atualizar skins
  for (const skinId of skins) {
    const skinRef = doc(db, "users", userId, "skins", skinId);
    await updateDoc(skinRef, {
      espacos_relacionadas: arrayUnion(novaEspacoRef.id),
    });
  }

  return novaEspacoRef.id;
};

/* -------------------------------------------------------
   ATUALIZAR NOME
------------------------------------------------------- */
export const updateEspacoNome = async (userId, espacoId, novoNome) => {
  const ref = doc(db, "users", userId, "espacos", espacoId);
  await updateDoc(ref, { nome: novoNome });
  const espacoAtualizado = await getEspacoCompleto(userId, espacoId);
  await sincronizarEstruturaPublicaEspaco(userId, espacoAtualizado);
};

/* -------------------------------------------------------
   DEFINIR PÁGINA PRINCIPAL
------------------------------------------------------- */
export const setEspacoMain = async (userId, espacoId) => {
  const espacosRef = collection(db, "users", userId, "espacos");
  const snapshot = await getDocs(espacosRef);

  const batch = writeBatch(db);

  snapshot.forEach((docSnap) => {
    batch.update(docSnap.ref, {
      is_main: skinId === espaco.skinOwner

    });
  });

  await batch.commit();
};

/* -------------------------------------------------------
   ATUALIZAR ORDEM
------------------------------------------------------- */
export const updateOrdemEspacos = async (userId, espacosOrdenadas) => {
  const batch = writeBatch(db);

  espacosOrdenadas.forEach((espaco, index) => {
    const ref = doc(db, "users", userId, "espacos", espaco.id_espaco);
    batch.update(ref, { ordem: index });
  });

  await batch.commit();

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
  const skinsRef = collection(db, "users", userId, "skins");
  const skinsSnap = await getDocs(skinsRef);

  for (const skin of skinsSnap.docs) {
    await updateDoc(skin.ref, {
      espacos_relacionadas: arrayRemove(espacoId),
    });
  }

  const espacoRef = doc(db, "users", userId, "espacos", espacoId);
  await deleteDoc(espacoRef);
  await removerEstruturaPublicaEspaco(userId, espacoId);
};
