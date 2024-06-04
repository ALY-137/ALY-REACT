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
            descricao={(
                <>
                    "Desde cedo, eu já explorava as ferramentas de design gráfico, como o pacote Adobe e CorelDRAW. Com o passar dos anos, essa paixão só cresceu, levando-me a buscar uma certificação profissional para aperfeiçoar minhas habilidades. Durante o curso, além de aprofundar meu conhecimento nas ferramentas que já me eram familiares, aprendi a preparar materiais gráficos prontos para serem enviados diretamente para gráficas, garantindo a qualidade e a eficiência na produção de impressos."
                    <br /><br />
                    "Após a conclusão do curso, dei um passo além e coloquei meus conhecimentos em prática ao realizar meu primeiro projeto de diagramação de um livro utilizando o InDesign. Esta experiência não só consolidou o que aprendi no curso, mas também me proporcionou um grande aprendizado prático."
                </>
            )}   
            data='2017'
            atividade='CURSO'
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