import './containersHome.css';
import './contato.css';
import EstiloContainerTop from './EstiloContainerTop';
import EstiloContainerBot from './EstiloContainerBot';

import { fazerContato } from '../../Banco/init-firebase';

import { useState } from 'react';
import { validarFormulario } from './validarForm';


function Contato(){
    const [valorSelecionado, setValorSelecionado] = useState(''); 
    const [valorTextarea, setValorTextarea] = useState(''); 
  

    const handleClick = () => {

        var valor = validarFormulario();

        if(valor==1){
            fazerContato(valorSelecionado , valorTextarea);
            let enviado = document.getElementById('contentForm');
            enviado.style.display = 'none';

            let sucesso = document.getElementById('containerSucesso');
            sucesso.style.display = 'block';
        }


      };

        return(

            <div className="Contato" >
    
     
                <EstiloContainerTop tituloHome='CONTATO' icon='./home/contato.png'/>

                <div id='form'>

                    <div id='contentForm'>

                        <p id='formTitle'>Me conte como posso te ajudar?</p>

                        <select value={valorSelecionado}id='help'  onChange={(e) => setValorSelecionado(e.target.value)}>
                            <option value="" selected disabled>Preciso...</option>
                            <option value={1}>ter o meu Logotipo e Identidade Visual.</option>
                            <option value={2}>atualizar o conteúdo de minhas redes.</option>
                            <option value={3}>ter um perfil mais atraente no Instagram.</option>
                            <option value={4}>de uma One Page para meu negócio.</option>
                            <option value={5}>de um sistema inteligente para minha empresa.</option>
                            <option value={6}>de outro serviço.</option>
                            
                        </select>

                        <textarea value={valorTextarea} id='helpMens' placeholder="Especifique aqui..." onChange={(e) => setValorTextarea(e.target.value)} ></textarea>
                        <p id="mensagemErro" class="error"></p>
                        <button type='submit' id='enviarMensagem' onClick={handleClick}> ENVIAR </button>
                    
                    </div>
                            <div id='containerSucesso'>
                                            <p className='sucesso'>CONTATO REALIZADO COM SUCESSO!</p>
                                            <p className='descriSucesso'>Sua resposta será enviada em breve. Confira sua caixa de entrada.</p>
                            </div>

                        <div id='separador'></div>
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