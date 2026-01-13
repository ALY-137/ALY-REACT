import firebase from "firebase/app";
import "firebase/firestore";

const db = firebase.firestore();

/* -------------------------------------------------------
   PEGAR TODAS AS PÁGINAS DO USER
------------------------------------------------------- */
export async function getEspacosDaSkin({ userId, skinId }) {
  const snapshot = await db
    .collection("users")
    .doc(userId)
    .collection("espacos")
    .get();

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
   (pode receber 0, 1 ou várias skins)
------------------------------------------------------- */
export const createEspaco = async (userId, nome, skins = []) => {
  const espacosRef = db
    .collection("users")
    .doc(userId)
    .collection("espacos");

  const novaEspacoRef = espacosRef.doc();

  // ordem é o total de páginas existentes
  const snapshot = await espacosRef.get();
  const ordem = snapshot.size;

  // cria a página
  await novaEspacoRef.set({
    id_espaco: novaEspacoRef.id,
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
        espacos_relacionadas: firebase.firestore.FieldValue.arrayUnion(
          novaEspacoRef.id
        ),
      });
  }

  return novaEspacoRef.id;
};

/* -------------------------------------------------------
   ATUALIZAR NOME
------------------------------------------------------- */
export const updateEspacoNome = async (userId, espacoId, novoNome) => {
  const ref = db
    .collection("users")
    .doc(userId)
    .collection("espacos")
    .doc(espacoId);

  await ref.update({ nome: novoNome });
};

/* -------------------------------------------------------
   DEFINIR PÁGINA PRINCIPAL
------------------------------------------------------- */
export const setEspacoMain = async (userId, espacoId) => {
  const espacosRef = db
    .collection("users")
    .doc(userId)
    .collection("espacos");

  const snapshot = await espacosRef.get();
  const batch = db.batch();

  snapshot.forEach((doc) => {
    batch.update(doc.ref, {
      is_main: doc.id === espacoId,
    });
  });

  await batch.commit();
};

/* -------------------------------------------------------
   ATUALIZAR ORDEM
------------------------------------------------------- */
export const updateOrdemEspacos = async (userId, espacosOrdenadas) => {
  const espacosRef = db
    .collection("users")
    .doc(userId)
    .collection("espacos");

  const batch = db.batch();

  espacosOrdenadas.forEach((espaco, index) => {
    const ref = espacosRef.doc(espaco.id_espaco);
    batch.update(ref, { ordem: index });
  });

  await batch.commit();
};

/* -------------------------------------------------------
   EXCLUIR PÁGINA
------------------------------------------------------- */
export const deleteEspaco = async (userId, espacoId) => {

  // remover a página de todas as skins
  const skinsSnap = await db
    .collection("users")
    .doc(userId)
    .collection("skins")
    .get();

  for (const skin of skinsSnap.docs) {
    await skin.ref.update({
      espacos_relacionadas: firebase.firestore.FieldValue.arrayRemove(
        espacoId
      ),
    });
  }

  // deletar o documento da página
  await db
    .collection("users")
    .doc(userId)
    .collection("espacos")
    .doc(espacoId)
    .delete();
};
