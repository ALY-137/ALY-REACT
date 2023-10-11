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
                nome='HELLMANS' 
                nomeDescricao='HELLMANS'
                descricao='Criação da marca do time brasileiro de eSports HELLMANS.'
                data='DEZEMBRO de 2021'
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
                classStatusPS='imgCheckHabiliAtivo'
                classStatusAI='imgCheckHabiliAtivo'
                
            />

            <EstiloContainerBot />
    
    
    
            </div>
    
            )

    }


export default MissoesDesign;