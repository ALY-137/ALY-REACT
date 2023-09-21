import './containersDesign.css';
import '../containers.css';

import EstiloContainerTop from './EstiloContainerTop';
import EstiloContainerBot from './EstiloContainerBot';
import FerramentasDesign from '../../Subcontainers/Design/FerramentasDesign';


function HabilidadesDesign(){


        return(

            <div className="containerDesign" >
    
            <EstiloContainerTop tituloDesign='HABILIDADES' icon='./design/habilidadesDesign.png'/>
            

            <FerramentasDesign />                
                                   
            

            <EstiloContainerBot />
    
    
    
            </div>
    
            )

    }


export default HabilidadesDesign;