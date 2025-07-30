import React, { useState, useEffect } from 'react';
import { verificarESalvarskins } from '../../Banco/verificaSkins';
import { db } from '../../Banco/init-firebase';
import { idGoogleCap } from "../../../App";
import { useNavigate } from 'react-router-dom';
import { seforAdm } from '../../Scripts/verificações/verificaAdm';
import { buscarSkinLogada } from './buscaSkinLogada';


  

const SkinsManager = () => {
  const [theme, setTheme] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSkin, setSelectedSkin] = useState('');
  const navigate = useNavigate();

  const [skins, setSkins] = useState([]);
  const [username, setUsername] = useState('');
  const [SkinSelecionada, setSkinSelecionada] = useState(false);

  const [skinLogado, setSkinLogado] = useState(localStorage.getItem('skinLogado') === 'true');
  const [trigger, setTrigger] = useState(0);

  // Verifica se o usuário está logado ou se skin foi trocada então busca as skins
  // É Usado uma trigger pra quando for trocada a skin(quando uma skin é excluida, por exemplo é carregado lista de skins novamente
useEffect(() => {
  if (idGoogleCap || skinLogado || trigger){
    fetchSkins();
    
}}, [idGoogleCap , skinLogado , trigger]);


  // Função para buscar skins do usuário
  const fetchSkins = async () => {
    try {
      const idGoogleCapAqui = localStorage.getItem('idGoogleCap'); 
      const userRef = db.collection('users').doc(idGoogleCapAqui);
      const skinsSnapshot = await userRef.collection('skins').get();
      const skinsList = skinsSnapshot.docs.map((doc) => doc.data());
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

      console.log(idGoogleCap +"aqui");
      setIsLoading(false); 
    }
  };

  // Função para gerar username para skin
  const generateCreativeUsername = () => {
    const baseName = 'User';
    const randomNum = Math.floor(Math.random() * 10000);
    return `${baseName}${randomNum}`;
  };


  const handleCreateDefaultSkin = async (username) => {
  try {
    const theme = 'CYBERPINK';
    await verificarESalvarskins(idGoogleCap, username, theme);
    setSkinSelecionada(true);

    localStorage.setItem('skinLocal', username);
    localStorage.setItem('skinLogadoUser', username);

    setIsLoading(false); // <-- importante

    if (seforAdm(idGoogleCap)) {
      navigate(`/${username}/home`);
    } else {
      navigate(`/savannaoliveira/home`);
    }
  } catch (error) {
    console.error('Erro ao criar skin padrão:', error);
    setIsLoading(false); // <- para garantir
  }
};



const handleLogin = () => {
  localStorage.setItem('skinLogado', true);
  setSkinLogado(true); // <-- Adicionado
  setIsLoading(true);
};



useEffect(() => {
  const verificarSkinLogada = () => {
    const logado = localStorage.getItem('skinLogado') === 'true';
    setSkinLogado(logado);


  };

  verificarSkinLogada();

  // Opcional: escutar alterações no localStorage (para mudanças externas)
  window.addEventListener('storage', verificarSkinLogada);

  return () => {
    window.removeEventListener('storage', verificarSkinLogada);
  };
}, []);








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

    // Salvando skin locagada.
    localStorage.setItem('skinLogadoUser', username);
    handleLogin();
    
  
    // Navegando para a nova página com o username como parâmetro
    navigate(`/${username}/home`);
  };


const handleDeleteSkin = async (username) => {
  const confirm = window.confirm(`Deseja excluir a skin "${username}" e todos os seus dados?`);
  if (!confirm) return;

  try {
    const idGoogleCapAqui = localStorage.getItem('idGoogleCap');
    const skinsRef = db.collection('users').doc(idGoogleCapAqui).collection('skins');

    // Procura o documento com o campo 'username' igual ao username fornecido
    const querySnapshot = await skinsRef.where('username', '==', username).get();

    if (querySnapshot.empty) {
      console.warn(`Nenhuma skin encontrada com username "${username}".`);
      return;
    }

    const doc = querySnapshot.docs[0]; // Assumindo que username é único
    const skinRef = doc.ref;

    const subcolecoes = ['paginas', 'containers', 'cards'];

    // Deleta os documentos de cada subcoleção
    for (const nomeSub of subcolecoes) {
      const subSnap = await skinRef.collection(nomeSub).get();
      const deletePromises = subSnap.docs.map((doc) => doc.ref.delete());
      await Promise.all(deletePromises);
    }

    // Deleta o documento da skin
    await skinRef.delete();

    // Atualiza a lista
    setTrigger(prev => prev + 1);
    console.log(`Skin "${username}" excluída com sucesso.`);
  } catch (error) {
    console.error(`Erro ao excluir a skin "${username}":`, error);
  }
};
  useEffect(() => {
    const carregarSkinLogada = async () => {
      const skin = await buscarSkinLogada();
      if (skin) {
        console.log('Skin logada:', skin);
      }
    };

    carregarSkinLogada();
  }, []); 


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
                  <span onClick={() => handleClick(skinItem.username)} style={{ cursor: 'pointer' }}>
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
