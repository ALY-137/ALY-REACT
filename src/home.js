import theMatrixHome from "./matrixHome";

export function violet(){
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

     
        var abaDesign = document.getElementById('abaHome');
        abaDesign.classList.remove('optionsAbasDev');
        abaDesign.classList.remove('optionsAbasDesign');
        abaDesign.classList.remove('optionsAbasFocoDev');
        abaDesign.classList.remove('optionsAbasFocoDesign');
        abaDesign.classList.remove('optionsAbasHome');
        abaDesign.classList.add('optionsAbasFocoHome');

        var abaDesign = document.getElementById('abaDesign');
        abaDesign.classList.remove('optionsAbasFocoDev');
        abaDesign.classList.remove('optionsAbasFocoDesign');
        abaDesign.classList.remove('optionsAbasDev');
        abaDesign.classList.remove('optionsAbasDesign');
        abaDesign.classList.remove('optionsAbasFocoHome');
        abaDesign.classList.add('optionsAbasHome');
        
        var abaDesign = document.getElementById('abaDev');
        abaDesign.classList.remove('optionsAbasFocoDev');
        abaDesign.classList.remove('optionsAbasFocoDesign');
        abaDesign.classList.remove('optionsAbasDev');
        abaDesign.classList.remove('optionsAbasDesign');
        abaDesign.classList.remove('optionsAbasFocoHome');
        abaDesign.classList.add('optionsAbasHome');


        // MOSTRA/ESCONDE AS MATRIXES

        var aba = document.getElementById('MatrixHome');
        aba.style.display = 'block';

        var aba = document.getElementById('MatrixDev');
        aba.style.display = 'none';

        var aba = document.getElementById('MatrixDesign');
        aba.style.display = 'none';




                var estilo = document.getElementById('conteudoAbas');
                estilo.classList.remove('conteudoAbasMobileEstiloDev');
                estilo.classList.remove('conteudoAbasMobileEstiloDesign');
                estilo.classList.add('conteudoAbasMobileEstiloHome');



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

       // TEXTO DAS ABAS

       var texto = document.getElementById('txtAbaDesign');
       texto.classList.remove('numNeutroDesign');
       texto.classList.remove('numBrilhaDesign');

       texto.classList.remove('numNeutroDev');
       texto.classList.remove('numBrilhaDev');

       texto.classList.add('numNeutroHome');


       var texto = document.getElementById('txtAbaHome');
       texto.classList.remove('numNeutroDesign');
       texto.classList.remove('numBrilhaDesign');

       texto.classList.remove('numNeutroDev');
       texto.classList.remove('numBrilhaDev');

       texto.classList.add('numBrilhaHome');

       var texto = document.getElementById('txtAbaDev');
       texto.classList.remove('numNeutroDesign');
       texto.classList.remove('numBrilhaDesign');

       texto.classList.remove('numNeutroDev');
       texto.classList.remove('numBrilhaDev');

       texto.classList.add('numNeutroHome');  

        // ALTERA IMAGEM NOTE

        var note = document.getElementById('imgnoteDev');
        note.style.display = 'none';

        var note = document.getElementById('imgnoteHome');
        note.style.display = 'block';

        var note = document.getElementById('imgnoteDesign');
        note.style.display = 'none';  


        // ALTERA IMAGEM BUSTO

        var aba = document.getElementById('imgBustoHome2');
        aba.style.display = 'block';

        var aba = document.getElementById('imgBustoDev2');
        aba.style.display = 'none';

        var aba = document.getElementById('imgBustoDesign2');
        aba.style.display = 'none';

    // CHAMA FUNÇÃO MATRIX DA HOME

    theMatrixHome(alyAlt,alyLar);   
   


}

export default violet;