import './subobjetos.css';

function StarsXP({xp,style}){

    if(style=='Design'){
 switch (xp) {

      case '1':
        return(
            <div>
                <img className='starXP' src='./design/star.png'/> 
            </div>


        )

      case '2':
        return(
            <div>
                <img className='starXP' src='./design/star.png'/>
                <img className='starXP' src='./design/star.png'/> 
            </div>

            )

    
      case '3':
        return(
            
            <div>
                <img className='starXP' src='./design/star.png'/>
                <img className='starXP' src='./design/star.png'/> 
                <img className='starXP' src='./design/star.png'/> 
            </div>        
            )

      case '4':
        return(
            <div>
                <img className='starXP' src='./design/star.png'/>
                <img className='starXP' src='./design/star.png'/> 
                <img className='starXP' src='./design/star.png'/> 
                <img className='starXP' src='./design/star.png'/> 
            </div>   
            
            )

        
      case '5':
        return(
            <div>
                <img className='starXP' src='./design/star.png'/>
                <img className='starXP' src='./design/star.png'/> 
                <img className='starXP' src='./design/star.png'/> 
                <img className='starXP' src='./design/star.png'/> 
                <img className='starXP' src='./design/star.png'/> 
            </div>   
            
            )

    
      default:
       
    }

    }

    if(style=='Dev'){
        switch (xp) {
       
             case '1':
               return(
                   <div>
                       <img className='starXP' src='./dev/star.png'/> 
                   </div>
       
       
               )
       
             case '2':
               return(
                   <div>
                       <img className='starXP' src='./dev/star.png'/>
                       <img className='starXP' src='./dev/star.png'/> 
                   </div>
       
                   )
       
           
             case '3':
               return(
                   
                   <div>
                       <img className='starXP' src='./dev/star.png'/>
                       <img className='starXP' src='./dev/star.png'/> 
                       <img className='starXP' src='./dev/star.png'/> 
                   </div>        
                   )
       
             case '4':
               return(
                   <div>
                       <img className='starXP' src='./dev/star.png'/>
                       <img className='starXP' src='./dev/star.png'/> 
                       <img className='starXP' src='./dev/star.png'/> 
                       <img className='starXP' src='./dev/star.png'/> 
                   </div>   
                   
                   )
       
               
             case '5':
               return(
                   <div>
                       <img className='starXP' src='./dev/star.png'/>
                       <img className='starXP' src='./dev/star.png'/> 
                       <img className='starXP' src='./dev/star.png'/> 
                       <img className='starXP' src='./dev/star.png'/> 
                       <img className='starXP' src='./dev/star.png'/> 
                   </div>   
                   
                   )
       
           
             default:
              
           }
       
           }
    

   
    
}

export default StarsXP;