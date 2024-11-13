import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, useParams, Outlet } from 'react-router-dom';
import { seforAdm } from "../../Scripts/verificações/verificaAdm";
import './menu.css';
import { txtDefault } from "../layout";

const larSreen = window.innerWidth;

function Menu({ menuOpen, setMenuOpen }) { 
    const [idGoogle, setIdGoogle] = useState(() => localStorage.getItem('idGoogle'));
    const [backAction, setBackAction] = useState(() => closeMenu);
    const [backText, setBackText] = useState("VOLTAR");
    const [atualTxt, setAtualTxt] = useState("MENU");
    const navigate = useNavigate();
    const location = useLocation();
    const { contactId, conversationId } = useParams();


  var menu;

 
    useEffect(() => {
    
    // Implementar rota para login    
    //    if (!idGoogle) {
            // Se o idGoogle não estiver no localStorage, redirecionar para a página de login
    //        navigate('/login');
    //        return;
    //    }


        if (location.pathname ===`/menu/${idGoogle}`) {
            setAtualTxt("MENU");
            setBackText("VOLTAR");
            setBackAction(() => closeMenu);

            if(larSreen>1000){
                   menu = document.getElementById('Menu')
                   menu.style.width = `${1000-5}px`;

            }

        }

        if (location.pathname === `/menu/${idGoogle}/users`) {
            setAtualTxt("USERS");
            setBackText("MENU");
            setBackAction(() => closeUsers);
   

        } else if (location.pathname === `/menu/${idGoogle}/contatos`) {
            setAtualTxt("CONTATOS");
            setBackText("MENU");
            setBackAction(() => closeContatos);


        } else if (location.pathname.startsWith(`/menu/${idGoogle}/contatos/`) && !location.pathname.includes('/chat/')) {
            setAtualTxt("CONVERSAS");
            setBackText("CONTATOS");
            setBackAction(() => closeConversas);


        } else if (location.pathname.startsWith(`/menu/${idGoogle}/contatos/`) && location.pathname.includes('/chat/')) {
            setAtualTxt("ASSUNTO");
            setBackText("CONVERSAS");
            setBackAction(() => closeChat);
 

        }

    }, [location.pathname, contactId, conversationId, navigate, setMenuOpen]);

    function closeMenu() {
        navigate('/');
    }

    function abrirUsers() {
        navigate(`/menu/${idGoogle}/users`);
    }

    function closeUsers() {
        navigate(`/menu/${idGoogle}`);
    }

    function closeContatos() {
        navigate(`/menu/${idGoogle}`);
    }

    function closeConversas() {
        navigate(`/menu/${idGoogle}/contatos`);
    }

    function closeChat() {
        navigate(`/menu/${idGoogle}/contatos/${contactId}`);
    }

    function logoff() {
        localStorage.clear();
        navigate('/');
    }

    function abrirContatos() {
        navigate(`/menu/${idGoogle}/contatos`);
    }

    txtDefault();

    return (
        <div>
            <div id="Menu" className={menuOpen ? 'mostra' : 'openMenu'}>
                <div className="headMenu">
                    <div onClick={backAction} className='back'> ❮ {backText} </div>
                    <div className="pageAtual"> / {atualTxt} </div>
                </div>

                {/* Gavetas são ocultadas se o caminho não for o menu principal */}
                <div id='Gavetas' className={
                    location.pathname === `/menu/${idGoogle}`
                    ? 'mostra' 
                    : 'oculta'
                }>
                    {seforAdm() && (
                        <div onClick={abrirUsers} id="gavetaUsers" className="gavetaOption">USERS</div>
                    )}
                    <div onClick={abrirContatos} id="gavetaForms" className="gavetaOption">CONTATOS</div>
                    <div onClick={logoff} className="gavetaOption">ENCERRAR</div>
                </div>

                {/* Outlet será responsável por renderizar os componentes filhos com base na rota */}
                <Outlet />
            </div>
        </div>
    );
}

export default Menu;
