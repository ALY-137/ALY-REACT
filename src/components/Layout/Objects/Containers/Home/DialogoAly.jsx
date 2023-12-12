import './containersHome.css';
import EstiloContainerTop from './EstiloContainerTop';
import EstiloContainerBot from './EstiloContainerBot';
import './dialogo.css'

function DialogoAly({texto}){

    return(


        <div className="containerHome">

        
                <EstiloContainerTop tituloHome='ALY-137©' icon='./logo.png'/>


                <p className='texto1'>{texto}</p>


                <EstiloContainerBot />


        </div>

    )
}

export default DialogoAly;