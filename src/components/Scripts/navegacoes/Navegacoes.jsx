// NavegacoesTracker.jsx
import React, { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import firebase from "firebase/app";
import "firebase/firestore";
import { db } from "../../Banco/init-firebase";

const Navegacoes = () => {
  const location = useLocation();
  const sessionId = useRef(null);

  useEffect(() => {
    // Cria ou recupera hash de sessão
    let savedSession = localStorage.getItem("navegacao-session-id");
    if (!savedSession) {
      savedSession = crypto.randomUUID();
      localStorage.setItem("navegacao-session-id", savedSession);
    }
    sessionId.current = savedSession;
  }, []);

  useEffect(() => {
    const idGoogleCap = localStorage.getItem("idGoogleCap");
    if (!sessionId.current) return;

    const now = new Date();
    const path = location.pathname + location.search;

    const registro = {
      path,
      timestamp: now.toISOString(),
    };

    if (idGoogleCap) {
      // Usuário logado: salvar na subcoleção de users
      const userRef = db
        .collection("users")
        .doc(idGoogleCap)
        .collection("navegacoes_users")
        .doc(sessionId.current);

      userRef.set(
        {
          registros: firebase.firestore.FieldValue.arrayUnion(registro),
          criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    } else {
      // Usuário não logado: salvar na coleção global
      const anonRef = db.collection("navegacoes").doc(sessionId.current);
      anonRef.set(
        {
          registros: firebase.firestore.FieldValue.arrayUnion(registro),
          criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }
  }, [location]);

  return null;
};

export default Navegacoes;
