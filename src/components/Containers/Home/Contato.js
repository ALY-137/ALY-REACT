import './containersHome.css';
import './contato.css';
import EstiloContainerTop from './EstiloContainerTop';
import EstiloContainerBot from './EstiloContainerBot';

const larSreen = window.innerWidth;



function Contato(){

    if(larSreen>500){
        return(

            <div className="ContatoDesktop" >
    
     
                <EstiloContainerTop tituloHome='CONTATO' icon='./home/contato.png'/>
        
               
                <div className='containerContatos'>
                    <div id='icon0'><a href="https://wa.me/5551981662409"><img  className='subIcones' src='/home/wt.png' /></a></div>   
                    <div id='icon1'><a href="https://www.linkedin.com/in/savanna-oliveira-092725241/"><img  className='subIcones' src='/home/in.png' /></a></div>     
                </div>

                <EstiloContainerBot />
    
    
    
            </div>
    
            )

    }else{
        return(

            <div className="ContatoMob" >
    
            <EstiloContainerTop tituloHome='CONTATO' icon='./home/contato.png'/>
            
                
            <div className='containerContatos'>
                <div id='icon0'><a href="https://wa.me/5551981662409"><img  className='subIcones' src='/home/wt.png' /></a></div>   
                <div id='icon1'><a href="https://www.linkedin.com/in/savanna-oliveira-092725241/"><img  className='subIcones' src='/home/in.png' /></a></div>     
            </div>

            <EstiloContainerBot />
    
    
    
            </div>
    
            )

    }

}

export default Contato;