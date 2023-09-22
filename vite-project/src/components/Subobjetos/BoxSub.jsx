import './subobjetos.css';

import StarsXP from './StarsXP';

function BoxSub({nome,icon,xp,styleBox,Style,xpBoxSub}){
    return(
        <div className={styleBox}>
            <div className='infosBoxSub'>
                <p className='txtBoxSub'>{nome}</p>
                <img className='imgBoxSub' src={icon} alt="imagem"/>
            </div>
            
            <div className={xpBoxSub}> 
                <StarsXP xp={xp} Style={Style}/>
            </div>
            
        </div>

    )

}

export default BoxSub;