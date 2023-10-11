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
                Profissional apaixonada e versátil, combinando habilidades em desenvolvimento web e design. Seu fascínio precoce por tecnologia a levou a criar seu primeiro sistema antes mesmo de ingressar na academia, demonstrando sua capacidade em solucionar problemas. Determinada em exercer suas paixões, se destaca unindo a programação com a estética visual. Com dedicação contínua ao aprendizado, ela busca empregar seu talento combinado em projetos impactantes e significativos no ciberespaço.
                </p>

            <EstiloContainerBot />

        </div>

    )
}

export default Comandante;