import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, useParams, Outlet } from "react-router-dom";
import { seforAdm } from "../../Scripts/verificações/verificaAdm";
import "./menu.css";
import { txtDefault } from "../Temas/CYBERPINK/layout";
import Navegacoes from "../../Scripts/navegacoes/Navegacoes";
import {db} from "../../Banco/init-firebase";


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

  const skinLogadoUser = localStorage.getItem('skinLogadoUser'); // Obtém o nome de usuário da skin logada

  

  function closeMenu() { 
      navigate(`/${skinLogadoUser}/home`);
  }

  function abrirUsers() {
    navigate(`/menu/${idGoogleCap}/users`);
  }

  function abrirSkins() {
    navigate(`/menu/${skinLogadoUser}/skins`);
  }
  function abrirAcessos() {
    navigate(`/menu/${idGoogleCap}/acessos`);
    console.log("abrindo acessos");
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

  function logoff() {
   localStorage.clear();
    navigate('/');
    window.location.reload(); // Recarrega a página, impedindindo outras renderizações e permitindo que o botão de longin do google seja exibido novamente. 
  }

  function resizeMenu(larSreen){
    let menu = document.getElementById('MenuContainer');
    if (larSreen > 1000) {
      menu.style.width = `${1000 - 5}px`;
    }
  }

  function abrirPropriedades(){
    navigate(`/menu/${idGoogleCap}/propriedades`);
  }

  function abrirEspacos(){
    navigate(`/menu/${idGoogleCap}/espacos`);
    console.log("abre espacos");
  }

useEffect(() => {
  const atualizarTitulo = async () => {
    resizeMenu(larSreen);
    const path = location.pathname;

    if (path === `/menu/${idGoogleCap}/espacos`) {
      setAtualTxt("ESPACOS");
      setBackText("MENU");
      setBackAction(() => returnMenu);
    } else if (path === `/menu/${idGoogleCap}/propriedades`) {
      setAtualTxt("PROPRIEDADES");
      setBackText("MENU");
      setBackAction(() => returnMenu);
    } else if (path === `/menu/${skinLogadoUser}`) {
      setAtualTxt("MENU");
      setBackText("VOLTAR");
      setBackAction(() => closeMenu);
    } else if (path === `/menu/${idGoogleCap}/users`) {
      setAtualTxt("USERS");
      setBackText("MENU");
      setBackAction(() => returnMenu);
    } else if (path === `/menu/${idGoogleCap}/acessos`) {
      setAtualTxt("ACESSOS");
      setBackText("MENU");
      setBackAction(() => returnMenu);
    } else if (path === `/menu/${skinLogadoUser}/contatos`) {
      setAtualTxt("CONTATOS");
      setBackText("MENU");
      setBackAction(() => returnMenu);
    } else if (path === `/menu/${skinLogadoUser}/skins`) {
      setAtualTxt("SKINS");
      setBackText("MENU");
      setBackAction(() => returnMenu);
    } else if (path.startsWith(`/menu/${skinLogadoUser}/contatos/`) && !path.includes("/chat/")) {
      setAtualTxt("CONVERSAS");
      setBackText("CONTATOS");
      setBackAction(() => closeConversas);
    } else if (path.includes("/chat/") && contactId) {
      // 🔍 Buscar participantes da conversa
      try {
        const contatoRef = await db.collection("contatos").doc(contactId).get();
        const contatoData = contatoRef.data();

        if (contatoData) {
          const skinRem = contatoData.skinRemetente;
          const skinDest = contatoData.skinDestinatario;

          const outroUsuario = skinRem === skinLogadoUser ? skinDest : skinRem;

          setAtualTxt(`${outroUsuario.toUpperCase()}`);
          setBackText("CONVERSAS");
          setBackAction(() => closeChat);
        } else {
          setAtualTxt("CHAT");
          setBackText("CONVERSAS");
          setBackAction(() => closeChat);
        }
      } catch (err) {
        console.error("Erro ao buscar contato:", err);
        setAtualTxt("CHAT");
        setBackText("CONVERSAS");
        setBackAction(() => closeChat);
      }
    }
  };

  atualizarTitulo();
}, [location.pathname, contactId, conversationId]);



  txtDefault();

  if (!skinLogadoUser) {
  navigate('/');
  return null;
}


  return (

    <div id="MenuContainer" className={menuOpen ? 'mostra' : 'openMenu'}>
      <div className="headMenu">
        <div onClick={backAction} className='back'> ❮ {backText} </div>
        <div className="pageAtual"> / {atualTxt} </div>
      </div>

      <div id='Gavetas' className={
        location.pathname === `/menu/${skinLogadoUser}`
          ? 'mostra'
          : 'oculta'
      }>
        {seforAdm() && (
          <>
          <div onClick={abrirUsers} id="gavetaUsers" className="gavetaOption">USERS</div>
          
          <div onClick={abrirAcessos} id="gavetaAcessos" className="gavetaOption">ACESSOS</div>
          <div onClick={abrirSkins} id="gavetaSkins" className="gavetaOption">GERENCIAR SKINS</div>
          <div onClick={abrirEspacos} id="gavetaEspacos" className="gavetaOption">GERENCIAR ESPACOS</div>
          </>
        )}
        <div onClick={abrirContatos} id="gavetaForms" className="gavetaOption">CONTATOS</div>
        <div onClick={abrirPropriedades} id="gavetaPropriedades" className="gavetaOption">PROPRIEDADES</div>
        <div onClick={logoff} className="gavetaOption">ENCERRAR</div>
        <Navegacoes />
      </div>
      <Outlet />
      </div>

  );
} 

export default Menu;