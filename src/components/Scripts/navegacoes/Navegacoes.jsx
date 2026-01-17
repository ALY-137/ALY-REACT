// NavegacoesTracker.jsx
import React, { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

import { seforAdm } from "../verificações/verificaAdm";

import { db } from "../../Banco/init-firebase"; // já exporta db modular
import {
  doc,
  setDoc,
  arrayUnion,
  serverTimestamp,
} from "firebase/firestore";

const Navegacoes = () => {
  const location = useLocation();
  const sessionId = useRef(null);

  // Cria ou recupera hash de sessão
  useEffect(() => {
    let savedSession = localStorage.getItem("navegacaoHash");
    if (!savedSession) {
      savedSession = crypto.randomUUID();
      localStorage.setItem("navegacaoHash", savedSession);
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

    const saveNavigation = async () => {
      try {
        if (idGoogleCap && !seforAdm(idGoogleCap)) {
          // Usuário logado: salvar na subcoleção de users
          const userRef = doc(
            db,
            "users",
            idGoogleCap,
            "navegacoes_users",
            sessionId.current
          );

          await setDoc(
            userRef,
            {
              registros: arrayUnion(registro),
              criadoEm: serverTimestamp(),
              navegacaoHash: sessionId.current,
            },
            { merge: true }
          );
        } else {
          // Usuário não logado: salvar na coleção global
          const anonRef = doc(db, "navegacoes", sessionId.current);

          await setDoc(
            anonRef,
            {
              registros: arrayUnion(registro),
              criadoEm: serverTimestamp(),
              navegacaoHash: sessionId.current,
            },
            { merge: true }
          );
        }
      } catch (error) {
        console.error("Erro ao salvar navegação:", error);
      }
    };

    saveNavigation();
  }, [location]);

  return null;
};

export default Navegacoes;
