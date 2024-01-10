import React from "react";
import {useLocation} from 'react-router-dom';

const Error=()=>{
    
    const location = useLocation();
    const rotaAtual = location.pathname;

    switch (rotaAtual) {
        case '/':
        window.location.reload(true);
        default:
    }

    return(

        <div>

            <div id="containerError">
                <p id="textError">ERRO 404</p>
            </div>
     
        </div>
    )
};

export default Error;