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
                nome='CAFE' 
                nomeDescricao='CAFE'
                idNome='CAFE'
                descricao='Sistema programado para efetuar controle financeiro para corporações prestadoras de serviços. Capaz de automatizar diversas funções como: contatar clientes;  registrar pagamentos; agendamento de cobranças; levantamento de dados entre outras. Empresas que contrataram este serviço obteveram retornos com aumento de até 300% em seu faturamento mensal.'
                data={'AGOSTO de 2018'}
                atividade='DESENVOLVIMENTO'
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
                />
   

            <Card 
                nome='ECONOLISTA' 
                nomeDescricao='ECONOLISTA'
                idNome='ECONOLISTA'
                descricao='Aplicação desenvolvida para u usuárie obter maior economia em suas compras de supermercado. O aplicativo inteligente permite gerar automaticamente listas de compras e identificar a opção de comércio mais econômica buscando produtos com os menores preços.'
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
          />


            <EstiloContainerBot />
    
    
    
            </div>
    
            )

    }


export default MissoesDev;