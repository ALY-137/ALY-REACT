import './subcontainersDev.css';
import '../subcontainers.css';
import EstiloSubcontainerTop from './EstiloSubcontainerTop';
import EstiloSubcontainerBot from './EstiloSubcontainerBot';
import Faixa from './Faixa';

import BoxSub from '../../Subobjetos/BoxSub';

import {motion} from 'framer-motion';

import {useState, useEffect, useRef} from 'react';

function LinguagensDev(){

    const carousel = useRef();
    const [width,setWidth] = useState(0);

    useEffect(
        ()=>{

            setWidth(carousel.current?.scrollWidth - carousel.current?.offsetWidth)

        },[])

    return(

        <div className="boxSubcontainersDev">
            <div className="tituloSubcontainersDev">
            <img className='canto0SubTit' src='/dev/cantoSubcontainer.png' alt="imagem"  />  
                 
        
         

                <p className='tituloTxt'>
                    LINGUAGENS
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

                    <BoxSub xp='3' nome='VISUAL BASIC' icon='./dev/vb.png' styleBox='boxSubDev' Style='Dev' xpBoxSub='xpBoxSubDev'/>
                    <BoxSub xp='2' nome='JAVA' icon='./dev/java.png' styleBox='boxSubDev' Style='Dev' xpBoxSub='xpBoxSubDev'/>
                    <BoxSub xp='4' nome='C' icon='./dev/c.png' styleBox='boxSubDev' Style='Dev' xpBoxSub='xpBoxSubDev'/>
                    <BoxSub xp='5' nome='JAVASCRIPT' icon='./dev/js.png' styleBox='boxSubDev' Style='Dev' xpBoxSub='xpBoxSubDev'/>
                    <BoxSub xp='5' nome='HTML' icon='./dev/html.png' styleBox='boxSubDev' Style='Dev' xpBoxSub='xpBoxSubDev'/>
                    <BoxSub xp='5' nome='CSS' icon='./dev/css.png' styleBox='boxSubDev' Style='Dev' xpBoxSub='xpBoxSubDev'/>

                </motion.div>


            </motion.div>
            
            <EstiloSubcontainerBot />   
        </div>
        </div>


    )


}

export default LinguagensDev;