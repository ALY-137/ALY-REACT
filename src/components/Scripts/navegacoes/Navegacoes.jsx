// NavegacoesTracker.jsx
import React, { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

import { seforAdm } from "../verificacoes/verificaAdm";

import { db } from "../../Banco/init-firebase";
import {
  doc,
  setDoc,
  arrayUnion,
  serverTimestamp,
} from "firebase/firestore";

const Navegacoes = () => {
  const location = useLocation();
  const sessionId = useRef(null);

  // Create or recover a local session hash
  useEffect(() => {
    let savedSession = localStorage.getItem("navegacaoHash");
    if (!savedSession) {
      savedSession = crypto.randomUUID();
      localStorage.setItem("navegacaoHash", savedSession);
    }
    sessionId.current = savedSession;
  }, []);

  useEffect(() => {
    const userId = localStorage.getItem("userId");
    if (!sessionId.current || !userId) return;
    if (seforAdm({ uid: userId })) return;

    const registro = {
      path: location.pathname + location.search,
      timestamp: new Date().toISOString(),
    };

    const saveNavigation = async () => {
      try {
        const userRef = doc(
          db,
          "users",
          userId,
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
      } catch (error) {
        console.error("Erro ao salvar navegacao:", error);
      }
    };

    saveNavigation();
  }, [location.pathname, location.search]);

  return null;
};

export default Navegacoes;
