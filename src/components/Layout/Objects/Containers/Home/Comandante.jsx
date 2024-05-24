import EstiloContainerTop from "./EstiloContainerTop";
import EstiloContainerBot from "./EstiloContainerBot";
import './comandante.css';
import '../containers.css';

function Comandante(){

    return(

        <div className="containerHome">
            <EstiloContainerTop tituloHome='COMANDANTE' icon='./home/comandante.png'/>
                
                <img  className='stars' src='/home/stars.png' alt="imagem"/>
                <p className="subtitulo">SAVANNA OLIVEIRA</p>
                
                <p className='paragrafo'>
                UMA PESQUISADORA QUE TEM COMO PRINCIPAIS CARACTERÍSTICAS A AUTENTICIDADE E A VERSATILIDADE EM REALIZAR SEUS OBJETIVOS. SEU FASCÍNIO PRECOCE POR TECNOLOGIAS A LEVOU A CRIAR SEU PRIMEIRO ALGORITMO ANTES MESMO DE INGRESSAR NA ACADEMIA. DETERMINADA EM EXERCER SUAS PAIXÕES, SE DESTACA UNINDO A PROGRAMAÇÃO COM SUA ESTÉTICA ÚNICA. COM DEDICAÇÃO CONTÍNUA AO ESTUDO, BUSCA EMPREGAR SEUS TALENTOS EM PROJETOS IMPACTANTES E SIGNIFICATIVOS PARA O CIBERESPAÇO.</p>

            <EstiloContainerBot />
        </div>

    )
}

export default Comandante;