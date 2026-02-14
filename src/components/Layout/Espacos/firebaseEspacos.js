import {
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
        where("visibilidade", "in", ["publico", "publico_restritivo", "privado"])
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
          where("visibilidade", "in", ["publico", "publico_restritivo", "privado"])
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

  await setDoc(novaEspacoRef, {
    id_espaco: novaEspacoRef.id,
    nome,
    conteudo: "",
    is_main: true,
    ordem,
    skins_relacionadas: skins,
    data: serverTimestamp(),
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
};
