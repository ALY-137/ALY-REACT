import React, { useState, useEffect, useLayoutEffect } from "react";
import { useNavigate, useLocation, useParams, Outlet } from "react-router-dom";
import { seforAdm } from "../../Scripts/verificacoes/verificaAdm";

import Navegacoes from "../../Scripts/navegacoes/Navegacoes";
import { activeFirebaseProjectKey, db } from "../../Banco/init-firebase";

import {
  getDoc,
  onSnapshot,
} from "firebase/firestore";
import {
  getProjectCollectionCandidates,
  getProjectDocCandidates,
} from "../../Banco/projectDataRefs";
import { useAuth } from "../../../hooks/auth/useAuth";
import { signOut } from "firebase/auth";
import { auth } from "../../Banco/init-firebase";
import CheckoutBlocoMercadoPago from "../Pagamentos/CheckoutBlocoMercadoPago";
import {
  DEFAULT_SISTEMA_CONFIG,
  aplicarBrandingNoDocumento,
  aplicarTemaNoBody,
  isOneOwnerComEntradaPublica,
  obterOwnerEmailConfigurado,
  obterOwnerUidConfigurado,
  obterConfigSistemaCacheLocal,
  obterConfigSistema,
  obterProjectKeyContextual,
} from "../Sistema/configSistema";
import FirebaseProjectBadge from "../Geral/FirebaseProjectBadge";

const SEGMENTOS_RESERVADOS_MENU = new Set([
  "contatos",
  "users",
  "skins",
  "acessos",
  "propriedades",
  "solicitacoes",
  "pedidos",
  "propriedades-sistema",
  "espacos",
  "configuracoes-gerenciador",
  "gerenciar-layouts",
  "gerenciador-icones",
  "gerenciador-projetos",
]);

function ehSegmentoReservadoMenu(valor) {
  return SEGMENTOS_RESERVADOS_MENU.has(String(valor || "").trim().toLowerCase());
}

function Menu({ menuOpen }) {
  const { user, loading } = useAuth();
  const usuarioAuthAtual = user || auth.currentUser || null;

  const [backAction, setBackAction] = useState(() => closeMenu);
  const [backText, setBackText] = useState("VOLTAR");
  const [atualTxt, setAtualTxt] = useState("MENU");
  const [configSistema, setConfigSistema] = useState(
    () => obterConfigSistemaCacheLocal() || DEFAULT_SISTEMA_CONFIG
  );
  const [configSistemaPronta, setConfigSistemaPronta] = useState(
    () => Boolean(obterConfigSistemaCacheLocal())
  );
  const [badgeSolicitacoes, setBadgeSolicitacoes] = useState({
    pendentes: 0,
    confirmadas: 0,
  });

  const navigate = useNavigate();
  const location = useLocation();
  const { userId: menuUserId, contactId } = useParams();
  const isManagerProject = activeFirebaseProjectKey === "gerenciador-aly";

  const menuUserIdParam = String(menuUserId || "").trim();
  const menuUserIdNormalizado = ehSegmentoReservadoMenu(menuUserIdParam)
    ? ""
    : menuUserIdParam;
  const skinLogadoUserStorageBruto = String(localStorage.getItem("skinLogadoUser") || "").trim();
  const skinLogadoUserStorage = ehSegmentoReservadoMenu(skinLogadoUserStorageBruto)
    ? ""
    : skinLogadoUserStorageBruto;
  const userIdCache = localStorage.getItem("userId");
  const modoAcessoProjeto = configSistema?.modoAcessoProjeto || "privado_com_login";
  const tipoExperiencia = configSistema?.tipoExperiencia || "multiowner";
  const oneOwnerPublicaAtiva =
    !isManagerProject &&
    isOneOwnerComEntradaPublica({
      tipoExperiencia,
      modoAcessoProjeto,
    });
  const rotaOwnerMenuOneOwner =
    oneOwnerPublicaAtiva &&
    (menuUserIdParam.toLowerCase() === "owner" || menuUserIdParam.toLowerCase() === "admin");
  const loginOwnerSeparado = oneOwnerPublicaAtiva && rotaOwnerMenuOneOwner;
  const skinLogadoUser = !isManagerProject
    ? oneOwnerPublicaAtiva
      ? rotaOwnerMenuOneOwner
        ? skinLogadoUserStorage
        : (skinLogadoUserStorage || menuUserIdNormalizado)
      : (skinLogadoUserStorage || menuUserIdNormalizado)
    : "";
  const exigeSkinAtiva =
    !isManagerProject && (!oneOwnerPublicaAtiva || !rotaOwnerMenuOneOwner);
  const aguardandoAuthInicial =
    loading && !usuarioAuthAtual && (isManagerProject || !userIdCache);
  const temUsuarioAutenticado = isManagerProject
    ? Boolean(usuarioAuthAtual)
    : Boolean(usuarioAuthAtual || userIdCache);
  const menuTargetUser = isManagerProject
    ? (menuUserIdParam || "gerenciador").trim()
    : rotaOwnerMenuOneOwner
      ? "owner"
      : (skinLogadoUser || menuUserIdNormalizado);
  const nomeSkinSingular = (configSistema.nomeSkinSingular || "skin").trim() || "skin";
  const nomeSkinPlural = (configSistema.nomeSkinPlural || "skins").trim() || "skins";
  const usarRotuloSkinSingular = tipoExperiencia === "oneowner";
  const nomeSkinMenu = usarRotuloSkinSingular ? nomeSkinSingular : nomeSkinPlural;
  const nomeSkinMenuUpper = nomeSkinMenu.toUpperCase();
  const nomeSkinPluralUpper = nomeSkinPlural.toUpperCase();
  const nomeEspacoPlural = (configSistema.nomeEspacoPlural || "espacos").trim() || "espacos";
  const nomeEspacoPluralUpper = nomeEspacoPlural.toUpperCase();
  const chatHabilitado = configSistema.chatHabilitado !== false;
  const mercadoPagoHabilitado = configSistema.mercadoPagoHabilitado !== false;
  const pixManualHabilitado = configSistema.pixManualHabilitado !== false;
  const pagamentosCompradorHabilitados = mercadoPagoHabilitado || pixManualHabilitado;
  const rotaLoginProjeto = oneOwnerPublicaAtiva ? "/login" : "/";
  const rotaLoginOwnerProjeto = oneOwnerPublicaAtiva ? "/loginowner" : rotaLoginProjeto;
  const ownerUidProjetoConfigurado = String(obterOwnerUidConfigurado(configSistema) || "").trim();
  const ownerEmailProjetoConfigurado = String(obterOwnerEmailConfigurado(configSistema) || "")
    .trim()
    .toLowerCase();
  const emailUsuarioAtual = String(usuarioAuthAtual?.email || "")
    .trim()
    .toLowerCase();
  const ownerProjetoConfigurado = Boolean(
    ownerUidProjetoConfigurado || ownerEmailProjetoConfigurado
  );
  const usuarioEhOwnerProjeto = Boolean(
    usuarioAuthAtual?.uid &&
      (
        (ownerUidProjetoConfigurado &&
          usuarioAuthAtual.uid === ownerUidProjetoConfigurado) ||
        (ownerEmailProjetoConfigurado &&
          emailUsuarioAtual === ownerEmailProjetoConfigurado) ||
        (!ownerProjetoConfigurado &&
          seforAdm(usuarioAuthAtual))
      )
  );
  const menuOneOwnerUsuarioComum = oneOwnerPublicaAtiva && !rotaOwnerMenuOneOwner;
  const podeGerenciarUsuarios = usuarioEhOwnerProjeto && !oneOwnerPublicaAtiva;
  const ownerOneOwnerPodeGerenciarSkins =
    oneOwnerPublicaAtiva && rotaOwnerMenuOneOwner && usuarioEhOwnerProjeto;
  const exibirGestaoSkins =
    ownerOneOwnerPodeGerenciarSkins || Boolean(skinLogadoUser);
  const exibirGestaoEspacos =
    (oneOwnerPublicaAtiva && rotaOwnerMenuOneOwner && usuarioEhOwnerProjeto) ||
    (Boolean(skinLogadoUser) && !menuOneOwnerUsuarioComum);
  const exibirGavetaChat = chatHabilitado && Boolean(skinLogadoUser);
  const exibirContatos = exibirGavetaChat && usuarioEhOwnerProjeto;
  const exibirConversas = exibirGavetaChat && !usuarioEhOwnerProjeto;
  const exibirPropriedades = !menuOneOwnerUsuarioComum;
  const exibirSolicitacoes =
    !isManagerProject &&
    pixManualHabilitado &&
    temUsuarioAutenticado;
  const ownerSolicitacoesUid = String(
    oneOwnerPublicaAtiva
      ? ownerUidProjetoConfigurado || usuarioAuthAtual?.uid || ""
      : usuarioAuthAtual?.uid || ""
  ).trim();
  const exibirBadgeSolicitacoes = Boolean(
    exibirSolicitacoes && usuarioEhOwnerProjeto && ownerSolicitacoesUid
  );
  const ownerUidGerenciadorConfigurado = String(
    obterOwnerUidConfigurado(configSistema) ||
      process.env.REACT_APP_SYSTEM_MANAGER_ADMIN_UID ||
      ""
  ).trim();
  const ownerEmailGerenciadorConfigurado = String(
    obterOwnerEmailConfigurado(configSistema) ||
      process.env.REACT_APP_SYSTEM_MANAGER_ADMIN_EMAIL ||
      ""
  )
    .trim()
    .toLowerCase();
  const usuarioEhOwnerGerenciador = Boolean(
    usuarioAuthAtual?.uid &&
      ((ownerUidGerenciadorConfigurado &&
        usuarioAuthAtual.uid === ownerUidGerenciadorConfigurado) ||
        (ownerEmailGerenciadorConfigurado &&
          emailUsuarioAtual === ownerEmailGerenciadorConfigurado) ||
        (!ownerUidGerenciadorConfigurado &&
          !ownerEmailGerenciadorConfigurado &&
          seforAdm(usuarioAuthAtual)))
  );
  const semAutenticacao = !temUsuarioAutenticado;
  const semSkinObrigatoria = exigeSkinAtiva && !skinLogadoUser;
  const semPermissaoOwnerProjeto = rotaOwnerMenuOneOwner && !usuarioEhOwnerProjeto;
  const semPermissaoOwnerGerenciador =
    isManagerProject && temUsuarioAutenticado && !usuarioEhOwnerGerenciador;
  const semSessaoValida = semAutenticacao || semSkinObrigatoria;

  function navigateIfChanged(path, options = undefined) {
    if (!path) return;
    if (location.pathname === path) return;
    navigate(path, options);
  }

  function closeMenu() {
    if (isManagerProject) {
      navigateIfChanged(`/menu/${menuTargetUser}`);
      return;
    }
    if (oneOwnerPublicaAtiva && rotaOwnerMenuOneOwner) {
      navigateIfChanged("/");
      return;
    }
    if (oneOwnerPublicaAtiva) {
      navigateIfChanged("/home");
      return;
    }
    navigateIfChanged(`/${skinLogadoUser}/home`);
  }

  function abrirUsers() {
    navigateIfChanged(`/menu/${menuTargetUser}/users`);
  }

  function abrirSkins() {
    navigateIfChanged(`/menu/${menuTargetUser}/skins`);
  }

  function abrirAcessos() {
    navigateIfChanged(`/menu/${menuTargetUser}/acessos`);
  }

  async function abrirContatos() {
    navigateIfChanged(`/menu/${menuTargetUser}/contatos`);
  }

  function returnMenu() {
    navigateIfChanged(`/menu/${menuTargetUser}`);
  }

  function closeConversas() {
    if (usuarioEhOwnerProjeto) {
      navigateIfChanged(`/menu/${menuTargetUser}/contatos`);
      return;
    }
    returnMenu();
  }

  function closeChat() {
    if (!usuarioEhOwnerProjeto) {
      navigateIfChanged(`/menu/${menuTargetUser}/contatos`);
      return;
    }
    navigateIfChanged(`/menu/${menuTargetUser}/contatos/${contactId}`);
  }

  function abrirPropriedades() {
    navigateIfChanged(`/menu/${menuTargetUser}/propriedades`);
  }

  function abrirSolicitacoes() {
    const ownerQuery =
      oneOwnerPublicaAtiva && ownerUidProjetoConfigurado
        ? `?ownerUserId=${encodeURIComponent(ownerUidProjetoConfigurado)}`
        : "";
    const destino = `/menu/${menuTargetUser}/solicitacoes${ownerQuery}`;
    if (`${location.pathname}${location.search}` === destino) return;
    navigate(destino);
  }

  function abrirEspacos() {
    navigateIfChanged(`/menu/${menuTargetUser}/espacos`);
  }

  function abrirConfiguracoesGerenciador() {
    navigateIfChanged(`/menu/${menuTargetUser}/configuracoes-gerenciador`);
  }

  function abrirGerenciarLayouts() {
    navigateIfChanged(`/menu/${menuTargetUser}/gerenciar-layouts`);
  }

  function abrirGerenciadorIcones() {
    navigateIfChanged(`/menu/${menuTargetUser}/gerenciador-icones`);
  }

  function abrirGerenciadoProjetos() {
    navigateIfChanged(`/menu/${menuTargetUser}/gerenciador-projetos`);
  }

  async function logoff() {
    const hostAtual = String(window.location.hostname || "").toLowerCase();
    const executandoNoLocalhost =
      hostAtual === "localhost" || hostAtual === "127.0.0.1" || hostAtual === "::1";
    const projetoAtivoLogout = String(
      obterProjectKeyContextual() || activeFirebaseProjectKey || ""
    ).trim();
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

    if (executandoNoLocalhost) {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {
        // Segue com logoff mesmo se houver falha ao limpar storage.
      }
    } else {
      chavesSessao.forEach((chave) => localStorage.removeItem(chave));
      try {
        sessionStorage.clear();
      } catch {
        // Ignora indisponibilidade do sessionStorage.
      }
    }

    try {
      await signOut(auth);
    } catch {
      // Segue para tela inicial mesmo se o provider local falhar.
    }

    if (executandoNoLocalhost) {
      const queryProjeto =
        projetoAtivoLogout ? `?firebaseProject=${encodeURIComponent(projetoAtivoLogout)}` : "";
      const destinoLocal = loginOwnerSeparado
        ? `${rotaLoginOwnerProjeto}${queryProjeto}`
        : `/${queryProjeto}`;
      window.location.replace(destinoLocal);
      return;
    }

    navigate(loginOwnerSeparado ? rotaLoginOwnerProjeto : rotaLoginProjeto, { replace: true });
  }

  useLayoutEffect(() => {
    aplicarTemaNoBody(configSistema.temaPadraoSistema);
    aplicarBrandingNoDocumento(configSistema);
  }, [configSistema]);

  useEffect(() => {
    let ativo = true;

    const carregarTemaPadrao = async () => {
      try {
        const config = await obterConfigSistema();
        if (!ativo) return;
        setConfigSistema(config);
      } catch (error) {
        // Mantem comportamento atual caso a config publica ainda nao exista.
      } finally {
        if (ativo) setConfigSistemaPronta(true);
      }
    };

    carregarTemaPadrao();

    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    const handleConfigSistemaAtualizada = (event) => {
      const configAtualizada = event?.detail;
      if (!configAtualizada || typeof configAtualizada !== "object") return;
      setConfigSistema(configAtualizada);
      setConfigSistemaPronta(true);
    };

    window.addEventListener("sistema-config-atualizada", handleConfigSistemaAtualizada);
    return () => {
      window.removeEventListener("sistema-config-atualizada", handleConfigSistemaAtualizada);
    };
  }, []);

  useEffect(() => {
    if (isManagerProject) return;
    if (oneOwnerPublicaAtiva && rotaOwnerMenuOneOwner) return;
    if (!skinLogadoUser) return;
    if (ehSegmentoReservadoMenu(skinLogadoUser)) return;
    if (skinLogadoUserStorage === skinLogadoUser) return;

    localStorage.setItem("skinLogadoUser", skinLogadoUser);
    if (!localStorage.getItem("targetUsername")) {
      localStorage.setItem("targetUsername", skinLogadoUser);
    }
  }, [
    isManagerProject,
    oneOwnerPublicaAtiva,
    rotaOwnerMenuOneOwner,
    skinLogadoUser,
    skinLogadoUserStorage,
  ]);

  useEffect(() => {
    if (isManagerProject) return;
    const valorAtual = String(localStorage.getItem("skinLogadoUser") || "").trim();
    if (!valorAtual) return;
    if (!ehSegmentoReservadoMenu(valorAtual)) return;
    localStorage.removeItem("skinLogadoUser");
  }, [isManagerProject]);

  useEffect(() => {
    if (isManagerProject) return;
    if (!chatHabilitado) {
      const estaEmRotasChat = location.pathname.includes("/contatos");
      if (estaEmRotasChat && menuTargetUser) {
        navigateIfChanged(`/menu/${menuTargetUser}`, { replace: true });
      }
    }
  }, [isManagerProject, chatHabilitado, location.pathname, menuTargetUser]);

  useEffect(() => {
    if (isManagerProject) return;
    const path = location.pathname;

    if (oneOwnerPublicaAtiva && (path.endsWith("/users") || path.endsWith("/acessos"))) {
      navigateIfChanged(`/menu/${menuTargetUser}`, { replace: true });
      return;
    }
  }, [
    isManagerProject,
    oneOwnerPublicaAtiva,
    location.pathname,
    menuTargetUser,
  ]);

  useEffect(() => {
    const atualizarTitulo = async () => {
      const path = location.pathname;

        if (isManagerProject) {
          if (path === `/menu/${menuTargetUser}`) {
            setAtualTxt("MENU");
            setBackText("VOLTAR");
            setBackAction(() => closeMenu);
          } else if (path.endsWith("/configuracoes-gerenciador")) {
            setAtualTxt("CONFIGURACOES DO GERENCIADOR");
            setBackText("MENU");
            setBackAction(() => returnMenu);
          } else if (path.endsWith("/acessos")) {
            setAtualTxt("ACESSOS");
            setBackText("MENU");
            setBackAction(() => returnMenu);
          } else if (path.endsWith("/gerenciar-layouts")) {
            setAtualTxt("GERENCIAR LAYOUTS");
            setBackText("MENU");
            setBackAction(() => returnMenu);
        } else if (path.endsWith("/gerenciador-icones")) {
          setAtualTxt("GERENCIADOR DE ICONES");
          setBackText("MENU");
          setBackAction(() => returnMenu);
        } else if (path.endsWith("/gerenciador-projetos")) {
          setAtualTxt("GERENCIADO DE PROJETOS");
          setBackText("MENU");
          setBackAction(() => returnMenu);
        }
        return;
      }

      if (path === `/menu/${menuTargetUser}`) {
        setAtualTxt("MENU");
        setBackText("VOLTAR");
        setBackAction(() => closeMenu);
      } else if (path.endsWith("/skins")) {
        setAtualTxt(nomeSkinMenuUpper);
        setBackText("MENU");
        setBackAction(() => returnMenu);
      } else if (path.endsWith("/users")) {
        setAtualTxt("USERS");
        setBackText("MENU");
        setBackAction(() => returnMenu);
      } else if (path.endsWith("/acessos")) {
        setAtualTxt("ACESSOS");
        setBackText("MENU");
        setBackAction(() => returnMenu);
      } else if (path.endsWith("/espacos")) {
        setAtualTxt(nomeEspacoPluralUpper);
        setBackText("MENU");
        setBackAction(() => returnMenu);
      } else if (path.endsWith("/propriedades")) {
        setAtualTxt("PROPRIEDADES");
        setBackText("MENU");
        setBackAction(() => returnMenu);
      } else if (path.endsWith("/solicitacoes") || path.endsWith("/pedidos")) {
        setAtualTxt("SOLICITAÇÕES");
        setBackText("MENU");
        setBackAction(() => returnMenu);
      } else if (path.endsWith("/contatos") && chatHabilitado) {
        setAtualTxt(usuarioEhOwnerProjeto ? "CONTATOS" : "CONVERSAS");
        setBackText("MENU");
        setBackAction(() => returnMenu);
      } else if (chatHabilitado && /\/contatos\/[^/]+$/.test(path)) {
        setAtualTxt("CONVERSAS");
        if (usuarioEhOwnerProjeto) {
          setBackText("CONTATOS");
          setBackAction(() => closeConversas);
        } else {
          setBackText("MENU");
          setBackAction(() => returnMenu);
        }
      } else if (chatHabilitado && path.includes("/chat/") && contactId) {
        try {
          let contato = null;
          for (const contatoRef of getProjectDocCandidates(db, "contatos", contactId)) {
            const contatoSnap = await getDoc(contatoRef).catch(() => null);
            if (contatoSnap?.exists?.()) {
              contato = contatoSnap.data() || null;
              break;
            }
          }

          if (contato) {
            const outro =
              contato.skinRemetente === skinLogadoUser
                ? contato.skinDestinatario
                : contato.skinRemetente;

            setAtualTxt(outro.toUpperCase());
          } else {
            setAtualTxt("CHAT");
          }

          setBackText("CONVERSAS");
          setBackAction(() => closeChat);
        } catch {
          setAtualTxt("CHAT");
          setBackText("CONVERSAS");
          setBackAction(() => closeChat);
        }
      }
    };

    atualizarTitulo();
  }, [
    isManagerProject,
    menuTargetUser,
    location.pathname,
    contactId,
    nomeSkinMenuUpper,
    nomeEspacoPluralUpper,
    chatHabilitado,
    usuarioEhOwnerProjeto,
  ]);

  useEffect(() => {
    if (!configSistemaPronta) return;
    if (aguardandoAuthInicial) return;
    if (semPermissaoOwnerGerenciador) return;
    if (semPermissaoOwnerProjeto) {
      if (location.pathname !== "/") {
        navigate("/", { replace: true });
      }
      return;
    }
    if (!semSessaoValida) return;

    if (location.pathname === rotaLoginProjeto) return;
    navigate(rotaLoginProjeto, { replace: true });
  }, [
    aguardandoAuthInicial,
    semSessaoValida,
    semPermissaoOwnerProjeto,
    semPermissaoOwnerGerenciador,
    configSistemaPronta,
    location.pathname,
    rotaLoginProjeto,
    navigate,
  ]);

  useEffect(() => {
    if (!exibirBadgeSolicitacoes) {
      setBadgeSolicitacoes({ pendentes: 0, confirmadas: 0 });
      return;
    }

    const pedidosRefs = getProjectCollectionCandidates(
      db,
      "users",
      ownerSolicitacoesUid,
      "pedidos"
    );
    if (!pedidosRefs.length) {
      setBadgeSolicitacoes({ pendentes: 0, confirmadas: 0 });
      return;
    }

    const snapshotsPorRef = new Map();
    const atualizarBadge = () => {
      const pedidosPorId = new Map();
      snapshotsPorRef.forEach((docs = []) => {
        docs.forEach((item) => {
          if (!pedidosPorId.has(item.id)) {
            pedidosPorId.set(item.id, item.data() || {});
          }
        });
      });

      let pendentes = 0;
      let confirmadas = 0;
      pedidosPorId.forEach((pedidoData) => {
        const status = String(pedidoData?.status || "pedido_solicitado")
          .trim()
          .toLowerCase();
        if (status === "pagamento_confirmado") {
          confirmadas += 1;
        } else {
          pendentes += 1;
        }
      });

      setBadgeSolicitacoes({ pendentes, confirmadas });
    };

    const unsubscribes = pedidosRefs.map((pedidosRef, idx) =>
      onSnapshot(
        pedidosRef,
        (snapshot) => {
          snapshotsPorRef.set(idx, snapshot.docs);
          atualizarBadge();
        },
        (err) => {
          snapshotsPorRef.set(idx, []);
          atualizarBadge();
          if (err?.code !== "permission-denied") {
            console.error("Erro ao carregar badge de solicitacoes:", err);
          }
        }
      )
    );

    return () => {
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, [exibirBadgeSolicitacoes, ownerSolicitacoesUid]);

  if (aguardandoAuthInicial) {
    return <div className="loader">Carregando menu...</div>;
  }

  if (semPermissaoOwnerGerenciador) {
    return (
      <div id="MenuContainer" className={menuOpen ? "mostra" : "openMenu"}>
        <div className="menuContentArea">
          <p>Acesso permitido apenas para owner.</p>
          <button
            type="button"
            onClick={async () => {
              try {
                await signOut(auth);
              } catch {
                // segue fluxo local.
              }
              navigate("/", { replace: true });
            }}
          >
            Trocar conta
          </button>
        </div>
        <FirebaseProjectBadge />
      </div>
    );
  }

  if (semSessaoValida) {
    return null;
  }

  if (!configSistemaPronta) {
    return <div className="loader" aria-live="polite" />;
  }

   return (
    <div id="MenuContainer" className={menuOpen ? "mostra" : "openMenu"}>
      <div className="headMenu">
        <div onClick={backAction} className="back">
          {"<"} {backText}
        </div>
        <div className="pageAtual"> / {atualTxt} </div>
      </div>

      <div
        id="Gavetas"
        className={location.pathname === `/menu/${menuTargetUser}` ? "mostra" : "oculta"}
      >
        {isManagerProject ? (
          <>
            <div onClick={abrirConfiguracoesGerenciador} className="gavetaOption">
              CONFIGURACOES DO GERENCIADOR
            </div>
            <div onClick={abrirAcessos} className="gavetaOption">
              ACESSOS
            </div>
            <div onClick={abrirGerenciarLayouts} className="gavetaOption">
              GERENCIAR LAYOUTS
            </div>
            <div onClick={abrirGerenciadorIcones} className="gavetaOption">
              GERENCIADOR DE ICONES
            </div>
            <div onClick={abrirGerenciadoProjetos} className="gavetaOption">
              GERENCIADO DE PROJETOS
            </div>
          </>
        ) : podeGerenciarUsuarios ? (
          <>
            <div onClick={abrirUsers} className="gavetaOption">USERS</div>
          </>
        ) : null}
        {!isManagerProject ? (
          <>
            {exibirGestaoSkins ? (
              <div onClick={abrirSkins} className="gavetaOption">
                {`GERENCIAR ${nomeSkinMenuUpper}`}
              </div>
            ) : null}
            {exibirGestaoEspacos ? (
              <div onClick={abrirEspacos} className="gavetaOption">
                {`GERENCIAR ${nomeEspacoPluralUpper}`}
              </div>
            ) : null}
            {exibirContatos && (
              <div onClick={abrirContatos} className="gavetaOption">CONTATOS</div>
            )}
            {exibirConversas && (
              <div onClick={abrirContatos} className="gavetaOption">CONVERSAS</div>
            )}
            {exibirPropriedades ? (
              <div onClick={abrirPropriedades} className="gavetaOption">PROPRIEDADES</div>
            ) : null}
            {exibirSolicitacoes ? (
              <div onClick={abrirSolicitacoes} className="gavetaOption">
                SOLICITAÇÕES
                {exibirBadgeSolicitacoes ? (
                  <span style={{ marginLeft: 8, fontSize: 11, opacity: 0.85 }}>
                    {`P:${badgeSolicitacoes.pendentes} C:${badgeSolicitacoes.confirmadas}`}
                  </span>
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}
        <div onClick={logoff} className="gavetaOption">ENCERRAR</div>
        {!isManagerProject ? <Navegacoes /> : null}
      </div>

      <div className="menuContentArea">
        {!isManagerProject
          ? pagamentosCompradorHabilitados
            ? (
                <CheckoutBlocoMercadoPago
                  skinLogadoUser={skinLogadoUser}
                  mercadoPagoHabilitado={mercadoPagoHabilitado}
                  pixManualHabilitado={pixManualHabilitado}
                />
              )
            : (
                location.search.includes("comprarBloco=") && (
                  <div style={{ marginTop: 16, padding: 12, border: "1px solid #999", borderRadius: 8 }}>
                    <p style={{ margin: 0 }}>
                      Integracao de pagamentos desativada neste projeto.
                    </p>
                  </div>
                )
              )
          : null}

        <Outlet />
      </div>
      <FirebaseProjectBadge />
     
    </div>
  );

}

export default Menu;





