import React from 'react';
import { Link } from 'react-router-dom';

const LoginButton = () => {
  const idGoogleCap = JSON.parse(localStorage.getItem('idGoogleCap'));

  if (idGoogleCap) {
    return null; // Não exibe o botão se idGoogleCap for true
  }

  return (
    <button>
      <Link to="/"> LOGIN </Link>
    </button>
  );
};

export default LoginButton;
