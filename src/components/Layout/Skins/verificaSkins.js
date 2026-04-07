// verificaSkins.js
import {
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
import { normalizeCyberpinkSubtheme } from "../Temas/cyberpink/subthemes";
import {
  getProjectCollectionCandidates,
  getProjectDocCandidates,
} from "../../Banco/projectDataRefs";
import {
  findSkinByUsernameAcrossProject,
  getOwnerUidFromSkinDoc,
} from "./skinLookup";

// ===============================
// FUNCAO PARA VERIFICAR E CRIAR SKIN
// ===============================
export const verificarESalvarskins = async (
  userId,
  username,
  theme,
  { iconSkinPadraoUrl = "" } = {}
) => {
  try {
    if (!userId) {
      return { sucesso: false, mensagem: "Usuario nao autenticado." };
    }

    const userRefs = getProjectDocCandidates(db, "users", userId);
    const skinsRefs = getProjectCollectionCandidates(db, "users", userId, "skins");
    const skinsRefPrincipal = skinsRefs[0];

    // Garante documento pai do usuario para evitar "not-found" em updates futuros.
    for (const userRef of userRefs) {
      await setDoc(
        userRef,
        {
          uid: userId,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }

    // Verificar se o username ja existe em outra skin do projeto
    try {
      const skinExistente = await findSkinByUsernameAcrossProject(db, username, {
        authenticated: true,
        allowPrivateWhenAuthenticated: true,
        includeLegacy: true,
      });

      if (skinExistente) {
        const ownerExistente = getOwnerUidFromSkinDoc(skinExistente);
        if (ownerExistente && ownerExistente !== String(userId || "").trim()) {
          console.log("O nome de usuario da skin ja existe.");
          return { sucesso: false, mensagem: "O nome de usuario ja existe!" };
        }
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
    for (const skinsRef of skinsRefs) {
      const ownQuery = query(skinsRef, where("username", "==", username), limit(1));
      const ownSnapshot = await getDocs(ownQuery);
      if (!ownSnapshot.empty) {
        return { sucesso: false, mensagem: "Voce ja possui uma skin com esse nome." };
      }
    }

    // Definir se e a skin principal
    let is_main = true;
    for (const skinsRef of skinsRefs) {
      const allSkinsSnapshot = await getDocs(skinsRef);
      if (!allSkinsSnapshot.empty) {
        is_main = false;
        break;
      }
    }

    // Criar a skin
    const id_skin = doc(skinsRefPrincipal).id;

    const iconSkinPadrao = String(
      iconSkinPadraoUrl ||
        "https://firebasestorage.googleapis.com/v0/b/teste-aa015.appspot.com/o/imagens%2Fthemes%2Fcyberpink%2Fviolet%2Fet.png?alt=media&token=4c09e6d5-5a0e-48d7-88ae-f56a9a5c1a5b"
    ).trim();

    for (const skinsRef of skinsRefs) {
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
        iconSkin: iconSkinPadrao,
      });
    }

    // Criar o espaco principal (Home)
    const espacosRefs = getProjectCollectionCandidates(db, "users", userId, "espacos");
    const espacosRefPrincipal = espacosRefs[0];
    const id_espaco = doc(espacosRefPrincipal).id;
    const homeData = {
      id_espaco,
      nome: "Home",
      conteudo: "",
      ordem: 0,
      ownerUserId: userId,
      skinOwner: id_skin,
      coCriadoresUids: [],
      visibilidade: "publico",
      subtema: normalizeCyberpinkSubtheme(),
      createdAt: serverTimestamp(),
      isHome: true,
      skins_relacionadas: [id_skin],
    };

    for (const espacosRef of espacosRefs) {
      await setDoc(doc(espacosRef, id_espaco), homeData);
    }
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
