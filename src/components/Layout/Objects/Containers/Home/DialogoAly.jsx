import './containersHome.css';
import './dialogo.css'

function DialogoAly({texto0, assinatura}) {

    return(

        <div className="containerHome">

                <p className='texto0'>{texto0}</p>
                <p className='assinatura'>{assinatura}</p>

        </div>

    )
}

export default DialogoAly;