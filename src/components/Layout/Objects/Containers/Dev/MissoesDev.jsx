import './containersDev.css';
import '../containers.css';
import EstiloContainerTop from './EstiloContainerTop';
import EstiloContainerBot from './EstiloContainerBot';
import Card from '../../Objetos/Card';




function MissoesDev(){


        return(

            <div className="containerDev" >
    
            <EstiloContainerTop tituloDev='MISSÕES' icon='./dev/missoesDev.png'/>
            
                
            <Card 
                nome='KALYCEE' 
                nomeDescricao='KALYCEE'
                idNome='KALYCEE'
                descricao={(<>
                
                "Durante uma das minhas primeiras experiências em um ambiente desenvolvedor, foi elaborado um algoritmo utilizando Visual Basic. Minhas tarefas predestinadas dentro da micro empresa envolviam apenas 
                funções de secretária, então em meio as atividades foi percebida a necessidade urgente em organização de dados.
                <br /><br />
                Para melhorar a gestão do tempo e a produtividade, foi dada a largada do desenvolvido de um sistema que automatiza tarefas como contatar clientes, registrar pagamentos, agendar cobranças, organização e levantamento de dados. Essa inovação resultou em aumentos de até 300% em faturamentos da área onde foi implementado.
                <br /><br />
                A experiência com o que hoje é chamado de KALYCEE me ensinou muito sobre inovação e eficiência. Fiquei orgulhosa ao ver o grande impacto positivo que causei na empresa e na vida de meus parceiros de negócios, despretenciosamente criando algo para facilitar meu cotidiano corporativo. Percebendo meu potencial, busquei novas oportunidades com maiores pretensões salariais, levando comigo valiosas lições sobre proatividade e impacto organizacional."
                
                </>
                )} 

                data={'2018'}
                atividade='DESENVOLVIMENTO'
                criador='SAVANNA OLIVEIRA'
                imagem='./dev/kalycee.png'
                


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
   

            <Card 
                nome='ECONOLISTA' 
                nomeDescricao='ECONOLISTA'
                idNome='ECONOLISTA'
                descricao='Aplicação desenvolvida com o propósito de os clientes obterem maior economia em suas compras de supermercado. O aplicativo inteligente permite gerar automaticamente listas de compras e identificar a opção de comércio mais econômica, buscando produtos com os menores preços.'
                data={'AGOSTO de 2019'}
                atividade='DESENVOLVIMENTO'
                criador='SAVANNA OLIVEIRA'
                imagem='./dev/econolista.png'

                
                cardDescricaoDiv='cardDescricaoDivDev' 
                cardNome='cardNomeDev' 
                cardContainerDesktop='cardContainerDesktopDev' 
                cardCabecalho='cardCabecalhoDev' 
                cardImagem='cardImagemDev' 
                cardDescricao='cardDescricaoDev' 
                imgCard='imgCardDev'
               

                classStatusC='imgCheckHabiliAtivo'
                classStatusVB='imgCheckHabiliOff'
                classStatusVS='imgCheckHabiliAtivo'
                classStatusVSHome='imgCheckHabiliOff'
                classStatusPS='imgCheckHabiliOff'
                classStatusAI='imgCheckHabiliOff'
                classStatusIN='imgCheckHabiliOff'
          />


            <EstiloContainerBot />
    
    
    
            </div>
    
            )

    }


export default MissoesDev;