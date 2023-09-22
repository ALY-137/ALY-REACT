

function EstiloContainerTop({tituloHome,icon}){

    return (
        <div>
            
            <img className='canto0' src='/home/canto.png' alt="imagem" />  
            
            <div className='topMid'>
                
                <img className='cantoHead0' src='/home/cantoHeadTop.png' alt="imagem"  /> 
                <img className='cantoHead3' src='/home/cantoHeadTop.png' alt="imagem"  /> 
                <img className='cantoHead1' src='/home/cantoHead.png'  alt="imagem" /> 
                <img className='cantoHead2' src='/home/cantoHead.png' alt="imagem"  /> 

                <img className='iconePai' src={icon} alt="imagem"/>
                <p className='tituloHome'>{tituloHome}</p>

                

    

            </div>          
        
            <img className='canto3' src='/home/canto.png' alt="imagem"  /> 
        </div>

    )
}

export default EstiloContainerTop;