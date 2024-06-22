import React, { useEffect, useRef } from 'react';
import './objetos.css';
import CheckHabilidades from './CheckHabilidades';

function Card({ classStatusIN, 
                classStatusCSS, 
                classStatusHTML, 
                classStatusJAVA, 
                classStatusJS,
                classStatusAI,
                classStatusPS, 
                classStatusVSHome, 
                imgCard, 
                classStatusVS, 
                classStatusC, 
                classStatusVB, 
                atividade, 
                criador, 
                nomeDescricao, 
                data, 
                descricao, 
                imagem, 
                cardDescricaoDiv, 
                cardNome, 
                nome, 
                cardContainerDesktop, 
                cardCabecalho, 
                cardImagem, 
                cardDescricao, 
                idNome,
                linkExterno,
                classStatusIFRS }) {

    const cardRef = useRef(null);

    useEffect(() => {
        function resizeCard() {
            const larSreen = window.innerWidth;
            let largura, altura;

            if (larSreen >= 350) {
                largura = 350 - 75;
            } else {
                largura = larSreen - 82;
            }
            altura = largura * 1.618;

            if (cardRef.current) {
                cardRef.current.style.width = `${largura}px`;
                cardRef.current.style.height = `${altura}px`;
            }
        }

        resizeCard();
        window.addEventListener('resize', resizeCard);

        return () => {
            window.removeEventListener('resize', resizeCard);
        };
    }, []);

    return (
        <div id={idNome} ref={cardRef} className={cardContainerDesktop}>
            <div className={cardCabecalho}>
                <p className={cardNome}> ▣  {nome}</p>
            </div>
            <div className={cardImagem}>
                <img className={imgCard} src={imagem} alt="imagem" />
            </div>
            <div className={cardDescricao}>
                <div className={cardDescricaoDiv}>
                    <CheckHabilidades
                        classStatusIN={classStatusIN}
                        classStatusC={classStatusC}
                        classStatusVB={classStatusVB}
                        classStatusVS={classStatusVS}
                        classStatusVSHome={classStatusVSHome}
                        classStatusPS={classStatusPS}
                        classStatusAI={classStatusAI}
                        classStatusIFRS={classStatusIFRS}
                        classStatusJAVA={classStatusJAVA}
                        classStatusJS={classStatusJS}
                        classStatusHTML={classStatusHTML}
                        classStatusCSS={classStatusCSS}
                    />
                    {nomeDescricao && <p className='txtTituloPri'> [ {nomeDescricao} ] </p>}
                    {descricao && <p className='txtDescricao'> {descricao}</p>}
                    {atividade && criador && <p className='txtTitulo'>  [ {atividade} ] por {criador}.</p>}
                    {data && <p className='txtTitulo'>  [ PERÍODO ] {data}.</p>}
                    {linkExterno && (
                        <p className='txtTitulo'>
                        <a href={linkExterno} target="_blank" rel="noopener noreferrer">[ LINK ]</a>
                        </p>
                    )}

                </div>
            </div>
        </div>
    );
}

export default Card;
