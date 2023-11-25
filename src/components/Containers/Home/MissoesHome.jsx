import './containersHome.css';
import EstiloContainerTop from './EstiloContainerTop';
import EstiloContainerBot from './EstiloContainerBot';
import Card from '../../Objetos/Card';



function MissoesHome(){


        return(

            <div className="containerHome" >
    
            <EstiloContainerTop tituloHome='MISSÕES' icon='./home/missoesHome.png'/>
            
                
            <Card 
                nome='CYBERPINK-137' 
                nomeDescricao='CYBERPINK-137'
                idNome='CYBERPINK-137'
                descricao='CYBERPINK-137 é uma identidade visual com estilo baseado na cultura cyberpunk. O tema que foi criado para a plataforma Visual Studio CODE já obteve mais de 7 mil instalações. O estilo que fez tanto sucesso é adaptável a usuários que sofrem com sensibilidade à luz ou fotofobia. A paleta dark combinada com cores neon e 100% livres da luz amarela é perfeita para o conforto dos olhos de programadores.'
                data='JANEIRO de 2022'
                atividade='DESENVOLVIMENTO E DESIGN'
                criador='SAVANNA OLIVEIRA'
                imagem='./home/cyberpink.png'
                


                cardDescricaoDiv='cardDescricaoDivHome' 
                cardNome='cardNomeHome' 
                cardContainerDesktop='cardContainerDesktopHome' 
                cardCabecalho='cardCabecalhoHome' 
                cardImagem='cardImagemHome' 
                cardDescricao='cardDescricaoHome'
                checkboxhab='checkBoxHabHome'
                imgCard='imgCardHome'
                

                
                classStatusC='imgCheckHabiliOff'
                classStatusVB='imgCheckHabiliOff'
                classStatusVS='imgCheckHabiliOff'  
                classStatusVSHome='imgCheckHabiliAtivo'  
                classStatusPS='imgCheckHabiliOff'
                classStatusAI='imgCheckHabiliOff'
                
            />

            <EstiloContainerBot />
    
    
    
            </div>
    
            )

    }


export default MissoesHome;