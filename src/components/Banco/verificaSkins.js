import firebase from "firebase/app";
import "firebase/firestore";

export const verificarESalvarskins = async (userId, username, theme) => {
  try {
    const db = firebase.firestore();
    const userRef = db.collection("users").doc(userId);
    const skinsRef = userRef.collection("skins");

    // ─────────────────────────────────────────────
    // VERIFICAR SE O USERNAME DA SKIN JÁ EXISTE
    // ─────────────────────────────────────────────
    const snapshot = await db
      .collectionGroup("skins")
      .where("username", "==", username)
      .get();

    if (!snapshot.empty) {
      console.log("O nome de usuário da skin já existe.");
      return true;
    }

    // ─────────────────────────────────────────────
    // DEFINIR SE A SKIN SERÁ PRINCIPAL
    // ─────────────────────────────────────────────
    const allSkinsSnapshot = await skinsRef.get();
    const is_main = allSkinsSnapshot.empty ? true : false;

    // ─────────────────────────────────────────────
    // CRIAR A SKIN
    // ─────────────────────────────────────────────
    const id_skin = skinsRef.doc().id;

    await skinsRef.doc(id_skin).set({
      id_skin: id_skin,
      username: username,
      theme: theme,
      is_main: is_main,
      data: firebase.firestore.FieldValue.serverTimestamp(),
      iconSkin:
        "https://firebasestorage.googleapis.com/v0/b/teste-aa015.appspot.com/o/imagens%2Fthemes%2Fcyberpink%2Fviolet%2Fet.png?alt=media&token=4c09e6d5-5a0e-48d7-88ae-f56a9a5c1a5b",
    });

    // ─────────────────────────────────────────────
    // AGORA CRIA A PÁGINA PRINCIPAL EM:
    // users/{userId}/paginas/{paginaId}
    // ─────────────────────────────────────────────
    const paginasRef = userRef.collection("paginas");
    const id_pagina = paginasRef.doc().id;

    await paginasRef.doc(id_pagina).set({
      id_pagina,
      nome: "Home",
      conteudo: "Conteúdo da página principal",
      ordem: 0,
      is_main: true, // agora salva aqui
      skinOwner: id_skin, // opcional: vincular skin
      data: firebase.firestore.FieldValue.serverTimestamp(),
    });

    console.log("Skin e página principal criadas com sucesso!");
    return false;
  } catch (error) {
    console.error("Erro ao verificar e salvar skin:", error);
    return false;
  }
};
