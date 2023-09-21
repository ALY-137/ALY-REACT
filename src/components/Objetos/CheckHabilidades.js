import './objetos.css';


function CheckHabilidades({classStatusAI,classStatusPS,classStatusVSHome,classStatusC,classStatusVB,classStatusVS}){

        return(
            <div className='checkBoxHab'>
                <img className={classStatusVB} src='./dev/vb.png' />
                <img  className={classStatusC} src='./dev/c.png' />
                <img  className={classStatusVS} src='./dev/vscode.png' />
                <img  className={classStatusVSHome} src='./home/vscode.png' />
                <img  className={classStatusPS} src='./design/ps.png' />
                <img  className={classStatusAI} src='./design/ai.png' />
            </div>
        )

}

export default CheckHabilidades;