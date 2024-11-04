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

                    Uma criadora marcada pela autenticidade e versatilidade em suas obras. Sua inclinação natural para automatizar tarefas a levou a explorar soluções criativas, mesmo antes de entrar na academia. Movida pela satisfação de proporcionar experiências a seus usuáries, combina programação com uma estética memorável, destacando-se por transformar suas ideias em projetos impactantes no ciberespaço. Com dedicação contínua ao estudo, busca aplicar seus talentos em iniciativas que deixam uma marca significativa no mundo digital.

                </p>
            <EstiloContainerBot />
        </div>

    )
}

export default Comandante;