import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { verificarESalvarskins } from '../../Banco/verificaSkins';
import { seforAdm } from '../../Scripts/verificações/verificaAdm';
import { buscarSkinLogada } from './buscarSkinLogada';
import {
  collection,
  doc,
  getDocs,
  query,
  where,
  deleteDoc,
  updateDoc,
  arrayRemove
} from 'firebase/firestore';
import { db } from '../../Banco/init-firebase.js';

const SkinsManager = () => {
  const [theme, setTheme] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSkin, setSelectedSkin] = useState('');
  const [skins, setSkins] = useState([]);
  const [username, setUsername] = useState('');
  const [SkinSelecionada, setSkinSelecionada] = useState(false);
  const [skinLogado, setSkinLogado] = useState(localStorage.getItem('skinLogado') === 'true');
  const [trigger, setTrigger] = useState(0);

  const navigate = useNavigate();

  // Verifica se o usuário está logado ou se skin foi trocada então busca as skins
  useEffect(() => {
    if (skinLogado || trigger) {
      fetchSkins();
    }
  }, [skinLogado, trigger]);

  // Busca skins do usuário
  const fetchSkins = async () => {
    try {
      const idGoogleCap = localStorage.getItem('idGoogleCap');
      const skinsCol = collection(db, 'users', idGoogleCap, 'skins');
      const skinsSnapshot = await getDocs(skinsCol);

      const skinsList = skinsSnapshot.docs.map(doc => doc.data());
      setSkins(skinsList);

      if (skinsList.length === 0) {
        const creativeUsername = generateCreativeUsername();
        setUsername(creativeUsername);
        await handleCreateDefaultSkin(creativeUsername);
      } else {
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Erro ao buscar skins:', error);
      setIsLoading(false);
    }
  };

  const generateCreativeUsername = () => {
    const baseName = 'User';
    const randomNum = Math.floor(Math.random() * 10000);
    return `${baseName}${randomNum}`;
  };

  const handleCreateDefaultSkin = async (username) => {
    try {
      const idGoogleCap = localStorage.getItem('idGoogleCap');
      const theme = 'CYBERPINK';
      await verificarESalvarskins(idGoogleCap, username, theme);

      setSkinSelecionada(true);
      localStorage.setItem('skinLocal', username);
      localStorage.setItem('skinLogadoUser', username);
      setIsLoading(false);

      if (seforAdm(idGoogleCap)) {
        navigate(`/${username}/home`);
      } else {
        navigate(`/savannaoliveira/home`);
      }
    } catch (error) {
      console.error('Erro ao criar skin padrão:', error);
      setIsLoading(false);
    }
  };

  const handleLogin = () => {
    localStorage.setItem('skinLogado', true);
    setSkinLogado(true);
    setIsLoading(true);
  };

  // Escuta alterações no localStorage
  useEffect(() => {
    const verificarSkinLogada = () => {
      const logado = localStorage.getItem('skinLogado') === 'true';
      setSkinLogado(logado);
    };

    verificarSkinLogada();
    window.addEventListener('storage', verificarSkinLogada);

    return () => {
      window.removeEventListener('storage', verificarSkinLogada);
    };
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsLoading(true);

    try {
      const idGoogleCap = localStorage.getItem('idGoogleCap');
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
      setIsLoading(false);
    }
  };

  const handleClick = async (username) => {
    if (selectedSkin === username) return;

    setSelectedSkin(username);
    setUsername(username);
    setSkinSelecionada(true);

    localStorage.setItem('skinLocal', username);
    localStorage.setItem('skinLogadoUser', username);
    handleLogin();

    const skin = await buscarSkinLogada();
    if (skin) console.log('Skin logada:', skin);

    navigate(`/${username}/home`);
  };

  const handleDeleteSkin = async (username) => {
    const confirmar = window.confirm(`Deseja excluir a skin "${username}"?`);
    if (!confirmar) return;

    try {
      const idGoogleCap = localStorage.getItem('idGoogleCap');
      const skinsCol = collection(db, 'users', idGoogleCap, 'skins');
      const q = query(skinsCol, where('username', '==', username));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        console.warn(`Nenhuma skin encontrada com username "${username}".`);
        return;
      }

      const skinDoc = querySnapshot.docs[0];
      const skinRef = doc(db, 'users', idGoogleCap, 'skins', skinDoc.id);

      // remover skin do registro das paginas_relacionadas
      const paginasCol = collection(db, 'users', idGoogleCap, 'paginas');
      const paginasSnap = await getDocs(paginasCol);

      for (const pagina of paginasSnap.docs) {
        const paginaRef = doc(db, 'users', idGoogleCap, 'paginas', pagina.id);
        await updateDoc(paginaRef, {
          skins_relacionadas: arrayRemove(skinDoc.id)
        });
      }

      // deletar apenas a SKIN
      await deleteDoc(skinRef);

      // atualizar lista
      setTrigger(prev => prev + 1);
      console.log(`Skin "${username}" excluída com sucesso.`);
    } catch (error) {
      console.error(`Erro ao excluir skin "${username}":`, error);
    }
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
                className={selectedSkin === skinItem.username ? 'selected' : ''}
              >
                <span
                  onClick={() => handleClick(skinItem.username)}
                  style={{ cursor: 'pointer' }}
                >
                  {skinItem.username} - {skinItem.theme || 'Sem tema'}
                </span>
                <button
                  onClick={() => handleDeleteSkin(skinItem.username)}
                  style={{ marginLeft: '10px', color: 'red' }}
                >
                  Excluir
                </button>
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
