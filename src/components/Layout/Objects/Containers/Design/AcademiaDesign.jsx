import './containersDesign.css';
import '../containers.css';
import EstiloContainerTop from './EstiloContainerTop';
import EstiloContainerBot from './EstiloContainerBot';

import Card from '../../Objetos/Card';


function AcademiaDesign(){




    return(

        <div className="containerDesign" >

        <EstiloContainerTop tituloDesign='ACADEMIA' icon='./design/academiaDesign.png'/>
        
            
        <Card 
            nome='DESIGN GRÁFICO' 
            nomeDescricao='Senac RS'
            idNome='DESIGNGRAFICO'
            descricao='Curso profissionalizante realizado com a intenção de obter certificação e aperfeiçoamento no conhecimento das principais ferramentas utilizadas por profissionais da área, como o pacote Adobe e até mesmo as mais clássicas, como o CorelDRAW.'
            
            
            data=''
            atividade='CURSADO'
            criador='SAVANNA OLIVEIRA'
            imagem='./design/designgrafico.png'


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
            classStatusIN='imgCheckHabiliAtivo'
        />

        <EstiloContainerBot />



        </div>

        )

}

export default AcademiaDesign;