// NavegacoesTracker.jsx
import React, { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

import { seforAdm } from "../verificacoes/verificaAdm";

import { auth, db } from "../../Banco/init-firebase";
import {
  doc,
  setDoc,
  arrayUnion,
  serverTimestamp,
} from "firebase/firestore";

const Navegacoes = () => {
  const location = useLocation();
  const navigationIdRef = useRef(null);
  const trackingBloqueado = useRef(false);

  const normalizeNavigationId = (value = "") => {
    const navigationId = String(value || "").trim();
    if (!navigationId) return "";
    return navigationId.startsWith("anon_") ? `nav_${navigationId.slice(5)}` : navigationId;
  };

  const buildNavigationId = (value = "") => {
    const input = String(value || "").trim() || `${Date.now()}_${Math.random()}`;
    let hash = 5381;
    for (let index = 0; index < input.length; index += 1) {
      hash = (hash * 33) ^ input.charCodeAt(index);
    }
    return `nav_${(hash >>> 0).toString(16)}`;
  };

  // Create or recover a local navigation identifier
  useEffect(() => {
    let savedNavigationId = normalizeNavigationId(localStorage.getItem("navegacaoHash"));
    if (!savedNavigationId) {
      savedNavigationId = normalizeNavigationId(localStorage.getItem("uxVisitorHash"));
    }
    if (!savedNavigationId) {
      const seed =
        (typeof crypto?.randomUUID === "function" && crypto.randomUUID()) ||
        `${Date.now()}_${Math.random()}_${window.location.hostname}`;
      savedNavigationId = buildNavigationId(seed);
    }
    localStorage.setItem("navegacaoHash", savedNavigationId);
    localStorage.setItem("uxVisitorHash", savedNavigationId);
    navigationIdRef.current = savedNavigationId;
  }, []);

  useEffect(() => {
    if (trackingBloqueado.current) return;
    const authUser = auth.currentUser;
    if (!authUser?.uid || authUser?.isAnonymous === true) return;
    const userId = authUser.uid;
    if (!navigationIdRef.current || !userId) return;
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
          navigationIdRef.current
        );

        await setDoc(
          userRef,
          {
            registros: arrayUnion(registro),
            criadoEm: serverTimestamp(),
            navigationId: navigationIdRef.current,
          },
          { merge: true }
        );
      } catch (error) {
        if (error?.code === "permission-denied") {
          trackingBloqueado.current = true;
          return;
        }
        console.error("Erro ao salvar navegacao:", error);
      }
    };

    saveNavigation();
  }, [location.pathname, location.search]);

  return null;
};

export default Navegacoes;
