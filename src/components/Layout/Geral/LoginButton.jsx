import React from 'react';
import { Link } from 'react-router-dom';
import './loginButton.css'; // Importa o CSS do botão


const LoginButton = () => {
  const idGoogleCap = JSON.parse(localStorage.getItem('idGoogleCap'));

  if (idGoogleCap) {
    return null; // Não exibe o botão se idGoogleCap for true
  }

  return (
    <button className='loginButton'>
      <img className='imgLoginButton' src="https://firebasestorage.googleapis.com/v0/b/teste-aa015.appspot.com/o/imagens%2Fthemes%2Fcyberpink%2Fviolet%2Ffoguete.png?alt=media&token=19c205b6-b36f-49df-b336-4afc6565c9a5" alt="Login Icon" />
      <Link className='txtLoginButton' to="/"> LOGIN </Link>
    </button>
  );
};

export default LoginButton;
