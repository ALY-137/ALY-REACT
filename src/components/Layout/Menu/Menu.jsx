import React, { useState } from "react";
import ListaFormularios from "./Formularios/ListaFormularios";
import RespostasFormularios from "./Formularios/RespostasFormularios";
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
    const [backText, setBackText] = useState("VOLTAR");
    const [atualTxt, setAtualTxt] = useState("MENU");
    const [backAction, setBackAction] = useState(() => closeMenu);
    const [expandedForm, setExpandedForm] = useState(null);

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
        setShowMyForms(false);
        setExpandedForm(null);
        setBackText("MENU");
        setAtualTxt("MENSAGENS");
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
        setShowMyForms(false);
        setBackText("MENU");
        setAtualTxt("USUARIOS");
        setBackAction(() => closeUsers);
    }

    function closeUsers() {
        setShowUsers(false);
        setBackText("VOLTAR");
        setAtualTxt("MENU");
        setBackAction(() => closeMenu);
    }

    function abrirMyForms() {
        setShowMyForms(true);
        setShowUsers(false);
        setShowForms(false);
        setBackText("MENU");
        setAtualTxt("MINHAS MENSAGENS");
        setBackAction(() => closeMyForms);
    }

    function closeMyForms() {
        setShowMyForms(false);
        setBackText("VOLTAR");
        setAtualTxt("MENU");
        setBackAction(() => closeMenu);
    }

    function logoff() {
        window.location.reload(true);
        localStorage.clear();
    }

    const handleMouseEnter = (option) => {
        setSelectedOption(option);
    };

    const handleExpandForm = (form) => {
        setExpandedForm(form);
        setBackText("MENSAGENS");
        setAtualTxt(form.nomeCompletoGoogle);
        setBackAction(() => closeExpandedForm);
    };

    const closeExpandedForm = () => {
        setExpandedForm(null);
        setBackText("MENU");
        setAtualTxt("MENSAGENS");
        setBackAction(() => closeForms);
    };

    return (
        <div>
            <div id="Menu" className={menuOpen ? 'openMenu' : 'oculta'}>
                <div className="headMenu">
                    <div onClick={backAction} className='back'> ❮ {backText} </div>
                    <div className="pageAtual"> / {atualTxt} </div>
                </div>
                
                <div id='Gavetas' className={showMyForms || showForms || showUsers ? 'oculta' : 'mostra'}>
                    {seforAdm() && (
                        <div
                            onClick={abrirUsers}
                            id="gavetaUsers"
                            className={`gavetaOption ${selectedOption === null ? '' : ''}`}
                            onMouseEnter={() => handleMouseEnter('gavetaUsers')}
                        >
                            USERS
                        </div>
                    )}
                    {seforAdm() && (
                        <div
                            onClick={abrirForms}
                            id="gavetaForms"
                            className={`gavetaOption ${selectedOption === null ? '' : ''}`}
                            onMouseEnter={() => handleMouseEnter('gavetaForms')}
                        >
                            MENSAGENS
                        </div>
                    )}
                        
                    <div
                        onClick={abrirMyForms}
                        id="gavetaForms"
                        className={`gavetaOption ${selectedOption === null ? '' : ''}`}
                        onMouseEnter={() => handleMouseEnter('gavetaForms')}
                    >
                        MINHAS MENSAGENS
                    </div>

                    <div
                        onClick={logoff}
                        className={`gavetaOption ${selectedOption === null ? '' : ''}`}
                        onMouseEnter={() => handleMouseEnter('logoff')}
                    >
                        ENCERRAR
                    </div>
                </div>
                {showForms && (
                    <div id='Forms'>
                        {!expandedForm ? (
                            <ListaFormularios 
                                setBackText={setBackText} 
                                setAtualTxt={setAtualTxt} 
                                closeForms={closeForms} 
                                handleExpandForm={handleExpandForm}
                            />
                        ) : (
                            <RespostasFormularios 
                                formulario={expandedForm}
                                closeExpandedForm={closeExpandedForm}
                            />
                        )}
                    </div>
                )}
                {showUsers && (
                    <div id='Users'>
                        <Users />
                    </div>
                )}
                {showMyForms && (
                    <div id='Forms'>
                        <MeusFormularios />
                    </div>
                )}
            </div>
            {!menuOpen && <p id='menuId' className='menuIcon' onClick={openMenu}>㆔</p>}
        </div>
    );
}

export default Menu;
