import theMatrixDev from "./matrixDev";

export function blue(){

    
const larSreen = window.innerWidth;
const altSreen = window.innerHeight;

var alyAlt;
var alyLar;





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
    
    
    // GERENCIA ABAS
    var abaDev = document.getElementById('abaDev');
    abaDev.classList.remove('optionsAbasDesign');
    abaDev.classList.remove('optionsAbasHome');
    abaDev.classList.remove('optionsAbasFocoHome');
    abaDev.classList.remove('optionsAbasFocoDesign');
    abaDev.classList.remove('optionsAbasDev');
    abaDev.classList.add('optionsAbasFocoDev');

    abaDev = document.getElementById('abaHome');
    abaDev.classList.remove('optionsAbasFocoHome');
    abaDev.classList.remove('optionsAbasFocoDesign');
    abaDev.classList.remove('optionsAbasDesign');
    abaDev.classList.remove('optionsAbasHome');
    abaDev.classList.remove('optionsAbasFocoDev');
    abaDev.classList.add('optionsAbasDev');
    
    abaDev = document.getElementById('abaDesign');
    abaDev.classList.remove('optionsAbasFocoHome');
    abaDev.classList.remove('optionsAbasFocoDesign');
    abaDev.classList.remove('optionsAbasDesign');
    abaDev.classList.remove('optionsAbasHome');
    abaDev.classList.remove('optionsAbasFocoDev');
    abaDev.classList.add('optionsAbasDev');




        // MOSTRA / ESCONDE MATRIXES

        abaDev = document.getElementById('MatrixDev');
        abaDev.style.display = 'block';

        abaDev = document.getElementById('MatrixDesign');
        abaDev.style.display = 'none';

        abaDev = document.getElementById('MatrixHome');
        abaDev.style.display = 'none';

        // ESTILIZA CARD

 

            var estilo = document.getElementById('conteudoAbas');
            estilo.classList.remove('conteudoAbasMobileEstiloHome');
            estilo.classList.remove('conteudoAbasMobileEstiloDesign');
            estilo.classList.add('conteudoAbasMobileEstiloDev');


        

        estilo = document.getElementById('fundo');
        estilo.classList.remove('fundoEstiloHome');
        estilo.classList.remove('fundoEstiloDesign');
        estilo.classList.add('fundoEstiloDev');

        var estiloCont = document.getElementById('rodape');
        estiloCont.classList.remove('rodapeEstiloHome');
        estiloCont.classList.remove('rodapeEstiloDesign');
        estiloCont.classList.add('rodapeEstiloDev');

    
        estiloCont = document.getElementById('conteudo');
        estiloCont.classList.remove('conteudoEstiloDesign');
        estiloCont.classList.remove('conteudoEstiloHome');
        estiloCont.classList.add('conteudoEstiloDev');  
        
        
        // COR TEXTO PADRÃO PAGE

        estilo = document.body;
        estilo.style.color = '#0e62ff';

        // TEXTO DAS ABAS

        var texto = document.getElementById('txtAbaDesign');
        texto.classList.remove('numNeutroDesign');
        texto.classList.remove('numBrilhaDesign');

        texto.classList.remove('numNeutroHome');
        texto.classList.remove('numBrilhaHome');

        texto.classList.add('numNeutroDev');


        texto = document.getElementById('txtAbaHome');
        texto.classList.remove('numNeutroDesign');
        texto.classList.remove('numBrilhaDesign');

        texto.classList.remove('numNeutroHome');
        texto.classList.remove('numBrilhaHome');

        texto.classList.add('numNeutroDev');

        texto = document.getElementById('txtAbaDev');
        texto.classList.remove('numNeutroDesign');
        texto.classList.remove('numBrilhaDesign');

        texto.classList.remove('numNeutroHome');
        texto.classList.remove('numBrilhaHome');

        texto.classList.add('numBrilhaDev');


        // ALTERA IMAGEM NOTE

        var note = document.getElementById('imgnoteDev');
        note.style.display = 'block';

        note = document.getElementById('imgnoteHome');
        note.style.display = 'none';

        note = document.getElementById('imgnoteDesign');
        note.style.display = 'none';


        // BUSTO

        var busto = document.getElementById('imgBustoDev2');
        busto.style.display = 'block';
              

        
        theMatrixDev(alyAlt,alyLar);
       
}

export default blue;