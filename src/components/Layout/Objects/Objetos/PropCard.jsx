function PropCard(idcard){

    const larSreen = window.innerWidth;
    var largura, altura, card;

    if(larSreen>=350){
        largura = 350-75;
        altura = (largura *1.618);

        card = document.getElementById(`${idcard}`);
        card.style.width = `${largura}px`;
        card.style.height = `${altura}px`;

    }else{
        largura = larSreen-82;
        altura = (largura *1.618);

        card = document.getElementById(`${idcard}`);
        card.style.width = `${largura}px`;
        card.style.height = `${altura}px`;

    }

}

export default PropCard;