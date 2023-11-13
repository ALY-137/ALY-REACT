import './containersHome.css';
import './contato.css';
import EstiloContainerTop from './EstiloContainerTop';
import EstiloContainerBot from './EstiloContainerBot';

import { fazerContato } from '../../Banco/init-firebase';

import { useState } from 'react';


function Contato(){
    const [valorSelecionado, setValorSelecionado] = useState(''); 
    const [valorTextarea, setValorTextarea] = useState(''); 
  

    const handleClick = () => {
        fazerContato(valorSelecionado , valorTextarea);
        let enviado = document.getElementById('form');
        enviado.style.display = 'none';

        let sucesso = document.getElementById('containerSucesso');
        sucesso.style.display = 'block';
      };

        return(

            <div className="Contato" >
    
     
                <EstiloContainerTop tituloHome='CONTATO' icon='./home/contato.png'/>

                <div id='form'>

                        <p id='formTitle'>Me conte como posso te ajudar?</p>

                        <select value={valorSelecionado}id='help'  onChange={(e) => setValorSelecionado(e.target.value)}>
                            <option value={1}>Preciso de um CAFE.</option>
                            <option value={2}>Preciso ter um Logotipo e uma Identidade Visual.</option>
                            <option value={3}>Preciso atualizar minhas Mídias Sociais. </option>
                            <option value={4}>Preciso ter uma perfil mais atraente no Instagram.</option>
                            <option value={5}>Preciso de uma One Page profissional.</option>
                            <option value={6}>Preciso de um sistema inteligente para minha empresa.</option>
                            <option value={7}>Preciso de outro serviço.</option>
                            
                        </select>

                        <textarea value={valorTextarea} id='helpMens' placeholder="Especifique aqui..." onChange={(e) => setValorTextarea(e.target.value)} ></textarea>

                        <button id='enviarMensagem' onClick={handleClick}> ENVIAR </button>
                </div>

                <div id='containerSucesso'>
                    <p className='sucesso'>CONTATO REALIZADO COM SUCESSO!</p>
                    <p className='descriSucesso'>Aguarde a resposta ser enviada para seu endereço de e-mail...</p>
                </div>
                

                <div className='containerContatos'>
                    <div id='icon0'><a href="https://wa.me/5551981662409"><img  className='subIcones' src='/home/wt.png' alt="imagem" /></a></div>   
                    <div id='icon1'><a href="https://www.linkedin.com/in/savanna-oliveira-092725241/"><img  className='subIcones' src='/home/in.png' alt="imagem" /></a></div>     
                </div>

                <EstiloContainerBot />
    
    
    
            </div>
    
            )

   

    }



export default Contato;