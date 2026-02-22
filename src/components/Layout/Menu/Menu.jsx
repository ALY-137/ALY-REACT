import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
import { useNavigate, useLocation, useParams, Outlet } from "react-router-dom";
import { seforAdm } from "../../Scripts/verificacoes/verificaAdm";

import Navegacoes from "../../Scripts/navegacoes/Navegacoes";
import { activeFirebaseProjectKey, db } from "../../Banco/init-firebase";

import { doc, getDoc } from "firebase/firestore";
import { useAuth } from "../../../hooks/auth/useAuth";
import { signOut } from "firebase/auth";
import { auth } from "../../Banco/init-firebase";
import CheckoutBlocoMercadoPago from "../Pagamentos/CheckoutBlocoMercadoPago";
import {
  DEFAULT_SISTEMA_CONFIG,
  aplicarBrandingNoDocumento,
  aplicarTemaNoBody,
  obterConfigSistemaCacheLocal,
  obterConfigSistema,
} from "../Sistema/configSistema";
import FirebaseProjectBadge from "../Geral/FirebaseProjectBadge";

function Menu({ menuOpen }) {
  const { user, loading } = useAuth();
  const redirectingRef = useRef(false);

  const [backAction, setBackAction] = useState(() => closeMenu);
  const [backText, setBackText] = useState("VOLTAR");
  const [atualTxt, setAtualTxt] = useState("MENU");
  const [configSistema, setConfigSistema] = useState(
    () => obterConfigSistemaCacheLocal() || DEFAULT_SISTEMA_CONFIG
  );
  const [configSistemaPronta, setConfigSistemaPronta] = useState(
    () => Boolean(obterConfigSistemaCacheLocal())
  );

  const navigate = useNavigate();
  const location = useLocation();
  const { userId: menuUserId, contactId } = useParams();
  const isManagerProject = activeFirebaseProjectKey === "gerenciador-aly";

  const larScreen = window.innerWidth;

  const skinLogadoUser = localStorage.getItem("skinLogadoUser");
  const temUsuarioAutenticado = Boolean(user || auth.currentUser);
  const menuTargetUser = isManagerProject
    ? (menuUserId || "gerenciador").trim()
    : skinLogadoUser;
  const nomeSkinPlural = (configSistema.nomeSkinPlural || "skins").trim() || "skins";
  const nomeSkinPluralUpper = nomeSkinPlural.toUpperCase();
  const nomeEspacoPlural = (configSistema.nomeEspacoPlural || "espacos").trim() || "espacos";
  const nomeEspacoPluralUpper = nomeEspacoPlural.toUpperCase();
  const chatHabilitado = configSistema.chatHabilitado !== false;
  const mercadoPagoHabilitado = configSistema.mercadoPagoHabilitado !== false;

  function closeMenu() {
    if (isManagerProject) {
      navigate(`/menu/${menuTargetUser}`);
      return;
    }
    navigate(`/${skinLogadoUser}/home`);
  }

  function abrirUsers() {
    navigate(`/menu/${menuTargetUser}/users`);
  }

  function abrirSkins() {
    navigate(`/menu/${menuTargetUser}/skins`);
  }

  function abrirAcessos() {
    navigate(`/menu/${menuTargetUser}/acessos`);
  }

  function abrirContatos() {
    navigate(`/menu/${menuTargetUser}/contatos`);
  }

  function returnMenu() {
    navigate(`/menu/${menuTargetUser}`);
  }

  function closeConversas() {
    navigate(`/menu/${menuTargetUser}/contatos`);
  }

  function closeChat() {
    navigate(`/menu/${menuTargetUser}/contatos/${contactId}`);
  }

  function abrirPropriedades() {
    navigate(`/menu/${menuTargetUser}/propriedades`);
  }

  function abrirEspacos() {
    navigate(`/menu/${menuTargetUser}/espacos`);
  }

  function abrirConfiguracoesGerenciador() {
    navigate(`/menu/${menuTargetUser}/configuracoes-gerenciador`);
  }

  function abrirGerenciadorSistemas() {
    navigate(`/menu/${menuTargetUser}/gerenciador-sistemas`);
  }

  async function logoff() {
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

    try {
      await signOut(auth);
    } catch {
      // Segue para tela inicial mesmo se o provider local falhar.
    }

    navigate("/");
    window.location.reload();
  }

  function resizeMenu(larScreen) {
    const menu = document.getElementById("MenuContainer");
    if (menu && larScreen > 1000) {
      menu.style.width = `${1000 - 5}px`;
    }
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
    if (!chatHabilitado) {
      const estaEmRotasChat = location.pathname.includes("/contatos");
      if (estaEmRotasChat && menuTargetUser) {
        navigate(`/menu/${menuTargetUser}`, { replace: true });
      }
    }
  }, [isManagerProject, chatHabilitado, location.pathname, navigate, menuTargetUser]);

  useEffect(() => {
    const atualizarTitulo = async () => {
      resizeMenu(larScreen);
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
        } else if (path.endsWith("/gerenciador-sistemas")) {
          setAtualTxt("GERENCIADOR DE SISTEMAS");
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
        setAtualTxt(nomeSkinPluralUpper);
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
      } else if (path.endsWith("/contatos") && chatHabilitado) {
        setAtualTxt("CONTATOS");
        setBackText("MENU");
        setBackAction(() => returnMenu);
      } else if (chatHabilitado && path.includes("/chat/") && contactId) {
        try {
          const contatoRef = doc(db, "contatos", contactId);
          const contatoSnap = await getDoc(contatoRef);
          const contato = contatoSnap.exists() ? contatoSnap.data() : null;

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
    nomeSkinPluralUpper,
    nomeEspacoPluralUpper,
    chatHabilitado,
  ]);

  useEffect(() => {
    if (loading) return;

    const semSessaoValida = !temUsuarioAutenticado || (!isManagerProject && !skinLogadoUser);
    if (!semSessaoValida) {
      redirectingRef.current = false;
      return;
    }

    if (redirectingRef.current) return;
    if (location.pathname === "/") return;

    redirectingRef.current = true;
    if (semSessaoValida) {
      navigate("/", { replace: true });
    }
  }, [
    loading,
    temUsuarioAutenticado,
    isManagerProject,
    skinLogadoUser,
    location.pathname,
    navigate,
  ]);



  if (loading) return null;

  if (!temUsuarioAutenticado || (!isManagerProject && !skinLogadoUser)) {
    return null;
  }

  if (!configSistemaPronta) {
    return <div className="loader">Carregando tema do menu...</div>;
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
            <div onClick={abrirGerenciadorSistemas} className="gavetaOption">
              GERENCIADOR DE SISTEMAS
            </div>
          </>
        ) : seforAdm(user) ? (
          <>
            <div onClick={abrirUsers} className="gavetaOption">USERS</div>
            <div onClick={abrirAcessos} className="gavetaOption">ACESSOS</div>
          </>
        ) : null}
        {!isManagerProject ? (
          <>
            <div onClick={abrirSkins} className="gavetaOption">
              {`GERENCIAR ${nomeSkinPluralUpper}`}
            </div>
            <div onClick={abrirEspacos} className="gavetaOption">
              {`GERENCIAR ${nomeEspacoPluralUpper}`}
            </div>
            {chatHabilitado && (
              <div onClick={abrirContatos} className="gavetaOption">CONTATOS</div>
            )}
            <div onClick={abrirPropriedades} className="gavetaOption">PROPRIEDADES</div>
          </>
        ) : null}
        {!isManagerProject ? (
          <div onClick={logoff} className="gavetaOption">ENCERRAR</div>
        ) : null}
        {!isManagerProject ? <Navegacoes /> : null}
      </div>

      <div className="menuContentArea">
        {!isManagerProject
          ? mercadoPagoHabilitado
            ? <CheckoutBlocoMercadoPago skinLogadoUser={skinLogadoUser} />
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


