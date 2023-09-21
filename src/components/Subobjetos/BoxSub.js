import './subobjetos.css';

import StarsXP from './StarsXP';

function BoxSub({nome,icon,xp,styleBox,style,xpBoxSub}){
    return(
        <div className={styleBox}>
            <div className='infosBoxSub'>
                <p className='txtBoxSub'>{nome}</p>
                <img className='imgBoxSub' src={icon}/>
            </div>
            
            <div className={xpBoxSub}> 
                <StarsXP xp={xp} style={style}/>
            </div>
            
        </div>

    )

}

export default BoxSub;