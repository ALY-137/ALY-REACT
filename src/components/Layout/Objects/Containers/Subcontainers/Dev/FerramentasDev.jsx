import './subcontainersDev.css';
import '../subcontainers.css';
import EstiloSubcontainerTop from './EstiloSubcontainerTop';
import EstiloSubcontainerBot from './EstiloSubcontainerBot';
import Faixa from './Faixa';

import BoxSub from '../../../Objetos/Subobjetos/BoxSub';

import {motion} from 'framer-motion';

import {useState, useEffect, useRef} from 'react';

function FerramentasDev(){

    const carousel = useRef();
    const [width,setWidth] = useState(0);

    useEffect(
        ()=>{

            setWidth(carousel.current?.scrollWidth - carousel.current?.offsetWidth)

        },[])

    return(

        <div className="boxSubcontainersDev">
            <div className="tituloSubcontainersDev">
            <img className='canto0SubTit' src='/dev/cantoSubcontainer.png' alt="imagem" />  
                 
        
         

                <p className='tituloTxt'>
                    FERRAMENTAS
                </p>  
                <img className='canto3SubTit' src='/dev/cantoSubcontainer.png' alt="imagem"  /> 
                <Faixa />
                <Faixa />
                <Faixa />
           
          
   
                <img className='canto3SubTit' src='/dev/cantoSubcontainer.png' alt="imagem"  /> 
     

                                                                               
            </div>
        <div className='contentSubcontainersDev'>

        <EstiloSubcontainerTop />   
            <motion.div  ref={carousel} className='carrosselDev' whileTap={{cursor:"grabbing"}}>

                <motion.div  drag='x' className='inner' dragConstraints={{right: +width, left:-width}}>
                    
                    <BoxSub xp='5' nome='REACT JS' icon='./dev/react.png' styleBox='boxSubDev' Style='Dev' xpBoxSub='xpBoxSubDev'/>
                    <BoxSub xp='5' nome='VS CODE' icon='./dev/vscode.png' styleBox='boxSubDev' Style='Dev' xpBoxSub='xpBoxSubDev'/>
                    <BoxSub xp='5' nome='GITHUB' icon='./dev/git.png' styleBox='boxSubDev' Style='Dev' xpBoxSub='xpBoxSubDev'/>
                    <BoxSub xp='2' nome='NODE JS' icon='./dev/node.png' styleBox='boxSubDev' Style='Dev' xpBoxSub='xpBoxSubDev'/>

                </motion.div>


            </motion.div>
            
            <EstiloSubcontainerBot />   
        </div>
        </div>


    )


}

export default FerramentasDev;