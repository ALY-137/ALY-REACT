//DEV:  ALY-137

//IMPORTAÇÕES

/////////////////////////////////////////////

const largura = window.innerWidth;
const altura = window.innerHeight;
//Essas variáveis foram criadas para obter os valores em pixels das dimensões de tela qual o usuário está utilizando.

var resultado;

function realocaChuvasTxt(altura){

    if(altura<400){
        resultado = (altura/100) * 58;
        resultado = -(alyAlt - resultado);
    }else{
        resultado = (altura/100) * 28;
        resultado = -(alyAlt - resultado);
    }

return resultado;    
}



var alyAlt = altura-137;
    
if(largura>1000){
    alyAlt = (altura/100)*35;
}else{
    if(altura<400){
        alyAlt = (altura/100)*80;

    }else{
        alyAlt = (altura/100)*35;
    }
}

// CARACTERES SOMBRA
var caracteres = ["1","0"];


// CARACTERES BRILHANTES
const caracteres1 = ["兎","1","0"," "];
//Esses são os arrays com os pacotes de caracteres que serão usados na matrix.

const random = (min, max) => Math.floor(Math.random() * (max - min) + min);
//Essa é uma função que gera números aleatórios com parâmetro de um número mínimo e máximo.

var numLin = 0;
var numCol = Math.trunc((largura) / 20);

const caseDev = [];
//Essa variável armazena a div da div que armazena o caractere. 
const matrix = [];
//Essa variável armazena a div que armazena o caractere.

const chuvas =[];
var chuvaAltura = 0;
var chuvaLargura = 0;
const comprimento0 = [];
var nome;
var numNome;
var MensBVNome = [];
const mensagem1 = [];
const sequenciaemV1 = [];
var ref1 = 0;
var posj3 = [];
const comprimento3 = [];
var tempAnima3;
var tempAnima2;
var tempAnima1;
var prox1 = 0;
var numLin3;
var meio =  0;
var meio1 = 0;
var sequenciaemVChuva0 = [];
var guarda = 0;
//Essa variável guarda o valor da primeira posição da sequência.

const MensBV = ["L","A","B","O","R","A","T","Ó","R","I","O"];
var numMensBV = MensBV.length;
const mensagem0 = [];
const sequenciaemV = [];
var comeco;
var numLin2;
var cont=0;
const comprimento2 = [];

var aLi1 = [];
var aLi2 = [];
var aLi3 = [];

var aLf1 = [];
var aLf2 = [];
var aLf3 = [];

var temporizadorI1 = [];
var temporizadorI2 = [];
var temporizadorI3 = [];

var temporizadorF1 = [];
var temporizadorF2 = [];
var temporizadorF3 = [];

const wait = ms => new Promise(resolve => setInterval(resolve, ms));


export var contAnimatrix = 0;




function theMatrixDev(altura,largura){

    if(contAnimatrix===0){
        contAnimatrix=1; 


        numLin = Math.trunc(((altura) / 20)-1);
        numCol = Math.trunc(((largura) / 20)-1);
        if(numCol%2===0){
        numCol = numCol -1;
        }
        //Limita número de linhas e colunas.
        //A fim de obter uma centralização perfeita para a frase de BOAS-VINDAS o número de colunas passa a ser impar.
        

        criachuvas(); // Essas divs são criadas para armazenar separamente cada sessão de chuva da animação da matrix.
        redimenChuvas(); // Essas variáveis tem a finalidade de definir e atribuir as dimensões exatas da div que irá armazenar a matrix.
        comprimentoCols0(); //Esse array determina o comprimento de uma coluna de chuva variando aleatóriamente.
        comprimentoCols2();
        desenhaMatrix(); //Essa função desenha a base da matrix sobrepondo as 4 sessões de chuva.
        linhaMeio2();
        linhaMeio3();
        colunasMeio(); // Tem o objetivo de identificar o caractere que fica no meio de uma linha. 
        enviaNome();
        criaSequenciaemV(); //Esse for define os valores do array que refere a sequencia do primeiro ciclo da chuva.
        guardaPos();
        sequenciaemVChuva0.sort(randOrd); // Aleatoriza a sequência.
        idPosMeio(); // Esse for percorre o vetor da sequência e quando identifica a posição do meio troca o seu valor pelo valor da primeira posição.
        construVetMens();
        caiemV(sequenciaemV,numMensBV); // Organiza a sequência para que as letras caem na forma de V.
        comecoMBV(); // Identifica a posição em que a MensBV deve começar para ficar centralizada.
        preencheZeros(); // Esse for preenche com zeros as posições que antecedem a posição que foi identificada como a de início da frase.
        start1();

    }

}


function criachuvas(){
    for(var i=0;i<4;i++){
        chuvas[i] = document.createElement("div");
        chuvas[i].setAttribute('id', `chuvaDev${i}`);
        document.getElementById('MatrixDev').appendChild(chuvas[i]);
    }
}

function redimenChuvas(){
chuvaAltura = numLin * 20;
chuvaLargura = numCol * 20;

var chuvamatrix = document.getElementById('MatrixDev');
chuvamatrix.style.height = `${chuvaAltura}px`;
chuvamatrix.style.width = `${chuvaLargura}px`;

chuvamatrix = document.getElementById('chuvaDev0');
chuvamatrix.style.height = `${chuvaAltura}px`;
chuvamatrix.style.width = `${chuvaLargura}px`;

chuvamatrix = document.getElementById('chuvaDev1');
chuvamatrix.style.height = `${chuvaAltura}px`;
chuvamatrix.style.width = `${chuvaLargura}px`;

chuvamatrix = document.getElementById('chuvaDev2');
chuvamatrix.style.height = `${chuvaAltura}px`;
chuvamatrix.style.width = `${chuvaLargura}px`;

chuvamatrix = document.getElementById('chuvaDev3');
chuvamatrix.style.height = `${chuvaAltura}px`;
chuvamatrix.style.width = `${chuvaLargura}px`;
}

function comprimentoCols0(){
    for (var i = 0; i < numCol; i++) {
        comprimento0[i] = random(numLin+1, numLin + numLin/2);
    }    
}

function desenhaMatrix() {
    var i,j,n;
    for (i = 0; i < numLin; i++) {
        caseDev[i] = [];
        for (j = 0; j < numCol; j++) {
            caseDev[i][j]= [];
            for (n = 0; n < 4; n++) {
                caseDev[i][j][n] = document.createElement("div");
                caseDev[i][j][n].setAttribute('class', `caseDev`);
                caseDev[i][j][n].setAttribute('id', `caseDev${i}.${j}.${n}`);
                document.getElementById(`chuvaDev${n}`).appendChild(caseDev[i][j][n]);
            }
        }
    }
    for (i = 0; i < numLin; i++) {
        matrix[i] = [];
        for (j = 0; j < numCol; j++) {
            matrix[i][j]=[];
            for (n = 0; n < 4; n++) {
            
                matrix[i][j][n] = document.createElement("div");
                matrix[i][j][n].setAttribute('id', 'nums');
                matrix[i][j][n].setAttribute('class', 'numOff');
                matrix[i][j][n].innerHTML = `兎`;
                document.getElementById(`caseDev${i}.${j}.${n}`).appendChild(matrix[i][j][n]);
            
        }
        }
    }
};

function linhaMeio3(){
    numLin3 = Math.floor(numLin/2 +1);
}

function colunasMeio(){
    meio =  Math.trunc(numCol / 2);
    meio1 = meio;
}

function criaSequenciaemV(){
    for (var i = 0; i < numCol; i++) {
    sequenciaemVChuva0[i] = i;
}
}

function guardaPos(){
    guarda = sequenciaemVChuva0[0];
}

function randOrd() {
    return (Math.round(Math.random()) - 0.5);
}
//Essa função troca de posição os valores de um vetor aleatóriamente.

function idPosMeio(){
    for (var i = 0; i < numCol ; i++) {
        if (sequenciaemVChuva0[i] === meio) {
        sequenciaemVChuva0[i] = guarda;
        sequenciaemVChuva0[0] = meio;
        }
    }
}

function construVetMens(){
    for(var i=0;i<numCol;i++){
    mensagem0[i]= i;
    }
}

function caiemV(vetor,tamanho){
    var ref = 0;
    for(var i= 0;i<tamanho;i++){
        if(i===0){
        vetor[i]= meio;

        }else{
        if(ref===0){
            meio= meio-i;

            ref += 1;
        }else{
            meio= meio+i;

            ref -= 1;
        }
        vetor[i]=meio;
        }
    }
}

function comecoMBV(){
    if(numMensBV%2===0){
    comeco = sequenciaemV[numMensBV-1];

    }else{
    comeco = sequenciaemV[numMensBV-2];
    };
}

function preencheZeros(){
    for( var i =0 ;i<numCol;i++){
        if(i<comeco){
        mensagem0[i]=0;
        }else{
        mensagem0[i]=MensBV[cont];
        cont +=1;
        };
    }
}

function comprimentoCols2(){
    for (var i = 0; i < numMensBV; i++){
    comprimento2[i] = random((numLin/2)+1,numLin );
    }
}

function linhaMeio2(){
    numLin2=Math.floor(numLin/2);
}

function trocador(d) {
    for (var a = 0; a < numLin; a++) {
        for (var b = 0; b < numCol; b++) {
            for (var c = 0; c < 2; c++) {
                if (b % 2 === 0) {
                    d[a][b][c].innerHTML = `${caracteres[random(0, caracteres.length)]}`;
                }
            }
        }
    }
}



function enviaNome(){ 


   
        nome = "DEVELOPER";   


    

    nome = nome.toUpperCase(); // DEIXA NOME SEMPRE EM MAIÚSCULO
    numNome = nome.length;
    MensBVNome = nome.split('');
    
        for(var i=0;i<numCol;i++){
            mensagem1[i]= i;
        }

        for(i= 0;i<numNome;i++){
            if(i===0){
                sequenciaemV1[i]= meio1;

            }else{
                if(ref1===0){
                    meio1= meio1-i;

                    ref1 += 1;
                }else{
                    meio1= meio1+i;

                    ref1 -= 1;
                }
                sequenciaemV1[i]=meio1;
            }

        }


        for(i=0;i<numNome;i++){
                posj3[i]= sequenciaemV1[i];
        }

        var comeco1 ;

        if(numNome%2===0){
            comeco1 = sequenciaemV1[numNome-1];
            centralizaNome();
        }else{
            comeco1 = sequenciaemV1[numNome-2];
        };


        var cont1=0;
        for( i =0 ;i<numCol;i++){
            if(i<comeco1){
                mensagem1[i]=0;
            }else{
                mensagem1[i]=MensBVNome[cont1];
                cont1 +=1;
            };
        }

        for ( i = 0; i < numNome; i++) {
            comprimento3[i] = random((numLin/2)+1 , numLin );
        }
                

}



async function anima1() {
    trocador(matrix);

    for (var j = 0; j < numCol; j++) {

        await wait(1280/ (j + 2));

        if (aLi1[j] === 0) {
     
                matrix[aLi1[j]][sequenciaemVChuva0[j]][1].setAttribute('class', 'numBrilhaDev');
                matrix[aLi1[j]][sequenciaemVChuva0[j]][1].innerHTML = `${caracteres1[random(0, caracteres1.length)]}`;
    
   
        } else {
            if (aLi1[j] <= numLin && aLf1[j] === 0) {

                    matrix[aLi1[j] - 1][sequenciaemVChuva0[j]][1].setAttribute('class', 'numNeutroDev');
                    matrix[aLi1[j] - 1][sequenciaemVChuva0[j]][1].innerHTML = `${caracteres[random(0, caracteres.length)]}`;
    
   

                if (temporizadorI1[j] >= numLin && aLf1[j] === 0) {
       
                        matrix[aLi1[j]][sequenciaemVChuva0[j]][1].setAttribute('class', 'numNeutroDev');
                        matrix[aLi1[j]][sequenciaemVChuva0[j]][1].innerHTML = `${caracteres[random(0, caracteres.length)]}`;
    
         

                } else {
          
                        matrix[aLi1[j]][sequenciaemVChuva0[j]][1].setAttribute('class', 'numBrilhaDev');
                        matrix[aLi1[j]][sequenciaemVChuva0[j]][1].innerHTML = `${caracteres1[random(0, caracteres1.length)]}`;
               
          
                }
            }
        }

        temporizadorI1[j] += 1;
        
        if (temporizadorI1[j] > numLin + numLin/2){
            prox1 += 1;
            if (prox1 === 1){
                if(contAnimatrix===1){
                    start2();
                    start3();
                }
                
            }
        }

        if (temporizadorI1[j] < numLin){
            aLi1[j] += 1;
        };

        if (temporizadorI1[j] >= comprimento0[j]){

            matrix[aLf1[j]][sequenciaemVChuva0[j]][1].setAttribute('class', 'numOff');

            temporizadorF1[j] += 1;
            if (temporizadorF1[j] > numLin * 3) {
                clearInterval(tempAnima1);
                
            }

            if (temporizadorF1[j] < numLin) {
                aLf1[j] += 1;
            }

        }

    }

};



function start1() {
    prox1 = 0;

    for (var i = 0; i <= numCol; i++) {
        aLi1[i] = 0;
        aLf1[i] = 0;
        temporizadorI1[i] = 0;
        temporizadorF1[i] = 0;
    }
    tempAnima1 = setInterval(async () => await anima1(), 80);
}

async function anima2() {
    for (var a = 0; a < numLin2 -1 ; a++) {
        for (var b = 0; b < numCol; b++) {
            
                if (b % 2 === 0) {
                    matrix[a][b][2].innerHTML = `${caracteres[random(0, caracteres.length)]}`;
                }
            
        }
    }
   
    for (var j = 0; j < numMensBV; j++) {

        await wait(1280 / (j + 2));

        if (aLi2[j] === 0) {
     
                matrix[aLi2[j]][sequenciaemV[j]][2].setAttribute('class', 'numBrilhaDev');
                matrix[aLi2[j]][sequenciaemV[j]][2].innerHTML = `${caracteres1[random(0, caracteres1.length)]}`;
    
     
        } else {
            if (aLi2[j] < numLin2 && aLf2[j] === 0) {
  
                    matrix[aLi2[j] - 1][sequenciaemV[j]][2].setAttribute('class', 'numNeutroDev');
                    matrix[aLi2[j] - 1][sequenciaemV[j]][2].innerHTML = `${caracteres[random(0, caracteres.length)]}`;
    
         

                if (temporizadorI2[j] > numLin2   && aLf2[j] === 0) {
               
                        matrix[aLi2[j]][sequenciaemV[j]][2].setAttribute('class', 'numNeutroDev');
                        matrix[aLi2[j]][sequenciaemV[j]][2].innerHTML = `${caracteres[random(0, caracteres.length)]}`;
    
                  
     
                } else {
           
                        matrix[aLi2[j]][sequenciaemV[j]][2].setAttribute('class', 'numBrilhaDev');
                        matrix[aLi2[j]][sequenciaemV[j]][2].innerHTML = `${mensagem0[sequenciaemV[j]]}`;    

                   
                 }
            }
        }

        temporizadorI2[j] += 1;

        if (temporizadorI2[j] <= numLin2  ) {
            aLi2[j] += 1;
        };

        if (temporizadorI2[j] >= comprimento2[j] && aLf2[j] < numLin2-1) {

            matrix[aLf2[j]][sequenciaemV[j]][2].setAttribute('class', 'numOff');

            temporizadorF2[j] += 1;

            if (temporizadorF2[j] > (numLin/2) * 8) {
                clearInterval(tempAnima2);   
            }

            if (temporizadorF2[j] < numLin2 -1) {
                aLf2[j] += 1;
            }

        }

    }

};


function start2() {
    for (var i = 0; i <= numCol; i++) {
        aLi2[i] = 0;
        aLf2[i] = 0;
        temporizadorI2[i] = 0;
        temporizadorF2[i] = 0;
    }
    tempAnima2 = setInterval(async () => await anima2(), 80);
}


export async function anima3() {  
    return new Promise(async (resolve) => {
        for (var a = 0; a < numLin3 -1 ; a++) {
            for (var b = 0; b < numCol; b++) {
                if (b % 2 === 0) {
                    matrix[a][b][3].innerHTML = `${caracteres[random(0, caracteres.length)]}`;
                }  
            }
        }
    
        for (var j = 0; j < numNome; j++) {

            await wait(1280/(j + 2));

            if (aLi3[j] === 0) {
        
                    matrix[aLi3[j]][posj3[j]][3].setAttribute('class', 'numBrilhaDev');
                    matrix[aLi3[j]][posj3[j]][3].innerHTML = `${caracteres1[random(0, caracteres1.length)]}`;
        
            } else {
                if (aLi3[j] < numLin3 && aLf3[j] === 0) {
            
                        matrix[aLi3[j] - 1][posj3[j]][3].setAttribute('class', 'numNeutroDev');
                        matrix[aLi3[j] - 1][posj3[j]][3].innerHTML = `${caracteres[random(0, caracteres.length)]}`;
        
                

                    if (temporizadorI3[j] > numLin3   && aLf3[j] === 0) {
                    
                            matrix[aLi3[j]][posj3[j]][3].setAttribute('class', 'numNeutroDev');
                            matrix[aLi3[j]][posj3[j]][3].innerHTML = `${caracteres[random(0, caracteres.length)]}`;


                    } else {
                    
                            matrix[aLi3[j]][posj3[j]][3].setAttribute('class', 'numBrilhaDev');
                            matrix[aLi3[j]][posj3[j]][3].innerHTML = `${mensagem1[posj3[j]]}`;
        
            
                    }
                }
            }  

            temporizadorI3[j] += 1;

            if (temporizadorI3[j] <= numLin3  ) {
                aLi3[j] += 1;
            };

            if (temporizadorI3[j] >= comprimento3[j] && aLf3[j] < numLin3-1) {

                matrix[aLf3[j]][posj3[j]][3].setAttribute('class', 'numOff');

                temporizadorF3[j] += 1;

                if (temporizadorF3[j] > (numLin/2) * 5) {
                    
        
                    clearInterval(tempAnima3);

        

                    var recebe = document.getElementById("chuvaDev2");
                    recebe.style.marginTop = `${realocaChuvasTxt(altura,largura)}px`;
                    recebe = document.getElementById("chuvaDev3");
                    recebe.style.marginTop = `${realocaChuvasTxt(altura,largura)}px`;
                        

 

                    resolve(true);

                    break;
                 
    
                }
            

                if (temporizadorF3[j] < numLin3 -1) {
                    aLf3[j] += 1;
                }

            }

        }

    });

};

function start3() {
    for (var i = 0; i <= numCol; i++) {
        aLi3[i] = 0;
        aLf3[i] = 0;
        temporizadorI3[i] = 0;
        temporizadorF3[i] = 0;
    }
    tempAnima3 = setInterval(async () => await anima3(), 80);  
}

function centralizaNome() {
    var elemento = document.getElementById('chuvaDev3');
    elemento.style.marginLeft = '10px'; 
  }


export default theMatrixDev;
