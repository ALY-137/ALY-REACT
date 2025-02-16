// context/UserContext.js
import React, { createContext, useState, useContext } from 'react';

// Cria o contexto
const UserContext = createContext();

// Criar um provedor de contexto
export const UserProvider = ({ children }) => {
  const [usernameGlobal, setUsernameGlobal] = useState(false);  // Definindo a variável global 'username'
  const [userLogado, setUserLogado] = useState('false'); 
  return (
    <UserContext.Provider value={{ usernameGlobal, setUsernameGlobal ,userLogado, setUserLogado }}>
      {children}
    </UserContext.Provider>
  );
};

// Função para usar o contexto em outros componentes
export const useUser = () => useContext(UserContext);