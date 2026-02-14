// verificaSkins.js
import {
  doc,
  collection,
  collectionGroup,
  setDoc,
  getDocs,
  query,
  limit,
  where,
  serverTimestamp
} from "firebase/firestore";

import { db } from "../../Banco/init-firebase";

// ===============================
// FUNÇÃO PARA VERIFICAR E CRIAR SKIN
// ===============================
export const verificarESalvarskins = async (userId, username, theme) => {
  try {
    if (!userId) {
      return { sucesso: false, mensagem: "Usuário não autenticado." };
    }

    const userRef = doc(db, "users", userId);
    const skinsRef = collection(userRef, "skins");

    // ── Verificar se o username já existe nas skins públicas/restritivas
    // (skins privadas de terceiros não são consultáveis por regra)
    const publicQuery = query(
      collectionGroup(db, "skins"),
      where("username", "==", username),
      where("visibilidade", "in", ["publico", "publico_restritivo", "privado"]),
      limit(1)
    );

    try {
      const publicSnapshot = await getDocs(publicQuery);
      if (!publicSnapshot.empty) {
        // 🔹 Já existe, não cria, retorna feedback
        console.log("O nome de usuário da skin já existe.");
        return { sucesso: false, mensagem: "O nome de usuário já existe!" };
      }
    } catch (err) {
      // Em ambientes com regra mais restritiva, segue com validação local.
      if (err?.code !== "permission-denied") throw err;
    }

    // ── Verificar conflito dentro do próprio usuário
    const ownQuery = query(
      skinsRef,
      where("username", "==", username),
      limit(1)
    );
    const ownSnapshot = await getDocs(ownQuery);
    if (!ownSnapshot.empty) {
      return { sucesso: false, mensagem: "Você já possui uma skin com esse nome." };
    }

    // ── Definir se é a skin principal
    const allSkinsSnapshot = await getDocs(skinsRef);
    const is_main = allSkinsSnapshot.empty;

    // ── Criar a skin
    const id_skin = doc(skinsRef).id;

    await setDoc(doc(skinsRef, id_skin), {
      ownerUserId: userId, 
      id_skin,
      username,
      theme,
      is_main,
      visibilidade: "publico",
      data: serverTimestamp(),
      iconSkin:
        "https://firebasestorage.googleapis.com/v0/b/teste-aa015.appspot.com/o/imagens%2Fthemes%2Fcyberpink%2Fviolet%2Fet.png?alt=media&token=4c09e6d5-5a0e-48d7-88ae-f56a9a5c1a5b",
    });

    // ── Criar o espaço principal (Home)
    const espacosRef = collection(userRef, "espacos");
    const id_espaco = doc(espacosRef).id;

    await setDoc(doc(espacosRef, id_espaco), {
      id_espaco,
      nome: "Home",
      conteudo: "Conteúdo da página principal",
      ordem: 0,
      ownerUserId: userId,
      skinOwner: id_skin,
      coCriadoresUids: [],
      visibilidade: "publico",
      createdAt: serverTimestamp(),
      isHome: true,
      skins_relacionadas: [id_skin]
    });

    console.log("Skin e página principal criadas com sucesso!");
    return { sucesso: true, id_skin };

  } catch (error) {
    console.error("Erro ao verificar e salvar skin:", error);
    return { sucesso: false, mensagem: "Erro ao criar skin" };
  }
};
