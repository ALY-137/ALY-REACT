

function EstiloContainerTop({tituloDesign,icon}){

    return (
        <div>
            
            <img className='canto0' src='/design/canto.png'  />  
            
            <div className='topMidDesign'>
                
                <img className='cantoHead0' src='/design/cantoHeadTop.png'   /> 
                <img className='cantoHead3' src='/design/cantoHeadTop.png'   /> 
                <img className='cantoHead1' src='/design/cantoHead.png'   /> 
                <img className='cantoHead2' src='/design/cantoHead.png'   /> 

                <img className='iconePai' src={icon} />
                <p className='tituloDesign'>{tituloDesign}</p>

                

    

            </div>          
        
            <img className='canto3' src='/design/canto.png'   /> 
        </div>

    )
}

export default EstiloContainerTop;