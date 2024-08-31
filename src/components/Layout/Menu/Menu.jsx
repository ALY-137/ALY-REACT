import React, { useState } from "react";
import ListaContatos from "./Formularios/ListaContatos";
import ListaConversas from "./Formularios/ListaConversas";
import Chat from "./Formularios/Chat";
import Users from "./Users/Users";
import { seforAdm } from "../../Scripts/verificações/verificaAdm";
import './menu.css';

function Menu() {
    const [selectedOption, setSelectedOption] = useState(null);
    const [menuOpen, setMenuOpen] = useState(false);
    const [showForms, setShowForms] = useState(false);
    const [showUsers, setShowUsers] = useState(false);
    const [backText, setBackText] = useState("VOLTAR");
    const [atualTxt, setAtualTxt] = useState("MENU");
    const [backAction, setBackAction] = useState(() => closeMenu);
    const [selectedContato, setSelectedContato] = useState(null);
    const [selectedConversa, setSelectedConversa] = useState(null);

    function closeMenu() {
        setMenuOpen(false);
        document.getElementById('fundo').classList.remove('scroll-lock');
        document.getElementById('cardProfile').classList.remove('scroll-lock');
        document.getElementById('conteudo').classList.remove('scroll-lock');
    }

    function openMenu() {
        setMenuOpen(true);
        document.getElementById('fundo').classList.add('scroll-lock');
        document.getElementById('cardProfile').classList.add('scroll-lock');
        document.getElementById('conteudo').classList.add('scroll-lock'); }


        function abrirForms() {
            setShowForms(true);
            setShowUsers(false);
            setSelectedContato(null);
            setSelectedConversa(null);
            setBackText("MENU");
            setAtualTxt("CONTATOS");
            setBackAction(() => closeForms);
        }
        
        function closeForms() {
            setShowForms(false);
            setBackText("VOLTAR");
            setAtualTxt("MENU");
            setBackAction(() => closeMenu);
        }
        
        function abrirUsers() {
            setShowUsers(true);
            setShowForms(false);
            setBackText("MENU");
            setAtualTxt("USUÁRIOS");
            setBackAction(() => closeUsers);
        }
        
        function closeUsers() {
            setShowUsers(false);
            setBackText("VOLTAR");
            setAtualTxt("MENU");
            setBackAction(() => closeMenu);
        }
        
        function logoff() {
            localStorage.clear();
            window.location.reload(true);
        }
        
        const handleMouseEnter = (option) => {
            setSelectedOption(option);
        };
        
        const handleSelectContato = (contatoId) => {
            setSelectedContato(contatoId);
            setBackText("CONTATOS");
            setAtualTxt("CONVERSAS");
            setBackAction(() => closeSelectedContato);
        };
        
        const handleSelectConversa = (conversaId) => {
            setSelectedConversa(conversaId);
            setBackText("CONVERSAS");
            setAtualTxt("MENSAGENS");
            setBackAction(() => closeSelectedConversa);
        };
        
        const closeSelectedContato = () => {
            setSelectedContato(null);
            setSelectedConversa(null);
            setBackText("MENU");
            setAtualTxt("CONTATOS");
            setBackAction(() => closeForms);
        };
        
        const closeSelectedConversa = () => {
            setSelectedConversa(null);
            setBackText("CONTATOS");
            setAtualTxt("CONVERSAS");
            setBackAction(() => closeSelectedContato);
        };
        
        return (
            <div>
                <div id="Menu" className={menuOpen ? 'openMenu' : 'oculta'}>
                    <div className="headMenu">
                        <div onClick={backAction} className='back'> ❮ {backText} </div>
                        <div className="pageAtual"> / {atualTxt} </div>
                    </div>
                    
                    <div id='Gavetas' className={showForms || showUsers ? 'oculta' : 'mostra'}>
                        {seforAdm() && (
                            <div
                                onClick={abrirUsers}
                                id="gavetaUsers"
                                className={`gavetaOption ${selectedOption === 'gavetaUsers' ? 'selected' : ''}`}
                                onMouseEnter={() => handleMouseEnter('gavetaUsers')}
                            >
                                USERS
                            </div>
                        )}
                        {seforAdm() && (
                            <div
                                onClick={abrirForms}
                                id="gavetaForms"
                                className={`gavetaOption ${selectedOption === 'gavetaForms' ? 'selected' : ''}`}
                                onMouseEnter={() => handleMouseEnter('gavetaForms')}
                            >
                                CONTATOS
                            </div>
                        )}
                        <div
                            onClick={logoff}
                            className={`gavetaOption ${selectedOption === 'logoff' ? 'selected' : ''}`}
                            onMouseEnter={() => handleMouseEnter('logoff')}
                        >
                            ENCERRAR
                        </div>
                    </div>
                    
                    {showForms && (
                        <div id='Forms'>
                            {!selectedContato ? (
                                <ListaContatos 
                                    setBackText={setBackText} 
                                    setAtualTxt={setAtualTxt} 
                                    handleExpandForm={handleSelectContato}
                                />
                            ) : (
                                !selectedConversa ? (
                                    <ListaConversas
                                        conversaId={selectedContato}
                                        setBackText={setBackText}
                                        setAtualTxt={setAtualTxt}
                                        handleExpandForm={handleSelectConversa}
                                    />
                                ) : (
                                    <Chat
                                        contatoId={selectedContato}  // Passando contatoId para Chat
                                        conversaId={selectedConversa}
                                        setBackText={setBackText}
                                        setAtualTxt={setAtualTxt}
                                    />
                                )
                            )}
                        </div>
                    )}
                    
                    {showUsers && (
                        <div id='Users'>
                            <Users />
                        </div>
                    )}
                </div>
                {!menuOpen && <p id='menuId' className='menuIcon' onClick={openMenu}>㆔</p>}
            </div>
        );
    }


export default Menu;