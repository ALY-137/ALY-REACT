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
                PROFISSIONAL APAIXONADA E VERSÁTIL. SEU FASCÍNIO PRECOCE POR TECNOLOGIA A LEVOU A CRIAR SEU PRIMEIRO SISTEMA ANTES MESMO DE INGRESSAR NA ACADEMIA. DETERMINADA EM EXERCER SUAS PAIXÕES, SE DESTACA UNINDO A PROGRAMAÇÃO COM SUA ESTÉTICA ÚNICA. COM DEDICAÇÃO CONTÍNUA AO APRENDIZADO, ELA BUSCA EMPREGAR SEUS TALENTOS EM PROJETOS IMPACTANTES E SIGNIFICATIVOS DENTRO DO CIBERESPAÇO.</p>

            <EstiloContainerBot />

        </div>

    )
}

export default Comandante;