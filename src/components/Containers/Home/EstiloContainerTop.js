

function EstiloContainerTop({tituloHome,icon}){

    return (
        <div>
            
            <img className='canto0' src='/home/canto.png'  />  
            
            <div className='topMid'>
                
                <img className='cantoHead0' src='/home/cantoHeadTop.png'   /> 
                <img className='cantoHead3' src='/home/cantoHeadTop.png'   /> 
                <img className='cantoHead1' src='/home/cantoHead.png'   /> 
                <img className='cantoHead2' src='/home/cantoHead.png'   /> 

                <img className='iconePai' src={icon} />
                <p className='tituloHome'>{tituloHome}</p>

                

    

            </div>          
        
            <img className='canto3' src='/home/canto.png'   /> 
        </div>

    )
}

export default EstiloContainerTop;