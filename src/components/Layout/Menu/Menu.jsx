import React, { useState } from "react";
import Formularios from "./Formularios/Formularios";
import Users from "./Users/Users";
import { seforAdm } from "../../Scripts/verificações/verificaAdm";
import './menu.css';

function Menu() {
    const [selectedOption, setSelectedOption] = useState("gavetaForms");

    function closeMenu() {
        document.getElementById('Menu').classList.add('oculta');
        document.getElementById('Menu').classList.remove('openMenu');

        //Fixa rolagem do conteúdo da página.
        document.getElementById('fundo').classList.remove('scroll-lock');
        document.getElementById('cardProfile').classList.remove('scroll-lock');
        document.getElementById('conteudo').classList.remove('scroll-lock');
    }

    function abrirForms() {
        document.getElementById('Gavetas').classList.add('oculta');
        document.getElementById('Gavetas').classList.remove('mostra');
        document.getElementById('Forms').classList.add('mostra');
        document.getElementById('Forms').classList.remove('oculta');
    }

    function fecharForms() {
        document.getElementById('Gavetas').classList.remove('oculta');
        document.getElementById('Gavetas').classList.add('mostra');
        document.getElementById('Forms').classList.remove('mostra');
        document.getElementById('Forms').classList.add('oculta');
    }

    function abrirUsers() {
        document.getElementById('Gavetas').classList.add('oculta');
        document.getElementById('Gavetas').classList.remove('mostra');
        document.getElementById('Users').classList.add('mostra');
        document.getElementById('Users').classList.remove('oculta');
    }

    function fecharUsers() {
        document.getElementById('Gavetas').classList.add('mostra');
        document.getElementById('Gavetas').classList.remove('oculta');
        document.getElementById('Users').classList.add('oculta');
        document.getElementById('Users').classList.remove('mostra');
    }

    function logoff() {
        window.location.reload(true);
        localStorage.clear();
    }

    const handleMouseEnter = (option) => {
        setSelectedOption(option);
    };

    return (
        <div>
            <div id="Menu" className="oculta">
                <div onClick={closeMenu} className='back'> ❮ </div>
                <div id='Gavetas' className="mostra">
                    {seforAdm() && (
                        <div
                            onClick={abrirUsers}
                            id="gavetaUsers"
                            className={`gavetaOption ${selectedOption === 'gavetaUsers' ? 'highlight' : ''}`}
                            onMouseEnter={() => handleMouseEnter('gavetaUsers')}
                        >
                            USERS
                        </div>
                    )}
                    <div
                        onClick={abrirForms}
                        id="gavetaForms"
                        className={`gavetaOption ${selectedOption === 'gavetaForms' ? 'highlight' : ''}`}
                        onMouseEnter={() => handleMouseEnter('gavetaForms')}
                    >
                        MENSAGENS
                    </div>
                    <div
                        onClick={logoff}
                        className={`gavetaOption ${selectedOption === 'logoff' ? 'highlight' : ''}`}
                        onMouseEnter={() => handleMouseEnter('logoff')}
                    >
                        ENCERRAR
                    </div>
                </div>
                <div id='Forms' className='oculta'>
                    <div className="back" onClick={fecharForms}>❮</div>
                    <Formularios />
                </div>
                <div id='Users' className='oculta'>
                    <div className='back' onClick={fecharUsers}>❮</div>
                    <Users />
                </div>
            </div>
        </div>
    )
}

export default Menu;
