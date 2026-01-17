import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";

import { db } from "./init-firebase";

/* -------------------------------------------------------
   PEGAR TODAS AS PÁGINAS DO USER
------------------------------------------------------- */
export async function getEspacosDaSkin({ userId, skinId }) {
  const espacosRef = collection(db, "users", userId, "espacos");
  const snapshot = await getDocs(espacosRef);

  return snapshot.docs
    .map(doc => doc.data())
    .filter(p =>
      p.is_main === true ||
      p.skins_relacionadas?.includes(skinId)
    )
    .sort((a, b) => a.ordem - b.ordem);
}

/* -------------------------------------------------------
   CRIAR PÁGINA
------------------------------------------------------- */
export const createEspaco = async (userId, nome, skins = []) => {
  const espacosRef = collection(db, "users", userId, "espacos");

  const snapshot = await getDocs(espacosRef);
  const ordem = snapshot.size;

  const novaEspacoRef = doc(espacosRef);

  await setDoc(novaEspacoRef, {
    id_espaco: novaEspacoRef.id,
    nome,
    conteudo: "",
    is_main: false,
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
      is_main: docSnap.id === espacoId,
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
