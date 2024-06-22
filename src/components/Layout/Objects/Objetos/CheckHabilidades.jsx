import './objetos.css';


function CheckHabilidades({classStatusAI,
                           classStatusCSS,
                           classStatusHTML,
                           classStatusJAVA,
                           classStatusJS,
                           classStatusPS,
                           classStatusVSHome,
                           classStatusC,
                           classStatusVB,
                           classStatusVS,
                           classStatusIN,
                           classStatusIFRS}){

        return(
            <div className='checkBoxHab'>

              {classStatusIFRS && <img className={classStatusIFRS} src='./dev/ifrs.png' alt="imagem"/>}
              {classStatusVB && <img className={classStatusVB} src='./dev/vb.png' alt="imagem"/>}
              {classStatusC && <img className={classStatusC} src='./dev/c.png' alt="imagem"/>}
              {classStatusVS && <img className={classStatusVS} src='./dev/vscode.png' alt="imagem"/>}  
              {classStatusVSHome && <img  className={classStatusVSHome} src='./home/vscode.png' alt="imagem"/>} 
              {classStatusPS && <img className={classStatusPS} src='./design/ps.png' alt="imagem"/>}  
              {classStatusAI && <img className={classStatusAI} src='./design/ai.png' alt="imagem"/>}
              {classStatusIN && <img className={classStatusIN} src='./design/in.png' alt="imagem"/>}
              {classStatusJAVA && <img className={classStatusJAVA} src='./dev/java.png' alt="imagem"/>}
              {classStatusJS && <img className={classStatusJS} src='./dev/js.png' alt="imagem"/>}
              {classStatusHTML && <img className={classStatusHTML} src='./dev/html.png' alt="imagem"/>}
              {classStatusCSS && <img className={classStatusCSS} src='./dev/css.png' alt="imagem"/>}
            
            </div>
        )
}

export default CheckHabilidades;