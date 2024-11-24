// Componente criado para testar funcionalidades antes de disponinilizalas para usuaries.


export function seforAdm(){
    const idGoogleCap = localStorage.getItem('idGoogleCap');

    if(idGoogleCap==='113891358948396359936'||idGoogleCap==='115208049202259240227'){
        return true;
    }else{
        return false;
    }
    
}