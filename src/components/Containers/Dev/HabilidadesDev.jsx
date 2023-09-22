import './containersDev.css';
import '../containers.css';

import EstiloContainerTop from './EstiloContainerTop';
import EstiloContainerBot from './EstiloContainerBot';
import FerramentasDev from '../../Subcontainers/Dev/FerramentasDev';
import LinguagensDev from '../../Subcontainers/Dev/LinguagensDev';

function HabilidadesDev(){


        return(

            <div className="containerDev" >
    
            <EstiloContainerTop tituloDev='HABILIDADES' icon='./dev/habilidades.png'/>
            
            <LinguagensDev />
            <FerramentasDev />                
                                   
            

            <EstiloContainerBot />
    
    
    
            </div>
    
            )

    }


export default HabilidadesDev;