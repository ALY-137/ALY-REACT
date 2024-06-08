import theMatrixHome from "../Scripts/matrixHome";

export function violet(){

        const larSreen = window.innerWidth;
        const altSreen = window.innerHeight;

        var alyAlt;
        var alyLar;

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

        var abaDesign = document.getElementById('abaHome');
        abaDesign.classList.remove('optionsAbasDev');
        abaDesign.classList.remove('optionsAbasDesign');
        abaDesign.classList.remove('optionsAbasFocoDev');
        abaDesign.classList.remove('optionsAbasFocoDesign');
        abaDesign.classList.remove('optionsAbasHome');
        abaDesign.classList.add('optionsAbasFocoHome');

        abaDesign = document.getElementById('abaDesign');
        abaDesign.classList.remove('optionsAbasFocoDev');
        abaDesign.classList.remove('optionsAbasFocoDesign');
        abaDesign.classList.remove('optionsAbasDev');
        abaDesign.classList.remove('optionsAbasDesign');
        abaDesign.classList.remove('optionsAbasFocoHome');
        abaDesign.classList.add('optionsAbasHome');
        
        abaDesign = document.getElementById('abaDev');
        abaDesign.classList.remove('optionsAbasFocoDev');
        abaDesign.classList.remove('optionsAbasFocoDesign');
        abaDesign.classList.remove('optionsAbasDev');
        abaDesign.classList.remove('optionsAbasDesign');
        abaDesign.classList.remove('optionsAbasFocoHome');
        abaDesign.classList.add('optionsAbasHome');


        // MOSTRA/ESCONDE AS MATRIXES

        var aba = document.getElementById('MatrixHome');
        aba.style.display = 'block';

        aba = document.getElementById('MatrixDev');
        aba.style.display = 'none';

        aba = document.getElementById('MatrixDesign');
        aba.style.display = 'none';


        var estilo = document.getElementById('fundo');
        estilo.classList.remove('fundoEstiloDev');
        estilo.classList.remove('fundoEstiloDesign');
        estilo.classList.add('fundoEstiloHome');


        estilo = document.getElementById('conteudo');
        estilo.classList.remove('conteudoEstiloDev');
        estilo.classList.remove('conteudoEstiloDesign');
        estilo.classList.add('conteudoEstiloHome');   

        // COR TEXTO PADRÃO PAGE           
        estilo = document.body;
        estilo.style.color = '#ae6bfa';

       // TEXTO DAS ABAS

       var texto = document.getElementById('txtAbaDesign');
       texto.classList.remove('numNeutroDesign');
       texto.classList.remove('numBrilhaDesign');

       texto.classList.remove('numNeutroDev');
       texto.classList.remove('numBrilhaDev');

       texto.classList.add('numNeutroHome');


       texto = document.getElementById('txtAbaHome');
       texto.classList.remove('numNeutroDesign');
       texto.classList.remove('numBrilhaDesign');

       texto.classList.remove('numNeutroDev');
       texto.classList.remove('numBrilhaDev');

       texto.classList.add('numBrilhaHome');

       texto = document.getElementById('txtAbaDev');
       texto.classList.remove('numNeutroDesign');
       texto.classList.remove('numBrilhaDesign');

       texto.classList.remove('numNeutroDev');
       texto.classList.remove('numBrilhaDev');

       texto.classList.add('numNeutroHome');  

    





    // CHAMA FUNÇÃO MATRIX DA HOME

    

    theMatrixHome(alyAlt,alyLar);   
   


}

export default violet;