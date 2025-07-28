// Componente para excluir conta do usuário logado, exluindo dados da coleção  'users"
import React, { useState, useEffect } from "react";
import { useNavigate   } from "react-router-dom";
import firebase from 'firebase/app';
import 'firebase/firestore';


function ContaManager() {

      const navigate = useNavigate();
  const excluirConta = async () => {
  const idGoogleCap = localStorage.getItem("idGoogleCap");
  if (!idGoogleCap) {
    alert("ID do usuário não encontrado.");
    return;
  }

  const confirmar = window.confirm("Tem certeza que deseja excluir sua conta? Essa ação é irreversível.");
  if (!confirmar) return;

  try {
    const usersRef = firebase.firestore().collection("users");
    const snapshot = await usersRef.where("idGoogle", "==", idGoogleCap).get();

    if (snapshot.empty) {
      alert("Usuário não encontrado no banco de dados.");
      return;
    }

    const batch = firebase.firestore().batch();

    for (const doc of snapshot.docs) {
      const userRef = doc.ref;

      // 🔻 1. Excluir subcoleção 'logins'
      const loginsSnapshot = await userRef.collection("logins").get();
      loginsSnapshot.forEach((subDoc) => batch.delete(subDoc.ref));

      // 🔻 2. Excluir subcoleção 'navegacoes_users'
      const navSnapshot = await userRef.collection("navegacoes_users").get();
      navSnapshot.forEach((subDoc) => batch.delete(subDoc.ref));

    const skinsSnapshot = await userRef.collection("skins").get();
      skinsSnapshot.forEach((subDoc) => batch.delete(subDoc.ref));

      // 🔻 3. Excluir o próprio documento user
      batch.delete(userRef);
    }

    await batch.commit();

    alert("Conta excluída com sucesso.");
    localStorage.clear();
    navigate('/');
    window.location.reload();
    
  } catch (erro) {
    if (erro.code === 'auth/requires-recent-login') {
      alert("Por segurança, você precisa entrar novamente para excluir sua conta.");
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
