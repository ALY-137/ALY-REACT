function Menu(){

    function closeMenu(){

        var Menu = document.getElementById('Menu');
        Menu.style.display  = 'none';

    }

   

    return(

        <div>
            <div id="Menu">

                <div className="closeMenu" onClick={closeMenu}> × </div>

                <div className='gaveta'> MENSAGENS </div>

                <div className='gaveta'> LOGOUT </div>

            </div>
       
        </div>

        

    )
}

export default Menu;