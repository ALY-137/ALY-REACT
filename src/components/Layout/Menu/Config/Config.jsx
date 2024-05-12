import React, { useState } from 'react';

const Config = ({ addNewRoute }) => {
  const [newRouteName, setNewRouteName] = useState('');

  const handleAddNewRoute = () => {
    if (newRouteName.trim() !== '') {
      const newRoute = {
        path: `/${newRouteName.toLowerCase().replace(/\s+/g, '-')}`,
        name: newRouteName,
        component: NewRouteComponent, // Substitua NewRouteComponent pelo seu componente real
      };
      addNewRoute(newRoute);
      setNewRouteName('');
    }
  };

  return (
    <div>
      <input type="text" value={newRouteName} onChange={(e) => setNewRouteName(e.target.value)} placeholder="New Route Name" />
      <button onClick={handleAddNewRoute}>Add New Route</button>
    </div>
  );
};

const NewRouteComponent = () => <h2>New Route Component</h2>; // Substitua por seu componente real

export default Config;