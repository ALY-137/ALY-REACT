function EstiloContainerTop({tituloDesign,icon}){

    return (
        <div>
            
            <img className='canto0' src='./design/canto.png' alt="imagem" />  
            
            <div className='topMidDesign'>
                
                <img className='cantoHead0' src='./design/cantoHeadTop.png' alt="imagem"   /> 
                <img className='cantoHead3' src='./design/cantoHeadTop.png' alt="imagem"   /> 
                <img className='cantoHead1' src='./design/cantoHead.png'  alt="imagem"  /> 
                <img className='cantoHead2' src='./design/cantoHead.png' alt="imagem"   /> 

                <img className='iconePai' src={icon} alt="imagem"/>
                <p className='tituloDesign'>{tituloDesign}</p>

                

    

            </div>          
        
            <img className='canto3' src='/design/canto.png' alt="imagem"   /> 
        </div>

    )
}

export default EstiloContainerTop;