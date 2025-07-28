// Aqui contem um botão para excluir conta chamando o componente ContaManager
import React, { useState, useEffect } from "react";
import ContaManager from './Conta/ContaManager';

function Propriedades() {

    console.log("Priedades renderizada!");
    return (

        
        <div>
            <h2>Propriedades</h2>
            <ContaManager />
        </div>
    );
}

export default Propriedades;