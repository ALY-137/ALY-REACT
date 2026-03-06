// verificaSkins.js
import {
  collection,
  collectionGroup,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";

import { db } from "../../Banco/init-firebase";
import { sincronizarEstruturaPublicaEspaco } from "../Espacos/firebaseEspacos";

// ===============================
// FUNCAO PARA VERIFICAR E CRIAR SKIN
// ===============================
export const verificarESalvarskins = async (userId, username, theme) => {
  try {
    if (!userId) {
      return { sucesso: false, mensagem: "Usuario nao autenticado." };
    }

    const userRef = doc(db, "users", userId);
    const skinsRef = collection(userRef, "skins");

    // Garante documento pai do usuario para evitar "not-found" em updates futuros.
    await setDoc(
      userRef,
      {
        uid: userId,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    // Verificar se o username ja existe nas skins publicas/restritivas
    // (skins privadas de terceiros nao sao consultaveis por regra)
    const publicQuery = query(
      collectionGroup(db, "skins"),
      where("username", "==", username),
      where("visibilidade", "in", ["publico", "publico_restritivo", "privado"]),
      limit(1)
    );

    try {
      const publicSnapshot = await getDocs(publicQuery);
      if (!publicSnapshot.empty) {
        console.log("O nome de usuario da skin ja existe.");
        return { sucesso: false, mensagem: "O nome de usuario ja existe!" };
      }
    } catch (err) {
      if (err?.code !== "permission-denied") throw err;
      return {
        sucesso: false,
        mensagem: "Sem permissao para validar usernames neste projeto.",
        errorCode: "permission-denied",
      };
    }

    // Verificar conflito dentro do proprio usuario
    const ownQuery = query(skinsRef, where("username", "==", username), limit(1));
    const ownSnapshot = await getDocs(ownQuery);
    if (!ownSnapshot.empty) {
      return { sucesso: false, mensagem: "Voce ja possui uma skin com esse nome." };
    }

    // Definir se e a skin principal
    const allSkinsSnapshot = await getDocs(skinsRef);
    const is_main = allSkinsSnapshot.empty;

    // Criar a skin
    const id_skin = doc(skinsRef).id;

    await setDoc(doc(skinsRef, id_skin), {
      ownerUserId: userId,
      id_skin,
      username,
      theme,
      cardProfileUrl: "",
      cardProfilePath: "",
      is_main,
      visibilidade: "publico",
      data: serverTimestamp(),
      iconSkin:
        "https://firebasestorage.googleapis.com/v0/b/teste-aa015.appspot.com/o/imagens%2Fthemes%2Fcyberpink%2Fviolet%2Fet.png?alt=media&token=4c09e6d5-5a0e-48d7-88ae-f56a9a5c1a5b",
    });

    // Criar o espaco principal (Home)
    const espacosRef = collection(userRef, "espacos");
    const id_espaco = doc(espacosRef).id;
    const homeData = {
      id_espaco,
      nome: "Home",
      conteudo: "Conteudo da pagina principal",
      ordem: 0,
      ownerUserId: userId,
      skinOwner: id_skin,
      coCriadoresUids: [],
      visibilidade: "publico",
      createdAt: serverTimestamp(),
      isHome: true,
      skins_relacionadas: [id_skin],
    };

    await setDoc(doc(espacosRef, id_espaco), homeData);
    await sincronizarEstruturaPublicaEspaco(userId, { ...homeData, id: id_espaco });

    console.log("Skin e pagina principal criadas com sucesso!");
    return { sucesso: true, id_skin };
  } catch (error) {
    if (error?.code === "permission-denied") {
      return {
        sucesso: false,
        mensagem: "Sem permissao para criar skin neste projeto.",
        errorCode: "permission-denied",
      };
    }
    console.error("Erro ao verificar e salvar skin:", error);
    return { sucesso: false, mensagem: "Erro ao criar skin", errorCode: error?.code || "" };
  }
};
