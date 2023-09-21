

function EstiloContainerTop({tituloDev,icon}){

    return (
        <div>
            
            <img className='canto0' src='/dev/canto.png'  />  
            
            <div className='topMidDev'>
                
                <img className='cantoHead0' src='/dev/cantoHeadTop.png'   /> 
                <img className='cantoHead3' src='/dev/cantoHeadTop.png'   /> 
                <img className='cantoHead1' src='/dev/cantoHead.png'   /> 
                <img className='cantoHead2' src='/dev/cantoHead.png'   /> 

                <img className='iconePai' src={icon} />
                <p className='tituloDev'>{tituloDev}</p>

                

    

            </div>          
        
            <img className='canto3' src='/dev/canto.png'   /> 
        </div>

    )
}

export default EstiloContainerTop;