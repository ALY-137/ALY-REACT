import theMatrixDesign from "./matrixDesign";

export function pink(){
    
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
        
    
        
        // MOSTRA/ESCONDE ABAS
        var abaDesign = document.getElementById('abaDesign');
        abaDesign.classList.remove('optionsAbasDev');
        abaDesign.classList.remove('optionsAbasHome');
        abaDesign.classList.remove('optionsAbasFocoDev');
        abaDesign.classList.remove('optionsAbasFocoHome');
        abaDesign.classList.remove('optionsAbasDesign');
        abaDesign.classList.add('optionsAbasFocoDesign');

        var abaDesign = document.getElementById('abaHome');
        abaDesign.classList.remove('optionsAbasFocoDev');
        abaDesign.classList.remove('optionsAbasFocoHome');
        abaDesign.classList.remove('optionsAbasDev');
        abaDesign.classList.remove('optionsAbasHome');
        abaDesign.classList.remove('optionsAbasFocoDesign');
        abaDesign.classList.add('optionsAbasDesign');
        
        var abaDesign = document.getElementById('abaDev');
        abaDesign.classList.remove('optionsAbasFocoHome');
        abaDesign.classList.remove('optionsAbasFocoDev');
        abaDesign.classList.remove('optionsAbasDev');
        abaDesign.classList.remove('optionsAbasHome');
        abaDesign.classList.remove('optionsAbasFocoDesign');
        abaDesign.classList.add('optionsAbasDesign');


        
        // MOSTRA/ESCONDE MATRIXES

        var abaDesign = document.getElementById('MatrixDesign');
        abaDesign.style.display = 'block';

        var abaDesign = document.getElementById('MatrixDev');
        abaDesign.style.display = 'none';

        var abaDesign = document.getElementById('MatrixHome');
        abaDesign.style.display = 'none';

        // ESTILIZA O CARD
        



            var estilo = document.getElementById('conteudoAbas');
            estilo.classList.remove('conteudoAbasMobileEstiloHome');
            estilo.classList.remove('conteudoAbasMobileEstiloDev');
            estilo.classList.add('conteudoAbasMobileEstiloDesign');


        var estilo = document.getElementById('fundo');
            estilo.classList.remove('fundoEstiloHome');
            estilo.classList.remove('fundoEstiloDev');
            estilo.classList.add('fundoEstiloDesign');

        var estilo = document.getElementById('rodape');
            estilo.classList.remove('rodapeEstiloHome');
            estilo.classList.remove('rodapeEstiloDev');
            estilo.classList.add('rodapeEstiloDesign');   
            

            
        var estilo = document.getElementById('conteudo');
            estilo.classList.remove('conteudoEstiloDev');
            estilo.classList.remove('conteudoEstiloHome');
            estilo.classList.add('conteudoEstiloDesign');  
            
        // NOTE

        var note = document.getElementById('imgnoteDesign');
        note.style.display = 'block';

        var note = document.getElementById('imgnoteDev');
        note.style.display = 'none';

        var note = document.getElementById('imgnoteHome');
        note.style.display = 'none';

        // BUSTO

        var busto = document.getElementById('imgBustoDesign2');
        busto.style.display = 'block';


        // COR TEXTO PADRÃO PAGE        
        var estilo = document.body;
        estilo.style.color = '#fb008a';           
        
        
        // TEXTO DAS ABAS

        var texto = document.getElementById('txtAbaDesign');
        texto.classList.remove('numNeutroDev');
        texto.classList.remove('numBrilhaDev');

        texto.classList.remove('numNeutroHome');
        texto.classList.remove('numBrilhaHome');

        texto.classList.add('numBrilhaDesign');


        var texto = document.getElementById('txtAbaHome');
        texto.classList.remove('numNeutroDev');
        texto.classList.remove('numBrilhaDev');

        texto.classList.remove('numNeutroHome');
        texto.classList.remove('numBrilhaHome');

        texto.classList.add('numNeutroDesign');

        var texto = document.getElementById('txtAbaDev');
        texto.classList.remove('numNeutroDev');
        texto.classList.remove('numBrilhaDev');

        texto.classList.remove('numNeutroHome');
        texto.classList.remove('numBrilhaHome');

        texto.classList.add('numNeutroDesign');

        
  
        theMatrixDesign(alyAlt,alyLar);
        
}
export default pink;