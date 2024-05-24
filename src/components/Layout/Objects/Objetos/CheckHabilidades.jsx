import './objetos.css';


function CheckHabilidades({classStatusAI,classStatusPS,classStatusVSHome,classStatusC,classStatusVB,classStatusVS,classStatusIN}){

        return(
            <div className='checkBoxHab'>
                <img className={classStatusVB} src='./dev/vb.png' alt="imagem"/>
                <img  className={classStatusC} src='./dev/c.png' alt="imagem"/>
                <img  className={classStatusVS} src='./dev/vscode.png' alt="imagem"/>
                <img  className={classStatusVSHome} src='./home/vscode.png' alt="imagem"/>
                <img  className={classStatusPS} src='./design/ps.png' alt="imagem"/>
                <img  className={classStatusAI} src='./design/ai.png' alt="imagem"/>
                <img  className={classStatusIN} src='./design/in.png' alt="imagem"/>
            </div>
        )

}

export default CheckHabilidades;