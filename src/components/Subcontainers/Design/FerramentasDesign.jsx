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
            <img className='canto0SubTit' src='/design/cantoSubcontainer.png' alt="imagem" />  
                 
                <p className='tituloTxt'>
                    FERRAMENTAS
                </p>  
                <img className='canto3SubTit' src='/design/cantoSubcontainer.png' alt="imagem"  /> 
                <Faixa />
                <Faixa />
                <Faixa />
  
        
                <img className='canto3SubTit' src='/design/cantoSubcontainer.png' alt="imagem"  /> 
                                                                             
            </div>
        <div className='contentSubcontainersDesign'>

        <EstiloSubcontainerTop />   
            <motion.div  ref={carousel} className='carrosselDesign' whileTap={{cursor:"grabbing"}}>
                
                <motion.div  drag='x' className='inner' dragConstraints={{right: +width, left:-width}}>
                  
                    <BoxSub xp='4' nome='INDESIGN' icon='./design/in.png' styleBox='boxSubDesign' Style='Design' xpBoxSub='xpBoxSubDesign'/>  
                    <BoxSub xp='5' nome='PHOTOSHOP' icon='./design/ps.png' styleBox='boxSubDesign' Style='Design' xpBoxSub='xpBoxSubDesign'/>
                    <BoxSub xp='5' nome='ILLUSTRATOR' icon='./design/ai.png' styleBox='boxSubDesign' Style='Design' xpBoxSub='xpBoxSubDesign'/>
                    <BoxSub xp='4' nome='FIGMA' icon='./design/fi.png' styleBox='boxSubDesign' Style='Design' xpBoxSub='xpBoxSubDesign'/>

                </motion.div>


            </motion.div>
            
            <EstiloSubcontainerBot />   
        </div>
        </div>


    )


}

export default FerramentasDesign;