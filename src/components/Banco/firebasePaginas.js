import firebase from "firebase/app";
import 'firebase/firestore';

const db = firebase.firestore();


export const getPaginas = async (userId, skinId) => {
  const paginasRef = db.collection('users').doc(userId)
    .collection('skins').doc(skinId).collection('paginas');

  const snapshot = await paginasRef.orderBy('ordem').get();
  return snapshot.docs.map(doc => doc.data());
};

export const createPagina = async (userId, skinId, nome) => {
  const paginasRef = db.collection('users').doc(userId).collection('skins').doc(skinId).collection('paginas');

  const id = paginasRef.doc().id;

  const snapshot = await paginasRef.get();
  const ordem = snapshot.size; // próxima posição

  await paginasRef.doc(id).set({
    id_pagina: id,
    nome: nome,
    conteudo: '',
    is_main: false,
    ordem: ordem,
    data: firebase.firestore.FieldValue.serverTimestamp()
  });
};

export const updatePaginaNome = async (userId, skinId, paginaId, novoNome) => {
  const ref = db.collection('users').doc(userId)
    .collection('skins').doc(skinId).collection('paginas').doc(paginaId);

  await ref.update({ nome: novoNome });
};

export const setPaginaMain = async (userId, skinId, paginaId) => {
  const paginasRef = db.collection('users').doc(userId)
    .collection('skins').doc(skinId).collection('paginas');

  const snapshot = await paginasRef.get();
  const batch = db.batch();

  snapshot.forEach(doc => {
    const ref = doc.ref;
    batch.update(ref, { is_main: ref.id === paginaId });
  });

  await batch.commit();
};

export const updateOrdemPaginas = async (userId, skinId, paginasOrdenadas) => {
  const paginasRef = db.collection('users').doc(userId)
    .collection('skins').doc(skinId).collection('paginas');

  const batch = db.batch();

  paginasOrdenadas.forEach((pagina, index) => {
    const ref = paginasRef.doc(pagina.id_pagina);
    batch.update(ref, { ordem: index });
  });

  await batch.commit();
};

export async function deletePagina(idGoogleCap, skinLogadaId, paginaId) {
  const ref = db
    .collection("users")
    .doc(idGoogleCap)
    .collection("skins")
    .doc(skinLogadaId)
    .collection("paginas")
    .doc(paginaId);

  await ref.delete();
}