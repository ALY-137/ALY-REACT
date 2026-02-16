import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, useParams, Outlet } from "react-router-dom";
import { seforAdm } from "../../Scripts/verificacoes/verificaAdm";
import "./menu.css";

import Navegacoes from "../../Scripts/navegacoes/Navegacoes";
import { db } from "../../Banco/init-firebase";

import { doc, getDoc } from "firebase/firestore";
import { useAuth } from "../../../hooks/auth/useAuth";
import { signOut } from "firebase/auth";
import { auth } from "../../Banco/init-firebase";
import CheckoutBlocoMercadoPago from "../Pagamentos/CheckoutBlocoMercadoPago";
import { aplicarTemaNoBody, obterConfigSistema } from "../Sistema/configSistema";

function Menu({ menuOpen }) {
  const { user, loading } = useAuth();

  const [backAction, setBackAction] = useState(() => closeMenu);
  const [backText, setBackText] = useState("VOLTAR");
  const [atualTxt, setAtualTxt] = useState("MENU");

  const navigate = useNavigate();
  const location = useLocation();
  const { contactId } = useParams();

  const larScreen = window.innerWidth;

  const skinLogadoUser = localStorage.getItem("skinLogadoUser");

  function closeMenu() {
    navigate(`/${skinLogadoUser}/home`);
  }

  function abrirUsers() {
    navigate(`/menu/${skinLogadoUser}/users`);
  }

  function abrirSkins() {
    navigate(`/menu/${skinLogadoUser}/skins`);
  }

  function abrirAcessos() {
    navigate(`/menu/${skinLogadoUser}/acessos`);
  }

  function abrirContatos() {
    navigate(`/menu/${skinLogadoUser}/contatos`);
  }

  function returnMenu() {
    navigate(`/menu/${skinLogadoUser}`);
  }

  function closeConversas() {
    navigate(`/menu/${skinLogadoUser}/contatos`);
  }

  function closeChat() {
    navigate(`/menu/${skinLogadoUser}/contatos/${contactId}`);
  }

  function abrirPropriedades() {
    navigate(`/menu/${skinLogadoUser}/propriedades`);
  }

  function abrirEspacos() {
    navigate(`/menu/${skinLogadoUser}/espacos`);
  }

  function abrirPropriedadesSistema() {
    navigate(`/menu/${skinLogadoUser}/propriedades-sistema`);
  }

  async function logoff() {
    localStorage.clear();
    navigate("/");
    window.location.reload();
    await signOut(auth);
  }

  function resizeMenu(larScreen) {
    const menu = document.getElementById("MenuContainer");
    if (menu && larScreen > 1000) {
      menu.style.width = `${1000 - 5}px`;
    }
  }

  useEffect(() => {
    let ativo = true;

    const carregarTemaPadrao = async () => {
      try {
        const config = await obterConfigSistema();
        if (!ativo) return;
        aplicarTemaNoBody(config.temaPadraoSistema);
      } catch (error) {
        // Mantem comportamento atual caso a config publica ainda nao exista.
      }
    };

    carregarTemaPadrao();

    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    const atualizarTitulo = async () => {
      resizeMenu(larScreen);
      const path = location.pathname;

      if (path === `/menu/${skinLogadoUser}`) {
        setAtualTxt("MENU");
        setBackText("VOLTAR");
        setBackAction(() => closeMenu);
      } else if (path.endsWith("/skins")) {
        setAtualTxt("SKINS");
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
        setAtualTxt("ESPACOS");
        setBackText("MENU");
        setBackAction(() => returnMenu);
      } else if (path.endsWith("/propriedades")) {
        setAtualTxt("PROPRIEDADES");
        setBackText("MENU");
        setBackAction(() => returnMenu);
      } else if (path.endsWith("/propriedades-sistema")) {
        setAtualTxt("PROPRIEDADES DO SISTEMA");
        setBackText("MENU");
        setBackAction(() => returnMenu);
      } else if (path.endsWith("/contatos")) {
        setAtualTxt("CONTATOS");
        setBackText("MENU");
        setBackAction(() => returnMenu);
      } else if (path.includes("/chat/") && contactId) {
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
  }, [location.pathname, contactId]);



  if (loading) return null;

  if (!skinLogadoUser || !user) {
    navigate("/");
    return null;
  }

   return (
    <div id="MenuContainer" className={menuOpen ? "mostra" : "openMenu"}>
      <div className="headMenu">
        <div onClick={backAction} className="back">
          ❮ {backText}
        </div>
        <div className="pageAtual"> / {atualTxt} </div>
      </div>

      <div id="Gavetas" className={location.pathname === `/menu/${skinLogadoUser}` ? "mostra" : "oculta"}>
        {seforAdm(user) && (
          <>
            <div onClick={abrirUsers} className="gavetaOption">USERS</div>
            <div onClick={abrirAcessos} className="gavetaOption">ACESSOS</div>
            <div onClick={abrirPropriedadesSistema} className="gavetaOption">PROPRIEDADES DO SISTEMA</div>
          </>
        )}
        <div onClick={abrirSkins} className="gavetaOption">GERENCIAR SKINS</div>
        <div onClick={abrirEspacos} className="gavetaOption">GERENCIAR ESPACOS</div>
        <div onClick={abrirContatos} className="gavetaOption">CONTATOS</div>
        <div onClick={abrirPropriedades} className="gavetaOption">PROPRIEDADES</div>
        <div onClick={logoff} className="gavetaOption">ENCERRAR</div>
        <Navegacoes />
      </div>

      <CheckoutBlocoMercadoPago skinLogadoUser={skinLogadoUser} />

      <Outlet />
     
    </div>
  );

}

export default Menu;

