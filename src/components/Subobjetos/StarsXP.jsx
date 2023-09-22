import './subobjetos.css';

function StarsXP({xp,Style}){

    if(Style==='Design'){
 switch (xp) {

      case '1':
        return(
            <div>
                <img className='starXP' src='./design/star.png' alt="imagem"/> 
            </div>


        )

      case '2':
        return(
            <div>
                <img className='starXP' src='./design/star.png' alt="imagem"/>
                <img className='starXP' src='./design/star.png' alt="imagem"/> 
            </div>

            )

    
      case '3':
        return(
            
            <div>
                <img className='starXP' src='./design/star.png' alt="imagem"/>
                <img className='starXP' src='./design/star.png' alt="imagem"/> 
                <img className='starXP' src='./design/star.png' alt="imagem"/> 
            </div>        
            )

      case '4':
        return(
            <div>
                <img className='starXP' src='./design/star.png' alt="imagem"/>
                <img className='starXP' src='./design/star.png' alt="imagem"/> 
                <img className='starXP' src='./design/star.png' alt="imagem"/> 
                <img className='starXP' src='./design/star.png' alt="imagem"/> 
            </div>   
            
            )

        
      case '5':
        return(
            <div>
                <img className='starXP' src='./design/star.png' alt="imagem"/>
                <img className='starXP' src='./design/star.png' alt="imagem"/> 
                <img className='starXP' src='./design/star.png' alt="imagem"/> 
                <img className='starXP' src='./design/star.png' alt="imagem"/> 
                <img className='starXP' src='./design/star.png' alt="imagem"/> 
            </div>   
            
            )

    
      default:
       
    }

    }

    if(Style==='Dev'){
        switch (xp) {
       
             case '1':
               return(
                   <div>
                       <img className='starXP' src='./dev/star.png' alt="imagem"/> 
                   </div>
       
       
               )
       
             case '2':
               return(
                   <div>
                       <img className='starXP' src='./dev/star.png' alt="imagem"/>
                       <img className='starXP' src='./dev/star.png' alt="imagem"/> 
                   </div>
       
                   )
       
           
             case '3':
               return(
                   
                   <div>
                       <img className='starXP' src='./dev/star.png' alt="imagem"/>
                       <img className='starXP' src='./dev/star.png' alt="imagem"/> 
                       <img className='starXP' src='./dev/star.png' alt="imagem"/> 
                   </div>        
                   )
       
             case '4':
               return(
                   <div>
                       <img className='starXP' src='./dev/star.png' alt="imagem"/>
                       <img className='starXP' src='./dev/star.png' alt="imagem"/> 
                       <img className='starXP' src='./dev/star.png' alt="imagem"/> 
                       <img className='starXP' src='./dev/star.png' alt="imagem"/> 
                   </div>   
                   
                   )
       
               
             case '5':
               return(
                   <div>
                       <img className='starXP' src='./dev/star.png' alt="imagem"/>
                       <img className='starXP' src='./dev/star.png' alt="imagem"/> 
                       <img className='starXP' src='./dev/star.png' alt="imagem"/> 
                       <img className='starXP' src='./dev/star.png' alt="imagem"/> 
                       <img className='starXP' src='./dev/star.png' alt="imagem"/> 
                   </div>   
                   
                   )
       
           
             default:
              
           }
       
           }
    

   
    
}

export default StarsXP;