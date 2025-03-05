import React, { createContext, useState, useContext } from 'react';

const RoutesContext = createContext();

export const RoutesProvider = ({ children }) => {
  const [routes, setRoutes] = useState([]);

  return (
    <RoutesContext.Provider value={{ routes, setRoutes }}>
      {children}
    </RoutesContext.Provider>
  );
};

export const useRoutesContext = () => useContext(RoutesContext);
