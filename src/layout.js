const larSreen = window.innerWidth;
const altSreen = window.innerHeight;

var alyAlt;
var alyLar;

    // A FUNÇÃO PROFILE É A PRIMEIRA FUNÇÃO EXECUTADA NO SISTEMA
    // ELA É EXECUTADA ASSIM QUE O SISTEMA CARREGAR
    // CRIA O LAYOUT PADRÃO DE TODO O SISTEMA
    // ELA TAMBÉM É RESPONSÁVEL POR GERENCIAR A BARRA HOME
    // ONDE É VISUALIZAÇÃO INICIAL DO PROGRAMA

export function layout(){

    // CRIA ESTILIZAÇÃO GERAL DO LAYOUT (FUNDO, CONTEÚDO, RODAPÉ E ETC...).

    var fundo = document.getElementById('fundo');
    fundo.style.display = `block`;  

    var cabecalho = document.getElementById('cabecalho');
    cabecalho.style.display = `flex`;

    var conteudo = document.getElementById('conteudo');
    conteudo.style.height = `${altSreen}px`;

    var fundo = document.getElementById('fundo');
    fundo.style.height = `${altSreen-5}px`;


    // DESKTOP / MOBILE

    if(larSreen>1000){
        var conteudo = document.getElementById('conteudo');
        conteudo.style.width = `1000px`;
        var fundo = document.getElementById('fundo');
        fundo.style.width = `${1000-5}px`;

        var cabecalho = document.getElementById('cabecalho');
        cabecalho.style.width = `${1000-5}px`;
    
        var rodape = document.getElementById('rodape');
        rodape.style.width = `${1000-6}px`;
    

    }else{
        var conteudo = document.getElementById('conteudo');
        conteudo.style.width = `${larSreen}px`;

        var fundo = document.getElementById('fundo');
        fundo.style.width = `${larSreen-5}px`;

        var cabecalho = document.getElementById('cabecalho');
        cabecalho.style.width = `${larSreen-5}px`;
    
        var rodape = document.getElementById('rodape');
        rodape.style.width = `${larSreen-6}px`;
    
    }


    // REDIMENCIONA CARD DESKTOP/MOBILE

    alyAlt = altSreen-137;
    
    if(larSreen>1000){
        alyLar = 1000;
        alyAlt = (altSreen/100)*35;
    }else{
        if(altSreen<400){
            alyLar = larSreen;
            alyAlt = (altSreen/100)*80;

        }else{
            alyLar = larSreen;
            alyAlt = (altSreen/100)*35;
        }
            
        
    }
        
    
    var cardProfile = document.getElementById("cardProfile");
    cardProfile.style.height = `${alyAlt}px`;
    cardProfile.style.width = `${alyLar}px`;
    

    // REDIMENSIONA CONTEÚDO

    var conteudo = document.getElementById('conteudo');
    conteudo.style.width = `100%`;

        
    var conteudoAbas = document.getElementById('conteudoAbas');  
    conteudoAbas.classList.add('conteudoAbasMobileEstiloHome');

     
    if(larSreen>1000){
        var cardProfile = document.getElementById("cardProfile");
        cardProfile.style.width = `${1000-4}px`;
    }else{
        var cardProfile = document.getElementById("cardProfile");
        cardProfile.style.width = `${larSreen-4}px`;
    }

    

    var estilo = document.getElementById('fundo');
    estilo.classList.remove('fundoEstiloDev');
    estilo.classList.remove('fundoEstiloDesign');
    estilo.classList.add('fundoEstiloHome');

    var estilo = document.getElementById('rodape');
    estilo.classList.remove('rodapeEstiloDev');
    estilo.classList.remove('rodapeEstiloDesign');
    estilo.classList.add('rodapeEstiloHome');

    var estilo = document.getElementById('conteudo');
    estilo.classList.remove('conteudoEstiloDev');
    estilo.classList.remove('conteudoEstiloDesign');
    estilo.classList.add('conteudoEstiloHome');
    
    // COR TEXTO PADRÃO PAGE   
    var estilo = document.body;
    estilo.style.color = '#7e0eff';

    // GERENCIA ABAS
    var abaDesign = document.getElementById('abaHome');
    abaDesign.classList.remove('optionsAbasDev');
    abaDesign.classList.remove('optionsAbasDesign');
    abaDesign.classList.add('optionsAbasFocoHome');

    var abaDesign = document.getElementById('abaDesign');
    abaDesign.classList.remove('optionsAbasFocoDev');
    abaDesign.classList.remove('optionsAbasFocoDesign');
    abaDesign.classList.add('optionsAbasHome');
    
    var abaDesign = document.getElementById('abaDev');
    abaDesign.classList.remove('optionsAbasFocoDev');
    abaDesign.classList.remove('optionsAbasFocoDesign');
    abaDesign.classList.add('optionsAbasHome');


        // BUSTO

        var busto = document.getElementById('imgBustoDev2');
        busto.style.display = 'none';
        
        var busto = document.getElementById('imgBustoDesign2');
        busto.style.display = 'none';

        var busto = document.getElementById('imgBustoHome2');
        busto.style.display = 'block';

        
       

 

}

export default layout;


