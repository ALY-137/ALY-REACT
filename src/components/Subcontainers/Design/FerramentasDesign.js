import './subcontainersDesign.css';
import '../subcontainers.css';
import EstiloSubcontainerTop from './EstiloSubcontainerTop';
import EstiloSubcontainerBot from './EstiloSubcontainerBot';
import Faixa from './Faixa';

import BoxSub from '../../Subobjetos/BoxSub';

import {motion} from 'framer-motion';

import {useState, useEffect, useRef} from 'react';

function FerramentasDesign(){

    const carousel = useRef();
    const [width,setWidth] = useState(0);

    useEffect(
        ()=>{

            setWidth(carousel.current?.scrollWidth - carousel.current?.offsetWidth)

        },[])

    return(

        <div className="boxSubcontainersDesign">
            <div className="tituloSubcontainersDesign">
            <img className='canto0SubTit' src='/design/cantoSubcontainer.png'  />  
                 
                <p className='tituloTxt'>
                    FERRAMENTAS
                </p>  
                <img className='canto3SubTit' src='/design/cantoSubcontainer.png'   /> 
                <Faixa />
                <Faixa />
                <Faixa />
  
        
                <img className='canto3SubTit' src='/design/cantoSubcontainer.png'   /> 
                                                                             
            </div>
        <div className='contentSubcontainersDesign'>

        <EstiloSubcontainerTop />   
            <motion.div  ref={carousel} className='carrosselDesign' whileTap={{cursor:"grabbing"}}>
                
                <motion.div  drag='x' className='inner' dragConstraints={{right: +width, left:-width}}>
                  
                    <BoxSub xp='4' nome='INDESIGN' icon='./Design/in.png' styleBox='boxSubDesign' style='Design' xpBoxSub='xpBoxSubDesign'/>  
                    <BoxSub xp='5' nome='PHOTOSHOP' icon='./Design/ps.png' styleBox='boxSubDesign' style='Design' xpBoxSub='xpBoxSubDesign'/>
                    <BoxSub xp='5' nome='ILLUSTRATOR' icon='./Design/ai.png' styleBox='boxSubDesign' style='Design' xpBoxSub='xpBoxSubDesign'/>
                    <BoxSub xp='4' nome='FIGMA' icon='./Design/fi.png' styleBox='boxSubDesign' style='Design' xpBoxSub='xpBoxSubDesign'/>

                </motion.div>


            </motion.div>
            
            <EstiloSubcontainerBot />   
        </div>
        </div>


    )


}

export default FerramentasDesign;