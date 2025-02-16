import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, useParams, Outlet } from "react-router-dom";
import { seforAdm } from "../../Scripts/verificações/verificaAdm";
import "./menu.css";
import { txtDefault } from "../Temas/CYBERPINK/layout";

function Menu({ menuOpen, setMenuOpen  }) {
  const [idGoogleCap, setIdGoogle] = useState(() => localStorage.getItem('idGoogleCap'));
  const [backAction, setBackAction] = useState(() => closeMenu);
  const [backText, setBackText] = useState("VOLTAR");
  const [atualTxt, setAtualTxt] = useState("MENU");
  const navigate = useNavigate();
  const location = useLocation();
  const { contactId, conversationId } = useParams();

  const larSreen = window.innerWidth;

  const skinLocal = localStorage.getItem('skinLocal'); //Variavel local para guardar username dada a skin logada.

  function closeMenu() { 
    navigate(`/${skinLocal}/home`);
    console.log(skinLocal);
  }

  function abrirUsers() {
    navigate(`/menu/${idGoogleCap}/users`);
  }

  function abrirSkins() {
    navigate(`/menu/${idGoogleCap}/skins`);
  }

  function abrirContatos() {
    navigate(`/menu/${idGoogleCap}/contatos`);
  }

  function returnMenu() {
    navigate(`/menu/${idGoogleCap}`);
  }

  function closeConversas() {
    navigate(`/menu/${idGoogleCap}/contatos`);
  }

  function closeChat() {
    navigate(`/menu/${idGoogleCap}/contatos/${contactId}`);
  }

  function logoff() {
   localStorage.clear();
    navigate('/');
    window.location.reload(); // Recarrega a página, impedindindo outras renderizações e permitindo que o botão de longin do google seja exibido novamente. 
  }

  useEffect(() => {
    let menu;
    if (location.pathname === `/menu/${idGoogleCap}`) {
      setAtualTxt("MENU");
      setBackText("VOLTAR");
      setBackAction(() => closeMenu);

      if (larSreen > 1000) {
        menu = document.getElementById('MenuContainer');
        menu.style.width = `${1000 - 5}px`;
      }
    }

    if (location.pathname === `/menu/${idGoogleCap}/users`) {
      setAtualTxt("USERS");
      setBackText("MENU");
      setBackAction(() => returnMenu);
    } else if (location.pathname === `/menu/${idGoogleCap}/contatos`) {
      setAtualTxt("CONTATOS");
      setBackText("MENU");
      setBackAction(() => returnMenu);
    } else if (location.pathname === `/menu/${idGoogleCap}/skins`) {
      setAtualTxt("SKINS");
      setBackText("MENU");
      setBackAction(() => returnMenu);
    } else if (location.pathname.startsWith(`/menu/${idGoogleCap}/contatos/`) && !location.pathname.includes('/chat/')) {
      setAtualTxt("CONVERSAS");
      setBackText("CONTATOS");
      setBackAction(() => closeConversas);
    } else if (location.pathname.startsWith(`/menu/${idGoogleCap}/contatos/`) && location.pathname.includes('/chat/')) {
      setAtualTxt("ASSUNTO");
      setBackText("CONVERSAS");
      setBackAction(() => closeChat);
    }
  }, [location.pathname, contactId, conversationId, navigate, setMenuOpen]);

  txtDefault();

  return (

    <div id="MenuContainer" className={menuOpen ? 'mostra' : 'openMenu'}>
      <div className="headMenu">
        <div onClick={backAction} className='back'> ❮ {backText} </div>
        <div className="pageAtual"> / {atualTxt} </div>
      </div>

      <div id='Gavetas' className={
        location.pathname === `/menu/${idGoogleCap}`
          ? 'mostra'
          : 'oculta'
      }>
        {seforAdm() && (
          <><div onClick={abrirUsers} id="gavetaUsers" className="gavetaOption">USERS</div><div onClick={abrirSkins} id="gavetaSkins" className="gavetaOption">GERENCIAR SKINS</div></>
        )}
        <div onClick={abrirContatos} id="gavetaForms" className="gavetaOption">CONTATOS</div>
       
        <div onClick={logoff} className="gavetaOption">ENCERRAR</div>
      </div>
      <Outlet />
      </div>

  );
} 

export default Menu;