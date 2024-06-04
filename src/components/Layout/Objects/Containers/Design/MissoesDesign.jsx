import './containersDesign.css';
import '../containers.css';
import EstiloContainerTop from './EstiloContainerTop';
import EstiloContainerBot from './EstiloContainerBot';

import Card from '../../Objetos/Card';



function MissoesDesign(){


        return(

            <div className="containerDesign" >
    
            <EstiloContainerTop tituloDesign='MISSÕES' icon='./design/missoesDesign.png'/>
            
                
            <Card 
                nome='HELL MANS' 
                nomeDescricao='HELL MANS'
                idNome='HELLMANS'
                descricao='Criação da marca do time brasileiro de eSports HELL MANS.'
                data='2021'
                atividade='DESIGN'
                criador='SAVANNA OLIVEIRA'
                imagem='./design/hellmans.png'


                cardDescricaoDiv='cardDescricaoDivDesign' 
                cardNome='cardNomeDesign' 
                cardContainerDesktop='cardContainerDesktopDesign' 
                cardCabecalho='cardCabecalhoDesign' 
                cardImagem='cardImagemDesign' 
                cardDescricao='cardDescricaoDesign'
                checkboxhab='checkBoxHabDesign'
                imgCard='imgCardDesign'
                

                classStatusC='imgCheckHabiliOff'
                classStatusVB='imgCheckHabiliOff'
                classStatusVS='imgCheckHabiliOff'  
                classStatusVSHome='imgCheckHabiliOff'
                classStatusIN='imgCheckHabiliOff'  
                classStatusPS='imgCheckHabiliAtivo'
                classStatusAI='imgCheckHabiliAtivo'
                
            />

            <EstiloContainerBot />
    
    
    
            </div>
    
            )

    }


export default MissoesDesign;