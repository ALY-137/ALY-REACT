import theMatrixDesign from "../Scripts/matrixDesign";

export function pink(){
    
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
    
        
        // MOSTRA/ESCONDE ABAS
        var abaDesign = document.getElementById('abaDesign');
        abaDesign.classList.remove('optionsAbasDev');
        abaDesign.classList.remove('optionsAbasHome');
        abaDesign.classList.remove('optionsAbasFocoDev');
        abaDesign.classList.remove('optionsAbasFocoHome');
        abaDesign.classList.remove('optionsAbasDesign');
        abaDesign.classList.add('optionsAbasFocoDesign');

        abaDesign = document.getElementById('abaHome');
        abaDesign.classList.remove('optionsAbasFocoDev');
        abaDesign.classList.remove('optionsAbasFocoHome');
        abaDesign.classList.remove('optionsAbasDev');
        abaDesign.classList.remove('optionsAbasHome');
        abaDesign.classList.remove('optionsAbasFocoDesign');
        abaDesign.classList.add('optionsAbasDesign');
        
        abaDesign = document.getElementById('abaDev');
        abaDesign.classList.remove('optionsAbasFocoHome');
        abaDesign.classList.remove('optionsAbasFocoDev');
        abaDesign.classList.remove('optionsAbasDev');
        abaDesign.classList.remove('optionsAbasHome');
        abaDesign.classList.remove('optionsAbasFocoDesign');
        abaDesign.classList.add('optionsAbasDesign');


        
        // MOSTRA/ESCONDE MATRIXES

        abaDesign = document.getElementById('MatrixDesign');
        abaDesign.style.display = 'block';

        abaDesign = document.getElementById('MatrixDev');
        abaDesign.style.display = 'none';

        abaDesign = document.getElementById('MatrixHome');
        abaDesign.style.display = 'none';


        // ESTILIZA O CARD
        



            var estilo = document.getElementById('conteudoAbas');
            estilo.classList.remove('conteudoAbasMobileEstiloHome');
            estilo.classList.remove('conteudoAbasMobileEstiloDev');
            estilo.classList.add('conteudoAbasMobileEstiloDesign');


            estilo = document.getElementById('fundo');
            estilo.classList.remove('fundoEstiloHome');
            estilo.classList.remove('fundoEstiloDev');
            estilo.classList.add('fundoEstiloDesign');

            

            
            estilo = document.getElementById('conteudo');
            estilo.classList.remove('conteudoEstiloDev');
            estilo.classList.remove('conteudoEstiloHome');
            estilo.classList.add('conteudoEstiloDesign');  
            




        // COR TEXTO PADRÃO PAGE        
        estilo = document.body;
        estilo.style.color = '#ff8aca';           
        
        
        // TEXTO DAS ABAS

        var texto = document.getElementById('txtAbaDesign');
        texto.classList.remove('numNeutroDev');
        texto.classList.remove('numBrilhaDev');

        texto.classList.remove('numNeutroHome');
        texto.classList.remove('numBrilhaHome');

        texto.classList.add('numBrilhaDesign');


        texto = document.getElementById('txtAbaHome');
        texto.classList.remove('numNeutroDev');
        texto.classList.remove('numBrilhaDev');

        texto.classList.remove('numNeutroHome');
        texto.classList.remove('numBrilhaHome');

        texto.classList.add('numNeutroDesign');

        texto = document.getElementById('txtAbaDev');
        texto.classList.remove('numNeutroDev');
        texto.classList.remove('numBrilhaDev');

        texto.classList.remove('numNeutroHome');
        texto.classList.remove('numBrilhaHome');

        texto.classList.add('numNeutroDesign');



  
        theMatrixDesign(alyAlt,alyLar);


        
}
export default pink;