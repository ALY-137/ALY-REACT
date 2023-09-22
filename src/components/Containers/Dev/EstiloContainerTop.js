

function EstiloContainerTop({tituloDev,icon}){

    return (
        <div>
            
            <img className='canto0' src='/dev/canto.png' alt="imagem" />  
            
            <div className='topMidDev'>
                
                <img className='cantoHead0' src='/dev/cantoHeadTop.png' alt="imagem"  /> 
                <img className='cantoHead3' src='/dev/cantoHeadTop.png'  alt="imagem" /> 
                <img className='cantoHead1' src='/dev/cantoHead.png'  alt="imagem" /> 
                <img className='cantoHead2' src='/dev/cantoHead.png'  alt="imagem" /> 

                <img className='iconePai' src={icon} alt="imagem" />
                <p className='tituloDev'>{tituloDev}</p>

                

    

            </div>          
        
            <img className='canto3' src='/dev/canto.png' alt="imagem"  /> 
        </div>

    )
}

export default EstiloContainerTop;