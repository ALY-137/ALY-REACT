import Formularios from "./Formularios/Formularios";
import Users from "./Users/Users";
import Config from "./Config/Config";
import { seforAdm } from "../../Scripts/verificações/verificaAdm";




function Menu(){

    function closeMenu(){
        document.getElementById('Menu').classList.add('oculta');
        document.getElementById('Menu').classList.remove('openMenu');

        //Fixa rolagem do conteúdo da página.
        document.getElementById('fundo').classList.remove('scroll-lock');
        document.getElementById('cardProfile').classList.remove('scroll-lock');
        document.getElementById('conteudo').classList.remove('scroll-lock');
    }

    function abrirForms(){
        document.getElementById('Gavetas').classList.add('oculta');
        document.getElementById('Gavetas').classList.remove('mostra');

        document.getElementById('Forms').classList.add('mostra');
        document.getElementById('Forms').classList.remove('oculta');  

    }
    function fecharForms(){
        document.getElementById('Gavetas').classList.remove('oculta');
        document.getElementById('Gavetas').classList.add('mostra');

        document.getElementById('Forms').classList.remove('mostra');
        document.getElementById('Forms').classList.add('oculta');  

    }

    function abrirUsers(){
        document.getElementById('Gavetas').classList.add('oculta');
        document.getElementById('Gavetas').classList.remove('mostra');

        document.getElementById('Users').classList.add('mostra');
        document.getElementById('Users').classList.remove('oculta');  

    }

    function fecharUsers(){
        document.getElementById('Gavetas').classList.add('mostra');
        document.getElementById('Gavetas').classList.remove('oculta');

        document.getElementById('Users').classList.add('oculta');
        document.getElementById('Users').classList.remove('mostra');  

    }

    function abrirConfig(){
        document.getElementById('Gavetas').classList.add('oculta');
        document.getElementById('Gavetas').classList.remove('mostra');

        document.getElementById('Config').classList.add('mostra');
        document.getElementById('Config').classList.remove('oculta');  
    }

    function fecharConfig(){
        document.getElementById('Gavetas').classList.add('mostra');
        document.getElementById('Gavetas').classList.remove('oculta');

        document.getElementById('Config').classList.add('oculta');
        document.getElementById('Config').classList.remove('mostra');  
    }



    function recarregarPagina() {
        window.location.reload(true); 
    }

    return(

        <div>
            <div id="Menu" className="oculta">
                <div id='Gavetas' className="mostra">
                    <div onClick={closeMenu} className='gaveta'> VOLTAR </div>
                   
                   {seforAdm() && (
                    <div onClick={abrirUsers} className='gaveta' id="gavetaUsers"> USUÁRIES </div>
                   )}
                   
                    <div onClick={abrirForms} className='gaveta' id="gavetaForms"> FORMULÁRIOS </div>
                    <div onClick={abrirConfig} className='gaveta' id="gavetaConfig"> CONFIGURAÇÕES </div>
                    <div onClick={recarregarPagina} className='gaveta'> ENCERRAR </div>   
                </div>

                <div id='Forms' className='oculta'>
                    <div id='closeMensagensButton' onClick={fecharForms}>VOLTAR</div>
                    <Formularios />
                </div>

                
                <div id='Users' className='oculta'>
                    <div id='closeMensagensButton' onClick={fecharUsers} >VOLTAR</div>
                    <Users />
                </div>

                <div id='Config' className='oculta'>
                    <div id='closeMensagensButton' onClick={fecharConfig} >VOLTAR</div>
                    <Config />
                </div>
               
            
            </div> 
        </div>   

    )
}

export default Menu;