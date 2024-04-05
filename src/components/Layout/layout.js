const larSreen = window.innerWidth;
const altSreen = window.innerHeight;

var alyAlt;
var alyLar;

var fundo;
var cabecalho;
var conteudo;

var cardProfile;

var estilo;
var abaDesign;



    // FUNÇÃO PROFILE É A PRIMEIRA FUNÇÃO EXECUTADA NO SISTEMA
    // EXECUTADA ASSIM QUE O SISTEMA CARREGAR
    // CRIA O LAYOUT PADRÃO DE TODO O SISTEMA


export function layout(){

    // CRIA ESTILIZAÇÃO GERAL DO LAYOUT (FUNDO, CONTEÚDO, RODAPÉ E ETC...).

    fundo = document.getElementById('fundo');
    fundo.style.display = `block`;  
    fundo.style.height = `${altSreen-5}px`;

    cabecalho = document.getElementById('cabecalho');
    cabecalho.style.display = `flex`;

    conteudo = document.getElementById('conteudo');
    conteudo.style.height = `${altSreen}px`;


    


    // DESKTOP / MOBILE

    if(larSreen>1000){
        conteudo = document.getElementById('conteudo');
        conteudo.style.width = `1000px`;
        
        fundo = document.getElementById('fundo');
        fundo.style.width = `${1000-5}px`;

        cabecalho = document.getElementById('cabecalho');
        cabecalho.style.width = `${1000-5}px`;
    
    

    }else{
        conteudo = document.getElementById('conteudo');
        conteudo.style.width = `${larSreen}px`;

        fundo = document.getElementById('fundo');
        fundo.style.width = `${larSreen-5}px`;

        cabecalho = document.getElementById('cabecalho');
        cabecalho.style.width = `${larSreen-5}px`;

    
    }


    // REDIMENCIONA CARD DESKTOP/MOBILE


    if(larSreen>1000){
        alyLar = 1000;
        alyAlt = (altSreen/100)*35;
    }else{
        
        if(larSreen>400){

            if(altSreen>400){
                alyLar = larSreen;
                alyAlt = (altSreen/100)*35;
            }else{
                alyLar = larSreen;
                alyAlt = (altSreen/100)*80;
            }
            
        }else{
            alyLar = larSreen;
            alyAlt = larSreen*0.618;
        }   
        
    }
    
    cardProfile = document.getElementById("cardProfile");
    cardProfile.style.height = `${alyAlt}px`;
    cardProfile.style.width = `${alyLar}px`;
    

    // REDIMENSIONA CONTEÚDO

    conteudo = document.getElementById('conteudo');
    conteudo.style.width = `100%`;


     
    if(larSreen>1000){
        cardProfile = document.getElementById("cardProfile");
        cardProfile.style.width = `${1000-4}px`;
    }else{
        cardProfile = document.getElementById("cardProfile");
        cardProfile.style.width = `${larSreen-4}px`;
    }

    

    estilo = document.getElementById('fundo');
    estilo.classList.remove('fundoEstiloDev');
    estilo.classList.remove('fundoEstiloDesign');
    estilo.classList.add('fundoEstiloHome');



    estilo = document.getElementById('conteudo');
    estilo.classList.remove('conteudoEstiloDev');
    estilo.classList.remove('conteudoEstiloDesign');
    estilo.classList.add('conteudoEstiloHome');
    
    // COR TEXTO PADRÃO PAGE   
    estilo = document.body;
    estilo.style.color = '#7e0eff';

    // GERENCIA ABAS
    abaDesign = document.getElementById('abaHome');
    abaDesign.classList.remove('optionsAbasDev');
    abaDesign.classList.remove('optionsAbasDesign');
    abaDesign.classList.add('optionsAbasFocoHome');

    abaDesign = document.getElementById('abaDesign');
    abaDesign.classList.remove('optionsAbasFocoDev');
    abaDesign.classList.remove('optionsAbasFocoDesign');
    abaDesign.classList.add('optionsAbasHome');
    
    abaDesign = document.getElementById('abaDev');
    abaDesign.classList.remove('optionsAbasFocoDev');
    abaDesign.classList.remove('optionsAbasFocoDesign');
    abaDesign.classList.add('optionsAbasHome');


       
       

 

}

export default layout;


