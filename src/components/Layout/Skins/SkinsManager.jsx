import React, { useState, useEffect } from 'react';
import { verificarESalvarskins } from '../../Banco/verificaSkins';
import { db } from '../../Banco/init-firebase';
import { idGoogleCap } from "../../../App";
import { useNavigate } from 'react-router-dom';

let skinLogado ;
  

const SkinsManager = () => {
  const [theme, setTheme] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSkin, setSelectedSkin] = useState('');
  const navigate = useNavigate();

  const [skins, setSkins] = useState([]);
  const [username, setUsername] = useState('');
  const [SkinSelecionada, setSkinSelecionada] = useState(false);
  

  const handleLogin = () => {  // Ao ser selecionado a skin na primeira navegação na pagina de origem define variável como true. Essa função é chamada dentro de uma função assíncrona.
    localStorage.setItem('skinLogado', true);
  };

 skinLogado = localStorage.getItem('skinLogado'); // 


  const generateCreativeUsername = () => {
    const baseName = 'User';
    const randomNum = Math.floor(Math.random() * 10000);
    return `${baseName}${randomNum}`;
  };

  const fetchSkins = async () => {
    try {
      const userRef = db.collection('users').doc(idGoogleCap);
      const skinsSnapshot = await userRef.collection('skins').get();
      const skinsList = skinsSnapshot.docs.map((doc) => doc.data());
      setSkins(skinsList);

      if (skinsList.length === 0) {
        const creativeUsername = generateCreativeUsername();
        setUsername(creativeUsername);
        await handleCreateDefaultSkin(creativeUsername);
      } else {
        setIsLoading(false); // Skins fetched successfully
      }
    } catch (error) {
      console.error('Erro ao buscar skins:', error);
      setIsLoading(false); // End loading state even if there's an error
    }
  };

  const handleCreateDefaultSkin = async (username) => {
    try {
      const theme = 'CYBERPINK';
      await verificarESalvarskins(idGoogleCap, username, theme);
      setSkinSelecionada(true);
      navigate(`/${username}/home`);
    } catch (error) {
      console.error('Erro ao criar skin padrão:', error);
    }
  };

  useEffect(() => {
    if (idGoogleCap) {
      fetchSkins();
    }
  }, [idGoogleCap]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsLoading(true);
    try {
      const skinsExists = await verificarESalvarskins(idGoogleCap, username, theme);
      if (!skinsExists) {
        console.log('Skin criada com sucesso');
        await fetchSkins();
        setUsername('');
        setTheme('');
        setSkinSelecionada(true);
        navigate(`/${username}/home`);
       
      } else {
        console.log('O nome de usuário da skin já existe.');
      }
    } catch (error) {
      console.error('Erro ao criar skin:', error);
      setIsLoading(false); // End loading state even if there's an error
    }
  };

  const handleClick = async (username) => {
    if (selectedSkin === username) return;
  
    // Atualizando o estado antes de navegar
    setSelectedSkin(username);
    setUsername(username);
    setSkinSelecionada(true);
  
    // Salvando a skin selecionada no localStorage
    localStorage.setItem('skinLocal', username);
    handleLogin();
  
    // Navegando para a nova página com o username como parâmetro
    navigate(`/${username}/home`);
  };

  

  return (
    <div className="skins-manager">
      {isLoading ? (
        <p>Carregando...</p>
      ) : (
        <div className="skins-container">
          <h2>Suas skins</h2>
          <ul className="skins-list">
            {skins.map((skinItem) => (
              <li
                key={skinItem.username}
                onClick={() => handleClick(skinItem.username)}
                className={selectedSkin === skinItem.username ? 'selected' : ''}
              >
                {skinItem.username} - {skinItem.theme || 'Sem tema'}
              </li>
            ))}
          </ul>
          {skinLogado && (
            <form onSubmit={handleSubmit} className="skins-form">
              <h2>Cadastrar Nova Skin</h2>
              <input
                type="text"
                placeholder="Nome da skin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
              <input
                type="text"
                placeholder="Tema da skin"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                required
              />
              <button type="submit">Cadastrar</button>
            </form>
          )}
        </div>
      )}
    </div>
  );
};

export default SkinsManager;
