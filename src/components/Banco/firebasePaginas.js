import firebase from "firebase/app";
import "firebase/firestore";

const db = firebase.firestore();

/* -------------------------------------------------------
   PEGAR TODAS AS PÁGINAS DO USER
------------------------------------------------------- */
export const getPaginas = async (userId, skinId) => {
  const paginasRef = db
    .collection("users")
    .doc(userId)
    .collection("paginas");

  const snapshot = await paginasRef
    .where("skins_relacionadas", "array-contains", skinId)
    .orderBy("ordem")
    .get();

  return snapshot.docs.map((doc) => ({
    id_pagina: doc.id,
    ...doc.data(),
  }));
};


/* -------------------------------------------------------
   CRIAR PÁGINA
   (pode receber 0, 1 ou várias skins)
------------------------------------------------------- */
export const createPagina = async (userId, nome, skins = []) => {
  const paginasRef = db
    .collection("users")
    .doc(userId)
    .collection("paginas");

  const novaPaginaRef = paginasRef.doc();

  // ordem é o total de páginas existentes
  const snapshot = await paginasRef.get();
  const ordem = snapshot.size;

  // cria a página
  await novaPaginaRef.set({
    id_pagina: novaPaginaRef.id,
    nome: nome,
    conteudo: "",
    is_main: false,
    ordem: ordem,

    // *** ALTERADO ***
    skins_relacionadas: skins,      

    data: firebase.firestore.FieldValue.serverTimestamp(),
  });

  // atualizar cada skin
  for (const skinId of skins) {
    await db
      .collection("users")
      .doc(userId)
      .collection("skins")
      .doc(skinId)
      .update({
        paginas_relacionadas: firebase.firestore.FieldValue.arrayUnion(
          novaPaginaRef.id
        ),
      });
  }

  return novaPaginaRef.id;
};

/* -------------------------------------------------------
   ATUALIZAR NOME
------------------------------------------------------- */
export const updatePaginaNome = async (userId, paginaId, novoNome) => {
  const ref = db
    .collection("users")
    .doc(userId)
    .collection("paginas")
    .doc(paginaId);

  await ref.update({ nome: novoNome });
};

/* -------------------------------------------------------
   DEFINIR PÁGINA PRINCIPAL
------------------------------------------------------- */
export const setPaginaMain = async (userId, paginaId) => {
  const paginasRef = db
    .collection("users")
    .doc(userId)
    .collection("paginas");

  const snapshot = await paginasRef.get();
  const batch = db.batch();

  snapshot.forEach((doc) => {
    batch.update(doc.ref, {
      is_main: doc.id === paginaId,
    });
  });

  await batch.commit();
};

/* -------------------------------------------------------
   ATUALIZAR ORDEM
------------------------------------------------------- */
export const updateOrdemPaginas = async (userId, paginasOrdenadas) => {
  const paginasRef = db
    .collection("users")
    .doc(userId)
    .collection("paginas");

  const batch = db.batch();

  paginasOrdenadas.forEach((pagina, index) => {
    const ref = paginasRef.doc(pagina.id_pagina);
    batch.update(ref, { ordem: index });
  });

  await batch.commit();
};

/* -------------------------------------------------------
   EXCLUIR PÁGINA
------------------------------------------------------- */
export const deletePagina = async (userId, paginaId) => {

  // remover a página de todas as skins
  const skinsSnap = await db
    .collection("users")
    .doc(userId)
    .collection("skins")
    .get();

  for (const skin of skinsSnap.docs) {
    await skin.ref.update({
      paginas_relacionadas: firebase.firestore.FieldValue.arrayRemove(
        paginaId
      ),
    });
  }

  // deletar o documento da página
  await db
    .collection("users")
    .doc(userId)
    .collection("paginas")
    .doc(paginaId)
    .delete();
};
