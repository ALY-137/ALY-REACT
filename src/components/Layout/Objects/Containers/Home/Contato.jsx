import './containersHome.css';
import './contato.css';
import EstiloContainerTop from './EstiloContainerTop';
import EstiloContainerBot from './EstiloContainerBot';
import { fazerContato } from '../../../../Banco/init-firebase';
import { useState } from 'react';
import { validarFormulario } from './validarForm';
import { idGoogle } from '../../../../../App';

function Contato(){
    const [valorSelecionado, setValorSelecionado] = useState(''); 
    const [valorTextarea, setValorTextarea] = useState(''); 
  

    const handleClick = () => {

        var valor = validarFormulario();

        if(valor==1){

            fazerContato(idGoogle,valorSelecionado,valorTextarea);

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
                            <option value="" selected disabled>Assunto... </option>
                            <option value={'IDENTIDADE VISUAL'}> - Logotipo ou Identidade Visual.</option>
                            <option value={'ONE PAGE'}> - One Page para seu negócio.</option>
                            <option value={'SISTEMA'}> - Sistema inteligente para sua empresa.</option>
                            <option value={'OUTRO'}> - Outros serviços.</option>
                            <option value={'PROJETO ENCHENTES RS'}> - Projeto para suporte a pessoas atingidas pelas inundações no RS.</option>
                            
                        </select>

                        <textarea value={valorTextarea} id='helpMens' placeholder="Especifique aqui..." onChange={(e) => setValorTextarea(e.target.value)} ></textarea>
                        <p id="mensagemErro" class="error"></p>
                        <button type='submit' id='enviarMensagem' onClick={handleClick}> ENVIAR </button>
                    
                    </div>
                            <div id='containerSucesso'>
                                            <p className='sucesso'>CONTATO REALIZADO COM SUCESSO!</p>
                                            <p className='descriSucesso'>Sua resposta será enviada em breve para seu endereço de e-mail. Confira sua caixa de entrada.</p>
                            </div>
   
                </div>

                <EstiloContainerBot />    
    
            </div>
    
            )

    }

export default Contato;