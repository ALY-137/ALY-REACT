import React, { useState } from "react";
import Formularios from "./Formularios/Formularios";
import MeusFormularios from "./Meus Formularios/MeusFormularios";
import Users from "./Users/Users";
import { seforAdm } from "../../Scripts/verificações/verificaAdm";
import './menu.css';

function Menu() {
    const [selectedOption, setSelectedOption] = useState(null);
    const [menuOpen, setMenuOpen] = useState(false);
    const [showForms, setShowForms] = useState(false);
    const [showUsers, setShowUsers] = useState(false);
    const [showMyForms, setShowMyForms] = useState(false);

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
        document.getElementById('conteudo').classList.add('scroll-lock');
      
    }

    function abrirForms() {
        setShowForms(true);
        setShowUsers(false);
    }

    function fecharForms() {
        setShowForms(false);
    }

    function abrirUsers() {
        setShowUsers(true);
        setShowForms(false);
    }

    function fecharUsers() {
        setShowUsers(false);
    }

    function logoff() {
        window.location.reload(true);
        localStorage.clear();
    }

    function abrirMyForms() {
        setShowMyForms(true);
        setShowUsers(false);
    }

    function fecharMyForms() {
        setShowMyForms(false);
    }

    const handleMouseEnter = (option) => {
        setSelectedOption(option);
    };

    return (
        <div>
            <div id="Menu" className={menuOpen ? 'openMenu' : 'oculta'}>
                <div onClick={closeMenu} className='back'> ❮ </div>
                <div id='Gavetas' className={showMyForms || showForms || showUsers ? 'oculta' : 'mostra'}>
                    {seforAdm() && (
                        <div
                            onClick={abrirUsers}
                            id="gavetaUsers"
                            className={`gavetaOption ${selectedOption === null ? 'highlight' : ''}`}
                            onMouseEnter={() => handleMouseEnter('gavetaUsers')}
                        >
                            USERS
                        </div>
                    )}
                    {seforAdm() && (
                        <div
                            onClick={abrirForms}
                            id="gavetaForms"
                            className={`gavetaOption ${selectedOption === null ? 'highlight' : ''}`}
                            onMouseEnter={() => handleMouseEnter('gavetaForms')}
                        >
                            MENSAGENS
                        </div>
                    )}
                        
                    <div
                        onClick={abrirMyForms}
                        id="gavetaForms"
                        className={`gavetaOption ${selectedOption === null ? 'highlight' : ''}`}
                        onMouseEnter={() => handleMouseEnter('gavetaForms')}
                    >
                        MINHAS MENSAGENS
                    </div>


                    <div
                        onClick={logoff}
                        className={`gavetaOption ${selectedOption === null ? 'highlight' : ''}`}
                        onMouseEnter={() => handleMouseEnter('logoff')}
                    >
                        ENCERRAR
                    </div>

                


                </div>
                {showForms && (
                    <div id='Forms'>
                        <div className="back" onClick={fecharForms}>❮</div>
                        <Formularios />
                    </div>
                )}
                {showUsers && (
                    <div id='Users'>
                        <div className='back' onClick={fecharUsers}>❮</div>
                        <Users />
                    </div>
                )}
                {showMyForms && (
                    <div id='Forms'>
                        <div className="back" onClick={fecharMyForms}>❮</div>
                        <MeusFormularios />
                    </div>
                )}
            </div>
            {!menuOpen && <p id='menuId' className='menuIcon' onClick={openMenu}>㆔</p>}
        </div>
    );
}

export default Menu;
