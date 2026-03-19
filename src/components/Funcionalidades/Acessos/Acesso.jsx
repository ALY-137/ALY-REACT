import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

import {
  activeFirebaseProjectId,
  activeFirebaseProjectKey,
  auth,
} from "../../Banco/init-firebase";
import {
  obterOwnerEmailConfigurado,
  obterOwnerUidConfigurado,
} from "../../Layout/Sistema/configSistema";
import {
  gerenciadorSistemasHabilitado,
  obterFirestoreDoGerenciador,
} from "../../Layout/Sistema/gerenciadorSistemasApi";
import { seforAdm } from "../../Scripts/verificacoes/verificaAdm";

function normalizarTexto(valor) {
  return String(valor || "").trim();
}

function lerStorageSeguro(storage, chave) {
  try {
    return storage.getItem(chave);
  } catch {
    return null;
  }
}

function escreverStorageSeguro(storage, chave, valor) {
  try {
    storage.setItem(chave, valor);
  } catch {
    // Ignora indisponibilidade de storage no ambiente.
  }
}

function obterPerfilAcesso(user, configSistema) {
  if (!user) return "visitante";

  const ownerUidConfigurado = normalizarTexto(obterOwnerUidConfigurado(configSistema));
  const ownerEmailConfigurado = normalizarTexto(obterOwnerEmailConfigurado(configSistema))
    .toLowerCase();
  const emailAtual = normalizarTexto(user?.email).toLowerCase();

  if (
    (ownerUidConfigurado && user.uid === ownerUidConfigurado) ||
    (ownerEmailConfigurado && emailAtual === ownerEmailConfigurado) ||
    seforAdm(user)
  ) {
    return "owner";
  }

  return "usuario";
}

async function buscarGeoDados() {
  try {
    const response = await fetch("https://ipwho.is/");
    const payload = await response.json();
    return payload && typeof payload === "object" ? payload : null;
  } catch (error) {
    console.error("Erro ao consultar ipwho.is:", error);
    return null;
  }
}

async function buscarCepDados(cep) {
  const cepNormalizado = normalizarTexto(cep).replace(/\D/g, "");
  if (!cepNormalizado) return null;

  try {
    const response = await fetch(`https://viacep.com.br/ws/${cepNormalizado}/json/`);
    const payload = await response.json();
    if (payload?.erro) return null;
    return payload;
  } catch (error) {
    console.error("Erro ao consultar ViaCEP:", error);
    return null;
  }
}

function Acesso({ configSistema = null }) {
  const location = useLocation();
  const [authResolvida, setAuthResolvida] = useState(false);
  const [user, setUser] = useState(undefined);
  const enviosPendentesRef = useRef(new Set());

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (usuarioAtual) => {
      setUser(usuarioAtual || null);
      setAuthResolvida(true);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!authResolvida) return;
    if (!gerenciadorSistemasHabilitado()) return;

    const managerDb = obterFirestoreDoGerenciador();
    if (!managerDb) return;

    const hostname = normalizarTexto(window.location.hostname).toLowerCase();
    const pathname = normalizarTexto(location.pathname) || "/";
    const search = normalizarTexto(location.search);
    const fullPath = `${pathname}${search}`;

    if (pathname.startsWith("/__/auth")) return;

    const projectSystemKey = normalizarTexto(
      configSistema?.projectSystemKey || configSistema?.systemKey || activeFirebaseProjectKey
    );
    const cacheKey = [
      "acesso-registrado",
      projectSystemKey || activeFirebaseProjectKey,
      hostname,
      fullPath,
    ].join(":");

    if (lerStorageSeguro(sessionStorage, cacheKey)) return;
    if (enviosPendentesRef.current.has(cacheKey)) return;

    let cancelado = false;
    enviosPendentesRef.current.add(cacheKey);

    const registrarAcesso = async () => {
      try {
        const geoDados = await buscarGeoDados();
        const enderecoDados = await buscarCepDados(geoDados?.postal);
        if (cancelado) return;

        await addDoc(collection(managerDb, "acessos"), {
          uid: normalizarTexto(user?.uid) || null,
          email: normalizarTexto(user?.email) || null,
          displayName: normalizarTexto(user?.displayName) || null,
          perfilAcesso: obterPerfilAcesso(user, configSistema),
          autenticado: Boolean(user),
          hash: lerStorageSeguro(localStorage, "navegacaoHash") || null,

          projectSystemKey: projectSystemKey || null,
          projectNome:
            normalizarTexto(configSistema?.tituloSistema || configSistema?.nomeProjeto) ||
            projectSystemKey ||
            activeFirebaseProjectKey,
          runtimeProjectKey: normalizarTexto(activeFirebaseProjectKey) || null,
          runtimeProjectId: normalizarTexto(activeFirebaseProjectId) || null,
          tipoExperiencia: normalizarTexto(configSistema?.tipoExperiencia) || null,
          modoAcessoProjeto: normalizarTexto(configSistema?.modoAcessoProjeto) || null,

          hostname,
          path: pathname,
          search: search || "",
          fullPath,
          userAgent: normalizarTexto(window.navigator?.userAgent) || null,

          ip: normalizarTexto(geoDados?.ip) || null,
          country: normalizarTexto(geoDados?.country) || null,
          region: normalizarTexto(geoDados?.region) || null,
          city: normalizarTexto(geoDados?.city) || null,
          org: normalizarTexto(geoDados?.connection?.org) || null,
          cep: normalizarTexto(enderecoDados?.cep || geoDados?.postal) || null,
          logradouro: normalizarTexto(enderecoDados?.logradouro) || null,
          bairro: normalizarTexto(enderecoDados?.bairro) || null,
          cidade: normalizarTexto(enderecoDados?.localidade || geoDados?.city) || null,
          uf: normalizarTexto(enderecoDados?.uf) || null,

          data: serverTimestamp(),
          visto: false,
        });

        escreverStorageSeguro(sessionStorage, cacheKey, "1");
      } catch (error) {
        console.error("Erro ao registrar acesso no gerenciador:", error);
      } finally {
        enviosPendentesRef.current.delete(cacheKey);
      }
    };

    registrarAcesso();

    return () => {
      cancelado = true;
      enviosPendentesRef.current.delete(cacheKey);
    };
  }, [authResolvida, configSistema, location.pathname, location.search, user]);

  return null;
}

export default Acesso;
