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
                descricao={(
                    <>
                        "Atualmente, estou cursando Superiror de Tecnologia em Sistemas para Internet, onde estou desenvolvendo competências essenciais para atuar no desenvolvimento web. Até agora, já adquiri as seguintes habilidades:
                        <br /><br />
                        - Domínio de técnicas de programação e solução de problemas;
                        <br />
                        - Capacidade de expressar ideias de forma clara, empregando técnicas de comunicação apropriadas;
                        <br />
                        - Adaptação a novas tecnologias;
                        <br />
                        - Projeto e desenvolvimento de aplicações para Internet;
                        <br />
                        - Desenvolvimento de aplicações utilizando diferentes linguagens e tecnologias voltadas ao desenvolvimento Web;
                        <br />
                        - Atuação como designer de páginas Web;
                        <br />
                        - Trabalho com requisitos de segurança no projeto de aplicações Web;
                        <br />
                        - Utilização de banco de dados e as respectivas tecnologias empregadas no desenvolvimento de aplicações Web;
                        <br /><br />
                        Atualmente, estou estudando:
                        <br /><br />
                        - Avaliação, projeto e implementação de requisitos de usabilidade e acessibilidade no projeto de aplicações Web;
                        <br />
                        - Realização de testes e validação de sistemas considerando aspectos de qualidade.
                        <br /><br />
                        Este curso está me preparando para enfrentar os desafios do mercado de trabalho, capacitando-me a criar soluções inovadoras e eficientes no desenvolvimento de aplicações web. Com um enfoque prático e atualizado, estou sendo incentivado a desenvolver projetos que integram teoria e prática, proporcionando uma formação completa e alinhada com as demandas atuais da indústria."
                    </>
                )}
                
                data={'ATUAL'}
                atividade='GRADUAÇÃO'
                criador='SAVANNA OLIVEIRA'
                imagem='./dev/sistemas.png'
                

                cardDescricaoDiv='cardDescricaoDivDev' 
                cardNome='cardNomeDev' 
                cardContainerDesktop='cardContainerDesktopDev' 
                cardCabecalho='cardCabecalhoDev' 
                cardImagem='cardImagemDev' 
                cardDescricao='cardDescricaoDev'
                imgCard='imgCardDev'
                
                
                classStatusC='checkIconAtivo'
                classStatusIFRS='checkIconAtivo'
                classStatusJAVA='checkIconAtivo'
                classStatusJS='checkIconAtivo'


                />
   

            <EstiloContainerBot />
    

            </div>
    
            )

    }


export default AcademiaDev;