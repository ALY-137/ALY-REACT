// Componente para excluir conta do usuario logado e seus dados em users/{userId}
import React from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  getDocs,
  writeBatch,
} from "firebase/firestore";

import { db } from "../../../../Banco/init-firebase";
import { getPrimaryProjectDoc } from "../../../../Banco/projectDataRefs";

function ContaManager() {
  const navigate = useNavigate();

  const excluirConta = async () => {
    const userId = localStorage.getItem("userId");
    if (!userId) {
      alert("ID do usuario nao encontrado.");
      return;
    }

    const confirmar = window.confirm(
      "Tem certeza que deseja excluir sua conta? Essa acao e irreversivel."
    );
    if (!confirmar) return;

    try {
      const userRef = getPrimaryProjectDoc(db, "users", userId);
      const batch = writeBatch(db);

      const loginsSnapshot = await getDocs(collection(userRef, "logins"));
      loginsSnapshot.forEach((subDoc) => batch.delete(subDoc.ref));

      const navSnapshot = await getDocs(collection(userRef, "navegacoes_users"));
      navSnapshot.forEach((subDoc) => batch.delete(subDoc.ref));

      const skinsSnapshot = await getDocs(collection(userRef, "skins"));
      skinsSnapshot.forEach((subDoc) => batch.delete(subDoc.ref));

      batch.delete(userRef);
      await batch.commit();

      alert("Conta excluida com sucesso.");
      const chavesSessao = [
        "targetUsername",
        "skinLogadoUser",
        "skinLogado",
        "skinIdAtual",
        "selectedTheme",
        "userId",
        "nomeSkin",
        "skinOwner",
      ];
      chavesSessao.forEach((chave) => localStorage.removeItem(chave));
      navigate("/");
      window.location.reload();
    } catch (erro) {
      if (erro.code === "auth/requires-recent-login") {
        alert("Por seguranca, voce precisa entrar novamente para excluir sua conta.");
      } else {
        console.error("Erro ao excluir conta:", erro);
        alert("Erro ao excluir conta. Tente novamente.");
      }
    }
  };

  return (
    <div>
      <button onClick={excluirConta} className="btn-excluir">
        Excluir Conta
      </button>
    </div>
  );
}

export default ContaManager;
