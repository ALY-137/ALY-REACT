// Componente criado para testar funcionalidades antes de disponinilizalas para usuaries.


export function seforAdm(){
    const idGoogle = localStorage.getItem('idGoogle');

    if(idGoogle==='113891358948396359936'||idGoogle==='115208049202259240227'){
        return true;
    }else{
        return false;
    }
    
}