import './cyberpink.css';

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

var menuNavbar;

// Função PROFILE É A PRIMEIRA FUNÇÃO EXECUTADA NO SISTEMA
// EXECUTADA ASSIM QUE O SISTEMA CARREGAR
// CRIA O LAYOUT PADRÃO DE TODO O SISTEMA

export function layout() {
   
    console.log("YEs!")
        // CRIA ESTILIZAÇÃO GERAL DO LAYOUT (FUNDO, CONTEÚDO, RODAPÉ E ETC...).
     
        fundo = document.getElementById('fundo');
        fundo.style.display = `block`;  
        fundo.style.height = `${altSreen-5}px`;

        cabecalho = document.getElementById('cabecalho');
        cabecalho.style.display = `flex`;

        conteudo = document.getElementById('conteudo');
        conteudo.style.height = `${altSreen}px`;

        // DESKTOP / MOBILE
        if(larSreen > 1000){
            conteudo.style.width = `1000px`;
            fundo.style.width = `${1000-5}px`;
            cabecalho.style.width = `${1000-5}px`;

        } else {
            conteudo.style.width = `${larSreen}px`;
            fundo.style.width = `${larSreen-5}px`;
            cabecalho.style.width = `${larSreen-5}px`;
        }

        // REDIMENCIONA CARD DESKTOP/MOBILE
        if(larSreen > 1000){
            alyLar = 1000;
            alyAlt = (altSreen/100)*35;
        } else {
            if(larSreen > 400){
                if(altSreen > 400){
                    alyLar = larSreen;
                    alyAlt = (altSreen/100)*35;
                } else {
                    alyLar = larSreen;
                    alyAlt = (altSreen/100)*80;
                }
            } else {
                alyLar = larSreen;
                alyAlt = larSreen*0.618;
            }   
        }
        
        cardProfile = document.getElementById("cardProfile");
        cardProfile.style.height = `${alyAlt}px`;
        cardProfile.style.width = `${alyLar}px`; 

        // REDIMENSIONA CONTEÚDO
        conteudo.style.width = `100%`;

        if(larSreen > 1000){
            cardProfile.style.width = `${1000-4}px`;
        } else {
            cardProfile.style.width = `${larSreen-4}px`;
        }

        estilo = document.getElementById('fundo');
        estilo.classList.remove('fundoEstiloDev');
        estilo.classList.remove('fundoEstiloDesign');
        estilo.classList.add('fundoEstiloHome');

        txtDefault();


    ;
}

export function txtDefault() {
    // COR TEXTO PADRÃO PAGE   
    estilo = document.body;
    estilo.style.color = '#ae6bfa';
}

export default layout;