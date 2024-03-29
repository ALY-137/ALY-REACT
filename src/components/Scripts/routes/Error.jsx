import React, { useState, useEffect } from "react";
import { useLocation } from 'react-router-dom';
import './Error.css'; 

const Error = () => {
    const location = useLocation();
    const rotaAtual = location.pathname;

    const [mostrarMensagem, setMostrarMensagem] = useState(false);

    useEffect(() => {

        const timeoutId = setTimeout(() => {
            setMostrarMensagem(true);
        }, 1000);

     
        return () => clearTimeout(timeoutId);
    }, []);

   
    if (rotaAtual === '/') {
        window.location.reload(true);
    }

    return (
        <div className="errorContainer">
            <div className={`containerError ${mostrarMensagem ? 'fadeIn' : ''}`}>
                <p className="textError">ERROR 404</p>
            </div>
        </div>
    );
};

export default Error;
