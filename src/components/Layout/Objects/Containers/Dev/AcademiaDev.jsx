import './containersDev.css';
import '../containers.css';
import EstiloContainerTop from './EstiloContainerTop';
import EstiloContainerBot from './EstiloContainerBot';
import Card from '../../Objetos/Card';

function AcademiaDev(){

        return(

            <div className="containerDev" >
    
                <EstiloContainerTop tituloDev='ACADEMIA' icon='./dev/academiaDev.png'/>
                
                    
                <Card 
                    nome='SISTEMAS PARA INTERNET' 
                    nomeDescricao='IFRS'
                    idNome='SISTEMASPARAINTERNET'
                    descricao='EM BREVE...'
                    data={''}
                    atividade='CURSADO'
                    criador='SAVANNA OLIVEIRA'
                    imagem='./dev/cafe.png'
                    


                    cardDescricaoDiv='cardDescricaoDivDev' 
                    cardNome='cardNomeDev' 
                    cardContainerDesktop='cardContainerDesktopDev' 
                    cardCabecalho='cardCabecalhoDev' 
                    cardImagem='cardImagemDev' 
                    cardDescricao='cardDescricaoDev'
                    imgCard='imgCardDev'
                    
                    
                    classStatusC='imgCheckHabiliOff'
                    classStatusVB='imgCheckHabiliAtivo'
                    classStatusVS='imgCheckHabiliOff'
                    classStatusVSHome='imgCheckHabiliOff'
                    classStatusPS='imgCheckHabiliOff'
                    classStatusAI='imgCheckHabiliOff'
                    classStatusIN='imgCheckHabiliOff'
                    />
    

                <EstiloContainerBot />
        
    
    
            </div>
    
            )

    }


export default AcademiaDev;