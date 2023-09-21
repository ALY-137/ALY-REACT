function PropCard(idcard){

    const larSreen = window.innerWidth;

    if(larSreen>=350){
        var largura = 350-75;
        var altura = (largura *1.618);

        var card = document.getElementById(`${idcard}`);
        card.style.width = `${largura}px`;
        card.style.height = `${altura}px`;

    }else{
        var largura = larSreen-82;
        var altura = (largura *1.618);

        var card = document.getElementById(`${idcard}`);
        card.style.width = `${largura}px`;
        card.style.height = `${altura}px`;

    }

}

export default PropCard;