import './objetos.css'
import CheckHabilidades from './CheckHabilidades';

function Card({classStatusIN,classStatusAI,classStatusPS,classStatusVSHome,imgCard,classStatusVS,classStatusC,classStatusVB,atividade,criador,nomeDescricao,data,descricao,imagem,cardDescricaoDiv,cardNome,nome,cardContainerDesktop,cardCabecalho,cardImagem,cardDescricao,idNome}){


    return(

        <div id={idNome}   className={cardContainerDesktop}>
            <div className={cardCabecalho}>
                <p className={cardNome}> ▣  {nome}</p>
            </div>
            <div className={cardImagem}>
                <img  className={imgCard} src={imagem} alt="imagem"/>
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
                    />
                                  
                    
                    {nomeDescricao && <p className='txtTituloPri'> [ {nomeDescricao} ] </p>}
                    {descricao && <p className='txtDescricao'> {descricao}</p>}
                    {atividade && criador && <p className='txtTitulo'>  [ {atividade} ] por {criador}.</p>}
                    {data && <p className='txtTitulo'>  [ DATA ] {data}.</p>}


                </div>
            </div>

      


        </div>

        

    )

}

export default Card;

