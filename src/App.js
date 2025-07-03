import React, { useState, useEffect } from 'react';
import { getAuth, signInWithCustomToken, onAuthStateChanged, signOut } from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';

// **IMPORTANTE:** Substitua esta URL pela URL REAL do seu backend no Koyeb.
// Certifique-se de NÃO adicionar uma barra final (/) aqui.
const FLASK_BACKEND_URL = 'https://old-owl-williammzin-cd2d4d31.koyeb.app';

// Variáveis globais (serão inicializadas no useEffect)
let app;
let auth;
let db;

function App() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [userRole, setUserRole] = useState(null);
  const [companyName, setCompanyName] = useState('');
  const [firebaseToken, setFirebaseToken] = useState(null);
  const [designTheme, setDesignTheme] = useState({});
  const [message, setMessage] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showRegisterCompanyModal, setShowRegisterCompanyModal] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showUpdateUserModal, setShowUpdateUserModal] = useState(false);
  const [showDeleteUserModal, setShowDeleteUserModal] = useState(false);
  const [showGeneratePixModal, setShowGeneratePixModal] = useState(false);
  const [showManageCompaniesModal, setShowManageCompaniesModal] = useState(false);
  const [showManageCompanyUsersModal, setShowManageCompanyUsersModal] = useState(false);
  const [showManageProductsModal, setShowManageProductsModal] = useState(false);
  const [showManageSalesModal, setShowManageSalesModal] = useState(false);

  const [newCompanyUsername, setNewCompanyUsername] = useState('');
  const [newCompanyPassword, setNewCompanyPassword] = useState('');
  const [newCompanyCompanyName, setNewCompanyCompanyName] = useState('');
  const [newCompanyDesignTheme, setNewCompanyDesignTheme] = useState('default');
  const [newCompanyMercadoPagoAccessToken, setNewCompanyMercadoPagoAccessToken] = useState(''); // Para o token MP

  const [newPixAmount, setNewPixAmount] = useState('');
  const [newPixDescription, setNewPixDescription] = useState('Pagamento do App de Caixa');
  const [pixQRCode, setPixQRCode] = useState('');
  const [pixCopyPasteKey, setPixCopyPasteKey] = useState('');
  const [pixStatus, setPixStatus] = useState('');
  const [pixPaymentId, setPixPaymentId] = useState('');

  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState(''); // Para gerenciar usuários de uma empresa específica
  const [companyUsers, setCompanyUsers] = useState([]);

  const [newUserName, setNewUserName] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState('caixa');

  const [updateUserId, setUpdateUserId] = useState('');
  const [updateUserName, setUpdateUserName] = useState('');
  const [updateUserPassword, setUpdateUserPassword] = useState('');
  const [updateUserRole, setUpdateUserRole] = '';

  const [deleteCompanyUsername, setDeleteCompanyUsername] = useState('');
  const [deleteUserId, setDeleteUserId] = useState('');

  const [products, setProducts] = useState([]);
  const [newProductName, setNewProductName] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('');
  const [newProductStock, setNewProductStock] = '';
  const [updateProductId, setUpdateProductId] = useState('');
  const [updateProductName, setUpdateProductName] = useState('');
  const [updateProductPrice, setUpdateProductPrice] = useState('');
  const [updateProductStock, setUpdateProductStock] = '';

  const [sales, setSales] = useState([]);
  const [newSaleProductId, setNewSaleProductId] = useState('');
  const [newSaleQuantity, setNewSaleQuantity] = '';
  const [newSalePaymentMethod, setNewSalePaymentMethod] = useState('Pix');
  const [newSaleTotal, setNewSaleTotal] = useState(''); // Para exibir o total da venda

  const [firebaseConfig, setFirebaseConfig] = useState(null);
  const [appId, setAppId] = useState('default-app-id'); // Valor padrão para desenvolvimento local

  // Efeito para inicializar o Firebase e o listener de autenticação
  useEffect(() => {
    // Verifica se as variáveis globais __firebase_config e __app_id estão definidas
    if (typeof __firebase_config !== 'undefined' && typeof __app_id !== 'undefined') {
      try {
        setFirebaseConfig(JSON.parse(__firebase_config));
        setAppId(__app_id);
        console.log("Firebase Config e App ID carregados do ambiente Canvas.");
      } catch (e) {
        console.error("Erro ao parsear __firebase_config:", e);
        setMessage("Erro de configuração do Firebase.");
      }
    } else {
      console.warn("Variáveis __firebase_config ou __app_id não definidas. Usando configurações padrão.");
      // Configurações de fallback para desenvolvimento local (substitua pelas suas!)
      setFirebaseConfig({
        apiKey: "YOUR_FIREBASE_API_KEY",
        authDomain: "YOUR_FIREBASE_PROJECT_ID.firebaseapp.com",
        projectId: "YOUR_FIREBASE_PROJECT_ID",
        storageBucket: "YOUR_FIREBASE_PROJECT_ID.appspot.com",
        messagingSenderId: "YOUR_FIREBASE_MESSAGING_SENDER_ID",
        appId: "YOUR_FIREBASE_APP_ID"
      });
      setAppId('local-app-id'); // Garante que o app_id seja 'local-app-id' para o desenvolvimento local
    }
  }, []);

  // Efeito para inicializar o Firebase App e o Auth após o firebaseConfig ser definido
  useEffect(() => {
    if (firebaseConfig) {
      try {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        console.log("Firebase App, Auth e Firestore inicializados.");

        // Listener de estado de autenticação do Firebase
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
          if (user) {
            console.log("Usuário autenticado no Firebase:", user.uid);
            // Tenta obter os custom claims
            const idTokenResult = await user.getIdTokenResult(true);
            const role = idTokenResult.claims.role;
            const companyId = idTokenResult.claims.company_id;

            setUserRole(role);
            setUsername(user.displayName || user.email || user.uid); // Exibe o nome do usuário
            setIsLoggedIn(true);
            setFirebaseToken(await user.getIdToken()); // Armazena o token para requisições ao backend

            // Carrega o tema de design e token MP da empresa
            if (companyId) {
              const companyDocRef = doc(db, 'artifacts', appId, 'users', companyId);
              const companyDocSnap = await getDoc(companyDocRef);
              if (companyDocSnap.exists()) {
                const companyData = companyDocSnap.data();
                setCompanyName(companyData.company_name || 'Sua Empresa');
                setDesignTheme(companyData.design_theme || 'default');
              }
            }
          } else {
            console.log("Nenhum usuário autenticado no Firebase.");
            setIsLoggedIn(false);
            setUserRole(null);
            setUsername('');
            setCompanyName('');
            setFirebaseToken(null);
            setDesignTheme({});
          }
        });

        // Tenta fazer login com o token inicial fornecido pelo Canvas (se existir)
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          signInWithCustomToken(auth, __initial_auth_token)
            .then(() => console.log("Login com token inicial bem-sucedido."))
            .catch(error => console.error("Erro ao fazer login com token inicial:", error));
        } else {
          // Se não houver token inicial, tenta login anônimo (para acesso público ou fallback)
          // Isso pode ser removido se todos os usuários DEVEM se autenticar
          signInWithCustomToken(auth, "dummy-token-for-anonymous") // Usar um token dummy para simular anonymous
            .then(() => console.log("Login anônimo simulado bem-sucedido."))
            .catch(error => console.error("Erro ao simular login anônimo:", error));
        }

        return () => unsubscribe(); // Limpeza do listener
      } catch (e) {
        console.error("Erro ao inicializar Firebase App ou Auth:", e);
        setMessage("Erro crítico na inicialização do Firebase.");
      }
    }
  }, [firebaseConfig, appId]); // Depende de firebaseConfig e appId

  // Efeitos para carregar dados do Firestore com base na role e companyId
  useEffect(() => {
    if (!db || !userRole || !isLoggedIn) return;

    let unsubscribeProducts;
    let unsubscribeSales;
    let unsubscribeCompanyUsers;
    let unsubscribeCompanies;

    const currentCompanyId = auth.currentUser?.uid; // Para company_admin, é o próprio UID
    const userClaims = auth.currentUser?.getIdTokenResult()?.then(idTokenResult => idTokenResult.claims);

    userClaims.then(claims => {
      const companyIdFromClaims = claims.company_id;

      // Carregar produtos (para company_admin, gerente, caixa)
      if (companyIdFromClaims && (userRole === 'company_admin' || userRole === 'gerente' || userRole === 'caixa')) {
        const productsRef = collection(db, 'artifacts', appId, 'users', companyIdFromClaims, 'products');
        unsubscribeProducts = onSnapshot(productsRef, (snapshot) => {
          const productsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setProducts(productsData);
          console.log("Produtos carregados:", productsData);
        }, (error) => {
          console.error("Erro ao carregar produtos:", error);
          setMessage(`Erro ao carregar produtos: ${error.message}`);
        });
      }

      // Carregar vendas (para company_admin, gerente, caixa)
      if (companyIdFromClaims && (userRole === 'company_admin' || userRole === 'gerente' || userRole === 'caixa')) {
        const salesRef = collection(db, 'artifacts', appId, 'users', companyIdFromClaims, 'sales');
        unsubscribeSales = onSnapshot(salesRef, (snapshot) => {
          const salesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setSales(salesData);
          console.log("Vendas carregadas:", salesData);
        }, (error) => {
          console.error("Erro ao carregar vendas:", error);
          setMessage(`Erro ao carregar vendas: ${error.message}`);
        });
      }

      // Carregar usuários da empresa (apenas para company_admin)
      if (userRole === 'company_admin' && currentCompanyId) {
        const companyUsersRef = collection(db, 'artifacts', appId, 'users', currentCompanyId, 'company_users');
        unsubscribeCompanyUsers = onSnapshot(companyUsersRef, (snapshot) => {
          const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setCompanyUsers(usersData);
          console.log("Usuários da empresa carregados:", usersData);
        }, (error) => {
          console.error("Erro ao carregar usuários da empresa:", error);
          setMessage(`Erro ao carregar usuários da empresa: ${error.message}`);
        });
      }

      // Carregar lista de empresas (apenas para admin principal)
      if (userRole === 'admin') {
        const companiesRef = collection(db, 'artifacts', appId, 'users');
        unsubscribeCompanies = onSnapshot(companiesRef, (snapshot) => {
          const companiesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setCompanies(companiesData);
          console.log("Lista de empresas carregada:", companiesData);
        }, (error) => {
          console.error("Erro ao carregar lista de empresas:", error);
          setMessage(`Erro ao carregar lista de empresas: ${error.message}`);
        });
      }
    });

    return () => {
      if (unsubscribeProducts) unsubscribeProducts();
      if (unsubscribeSales) unsubscribeSales();
      if (unsubscribeCompanyUsers) unsubscribeCompanyUsers();
      if (unsubscribeCompanies) unsubscribeCompanies();
    };
  }, [db, userRole, isLoggedIn, appId]);


  const handleLogin = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      const response = await fetch(`${FLASK_BACKEND_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro desconhecido no login');
      }

      const data = await response.json();
      console.log('Dados de login recebidos:', data);

      // Fazer login no Firebase com o token personalizado
      await signInWithCustomToken(auth, data.firebase_token);
      setMessage('Login bem-sucedido!');

      // Atualiza o estado com os dados recebidos do backend
      setUserRole(data.role);
      setCompanyName(data.company_name || '');
      setDesignTheme(data.design || {});
      setIsLoggedIn(true);
      setFirebaseToken(data.firebase_token);

    } catch (error) {
      console.error('Erro ao conectar ao backend para login:', error);
      setMessage(`Erro ao conectar ao backend para login: ${error.message}`);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setMessage('Logout bem-sucedido!');
      // Limpa todos os estados relacionados ao usuário
      setUsername('');
      setPassword('');
      setUserRole(null);
      setCompanyName('');
      setFirebaseToken(null);
      setDesignTheme({});
      setIsLoggedIn(false);
      setNewCompanyUsername('');
      setNewCompanyPassword('');
      setNewCompanyCompanyName('');
      setNewCompanyDesignTheme('default');
      setNewCompanyMercadoPagoAccessToken('');
      setNewPixAmount('');
      setNewPixDescription('Pagamento do App de Caixa');
      setPixQRCode('');
      setPixCopyPasteKey('');
      setPixStatus('');
      setPixPaymentId('');
      setCompanies([]);
      setSelectedCompanyId('');
      setCompanyUsers([]);
      setNewUserName('');
      setNewUserPassword('');
      setNewUserRole('caixa');
      setUpdateUserId('');
      setUpdateUserName('');
      setUpdateUserPassword('');
      setUpdateUserRole('');
      setDeleteCompanyUsername('');
      setDeleteUserId('');
      setProducts([]);
      setNewProductName('');
      setNewProductPrice('');
      setNewProductStock('');
      setUpdateProductId('');
      setUpdateProductName('');
      setUpdateProductPrice('');
      setUpdateProductStock('');
      setSales([]);
      setNewSaleProductId('');
      setNewSaleQuantity('');
      setNewSalePaymentMethod('Pix');
      setNewSaleTotal('');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      setMessage(`Erro ao fazer logout: ${error.message}`);
    }
  };


  const handleRegisterCompany = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      const response = await fetch(`${FLASK_BACKEND_URL}/register_company`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${firebaseToken}` // Envia o token do admin
        },
        body: JSON.stringify({
          username: newCompanyUsername,
          password: newCompanyPassword,
          company_name: newCompanyCompanyName,
          design_theme: newCompanyDesignTheme,
          mercado_pago_access_token: newCompanyMercadoPagoAccessToken,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro desconhecido ao registrar empresa');
      }

      const data = await response.json();
      setMessage(`Empresa "${data.company_name}" registrada com sucesso como ${data.username}!`);
      setShowRegisterCompanyModal(false);
      setNewCompanyUsername('');
      setNewCompanyPassword('');
      setNewCompanyCompanyName('');
      setNewCompanyDesignTheme('default');
      setNewCompanyMercadoPagoAccessToken('');
      // O listener do Firestore para 'admin' deve atualizar a lista de empresas automaticamente
    } catch (error) {
      console.error('Erro ao registrar empresa:', error);
      setMessage(`Erro ao registrar empresa: ${error.message}`);
    }
  };

  const handleDeleteCompany = async (companyIdToDelete) => {
    setMessage('');
    if (!window.confirm(`Tem certeza que deseja excluir a empresa "${companyIdToDelete}" e todos os seus dados?`)) {
      return;
    }
    try {
      const response = await fetch(`${FLASK_BACKEND_URL}/delete_company`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${firebaseToken}` // Envia o token do admin
        },
        body: JSON.stringify({ company_username: companyIdToDelete }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro desconhecido ao excluir empresa');
      }

      const data = await response.json();
      setMessage(data.message);
      setDeleteCompanyUsername('');
      setShowDeleteUserModal(false); // Fecha o modal após a exclusão
      // O listener do Firestore para 'admin' deve atualizar a lista de empresas automaticamente
    } catch (error) {
      console.error('Erro ao excluir empresa:', error);
      setMessage(`Erro ao excluir empresa: ${error.message}`);
    }
  };


  const handleGeneratePix = async (e) => {
    e.preventDefault();
    setMessage('');
    setPixQRCode('');
    setPixCopyPasteKey('');
    setPixStatus('');
    setPixPaymentId('');

    try {
      const response = await fetch(`${FLASK_BACKEND_URL}/pix/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Não precisa de Authorization aqui, pois a rota não é protegida
          // e o company_username é enviado no corpo da requisição.
        },
        body: JSON.stringify({
          amount: parseFloat(newPixAmount),
          description: newPixDescription,
          company_username: username, // O username logado (que é o company_admin)
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro desconhecido ao gerar Pix');
      }

      const data = await response.json();
      setPixQRCode(data.qr_code_base64);
      setPixCopyPasteKey(data.copy_paste_key);
      setPixStatus(data.status);
      setPixPaymentId(data.payment_id);
      setMessage('QR Code Pix gerado com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar Pix:', error);
      setMessage(`Erro ao gerar Pix: ${error.message}`);
    }
  };

  const handleAddCompanyUser = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      const response = await fetch(`${FLASK_BACKEND_URL}/company_users/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${firebaseToken}`
        },
        body: JSON.stringify({
          username: newUserName,
          password: newUserPassword,
          role: newUserRole,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro desconhecido ao adicionar usuário');
      }

      const data = await response.json();
      setMessage(`Usuário "${data.username}" (${data.role}) adicionado com sucesso!`);
      setShowAddUserModal(false);
      setNewUserName('');
      setNewUserPassword('');
      setNewUserRole('caixa');
      // O listener do Firestore deve atualizar a lista de usuários da empresa automaticamente
    } catch (error) {
      console.error('Erro ao adicionar usuário:', error);
      setMessage(`Erro ao adicionar usuário: ${error.message}`);
    }
  };

  const handleUpdateCompanyUser = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      const response = await fetch(`${FLASK_BACKEND_URL}/company_users/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${firebaseToken}`
        },
        body: JSON.stringify({
          user_id: updateUserId,
          username: updateUserName,
          password: updateUserPassword, // Envia a senha apenas se for alterada
          role: updateUserRole,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro desconhecido ao atualizar usuário');
      }

      const data = await response.json();
      setMessage(`Usuário "${data.username}" atualizado com sucesso!`);
      setShowUpdateUserModal(false);
      setUpdateUserId('');
      setUpdateUserName('');
      setUpdateUserPassword('');
      setUpdateUserRole('');
      // O listener do Firestore deve atualizar a lista de usuários da empresa automaticamente
    } catch (error) {
      console.error('Erro ao atualizar usuário:', error);
      setMessage(`Erro ao atualizar usuário: ${error.message}`);
    }
  };

  const handleDeleteCompanyUser = async (userIdToDelete) => {
    setMessage('');
    if (!window.confirm(`Tem certeza que deseja excluir este usuário?`)) {
      return;
    }
    try {
      const response = await fetch(`${FLASK_BACKEND_URL}/company_users/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${firebaseToken}`
        },
        body: JSON.stringify({ user_id: userIdToDelete }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro desconhecido ao excluir usuário');
      }

      const data = await response.json();
      setMessage(data.message);
      setDeleteUserId('');
      setShowDeleteUserModal(false);
      // O listener do Firestore deve atualizar a lista de usuários da empresa automaticamente
    } catch (error) {
      console.error('Erro ao excluir usuário:', error);
      setMessage(`Erro ao excluir usuário: ${error.message}`);
    }
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      const currentCompanyId = auth.currentUser?.uid; // company_admin UID
      if (!currentCompanyId) throw new Error("ID da empresa não disponível.");

      await addDoc(collection(db, 'artifacts', appId, 'users', currentCompanyId, 'products'), {
        name: newProductName,
        price: parseFloat(newProductPrice),
        stock: parseInt(newProductStock),
        created_at: serverTimestamp(),
      });
      setMessage('Produto adicionado com sucesso!');
      setNewProductName('');
      setNewProductPrice('');
      setNewProductStock('');
      setShowManageProductsModal(false);
    } catch (error) {
      console.error('Erro ao adicionar produto:', error);
      setMessage(`Erro ao adicionar produto: ${error.message}`);
    }
  };

  const handleUpdateProduct = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      const currentCompanyId = auth.currentUser?.uid;
      if (!currentCompanyId) throw new Error("ID da empresa não disponível.");

      const productDocRef = doc(db, 'artifacts', appId, 'users', currentCompanyId, 'products', updateProductId);
      await updateDoc(productDocRef, {
        name: updateProductName,
        price: parseFloat(updateProductPrice),
        stock: parseInt(updateProductStock),
      });
      setMessage('Produto atualizado com sucesso!');
      setUpdateProductId('');
      setUpdateProductName('');
      setUpdateProductPrice('');
      setUpdateProductStock('');
      setShowManageProductsModal(false);
    } catch (error) {
      console.error('Erro ao atualizar produto:', error);
      setMessage(`Erro ao atualizar produto: ${error.message}`);
    }
  };

  const handleDeleteProduct = async (productId) => {
    setMessage('');
    if (!window.confirm(`Tem certeza que deseja excluir este produto?`)) {
      return;
    }
    try {
      const currentCompanyId = auth.currentUser?.uid;
      if (!currentCompanyId) throw new Error("ID da empresa não disponível.");

      const productDocRef = doc(db, 'artifacts', appId, 'users', currentCompanyId, 'products', productId);
      await deleteDoc(productDocRef);
      setMessage('Produto excluído com sucesso!');
    } catch (error) {
      console.error('Erro ao excluir produto:', error);
      setMessage(`Erro ao excluir produto: ${error.message}`);
    }
  };

  const handleAddSale = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      const currentCompanyId = auth.currentUser?.uid;
      if (!currentCompanyId) throw new Error("ID da empresa não disponível.");

      const selectedProduct = products.find(p => p.id === newSaleProductId);
      if (!selectedProduct) {
        setMessage('Produto selecionado inválido.');
        return;
      }
      if (newSaleQuantity <= 0 || newSaleQuantity > selectedProduct.stock) {
        setMessage('Quantidade inválida ou estoque insuficiente.');
        return;
      }

      const totalSale = selectedProduct.price * newSaleQuantity;

      await addDoc(collection(db, 'artifacts', appId, 'users', currentCompanyId, 'sales'), {
        productId: newSaleProductId,
        productName: selectedProduct.name,
        quantity: parseInt(newSaleQuantity),
        unitPrice: selectedProduct.price,
        total: totalSale,
        paymentMethod: newSalePaymentMethod,
        timestamp: serverTimestamp(),
        recordedBy: username, // Quem registrou a venda
      });

      // Atualiza o estoque do produto
      const productDocRef = doc(db, 'artifacts', appId, 'users', currentCompanyId, 'products', newSaleProductId);
      await updateDoc(productDocRef, {
        stock: selectedProduct.stock - parseInt(newSaleQuantity),
      });

      setMessage('Venda registrada com sucesso!');
      setNewSaleProductId('');
      setNewSaleQuantity('');
      setNewSalePaymentMethod('Pix');
      setNewSaleTotal('');
      setShowManageSalesModal(false);
    } catch (error) {
      console.error('Erro ao adicionar venda:', error);
      setMessage(`Erro ao adicionar venda: ${error.message}`);
    }
  };

  // Calcula o total da venda ao selecionar produto e quantidade
  useEffect(() => {
    const selectedProduct = products.find(p => p.id === newSaleProductId);
    if (selectedProduct && newSaleQuantity > 0) {
      setNewSaleTotal((selectedProduct.price * newSaleQuantity).toFixed(2));
    } else {
      setNewSaleTotal('');
    }
  }, [newSaleProductId, newSaleQuantity, products]);


  // Função auxiliar para copiar texto para a área de transferência
  const copyToClipboard = (text) => {
    const el = document.createElement('textarea');
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    setMessage('Chave Pix copiada para a área de transferência!');
  };

  // Classes Tailwind para o tema de design
  const getThemeClasses = (element) => {
    const theme = designTheme || DEFAULT_THEMES.default; // Garante que há um tema

    switch (element) {
      case 'gradient_bg': return `bg-gradient-to-br ${theme.gradient_from} ${theme.gradient_to}`;
      case 'primary_button': return `bg-${theme.primary_button_bg.split('-')[1]}-600 hover:bg-${theme.primary_button_hover_bg.split('-')[1]}-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-300`;
      case 'secondary_button': return `bg-${theme.secondary_button_bg.split('-')[1]}-200 text-${theme.secondary_button_text.split('-')[1]}-700 hover:bg-${theme.secondary_button_hover_bg.split('-')[1]}-100 font-bold py-2 px-4 rounded-lg shadow-md transition duration-300`;
      case 'text_strong': return `text-${theme.text_color_strong.split('-')[1]}-800`;
      case 'text_medium': return `text-${theme.text_color_medium.split('-')[1]}-700`;
      case 'border_color': return `border-${theme.border_color.split('-')[1]}-200`;
      case 'highlight_color': return `text-${theme.highlight_color.split('-')[1]}-600`;
      case 'success_bg': return `bg-${theme.success_color.split('-')[1]}-500`;
      case 'error_bg': return `bg-${theme.error_color.split('-')[1]}-500`;
      case 'font_family': return theme.font_family;
      case 'dominant_color_bg': return `bg-${theme.dominant_color.split('-')[1]}-50`;
      default: return '';
    }
  };


  return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-4 ${getThemeClasses('gradient_bg')} ${getThemeClasses('font_family')}`}>
      <div className={`w-full max-w-md bg-white p-8 rounded-xl shadow-2xl border ${getThemeClasses('border_color')}`}>
        <h1 className={`text-3xl font-bold text-center mb-6 ${getThemeClasses('text_strong')}`}>
          APPCAIXA
        </h1>

        {message && (
          <div className={`p-3 mb-4 rounded-lg text-white text-center ${message.includes('Erro') ? getThemeClasses('error_bg') : getThemeClasses('success_bg')}`}>
            {message}
          </div>
        )}

        {!isLoggedIn ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="text"
              placeholder="Nome de usuário"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={`w-full p-3 border ${getThemeClasses('border_color')} rounded-lg focus:outline-none focus:ring-2 focus:ring-${designTheme.primary_button_bg?.split('-')[1] || 'blue'}-500`}
              required
              autocomplete="off" // Adicionado para desativar o preenchimento automático
            />
            <input
              type="password"
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`w-full p-3 border ${getThemeClasses('border_color')} rounded-lg focus:outline-none focus:ring-2 focus:ring-${designTheme.primary_button_bg?.split('-')[1] || 'blue'}-500`}
              required
              autocomplete="off" // Adicionado para desativar o preenchimento automático
            />
            <button type="submit" className={`w-full ${getThemeClasses('primary_button')}`}>
              Entrar
            </button>
            {userRole === 'admin' && (
              <button
                type="button"
                onClick={() => setShowRegisterCompanyModal(true)}
                className={`w-full ${getThemeClasses('secondary_button')} mt-2`}
              >
                Registrar Nova Empresa
              </button>
            )}
          </form>
        ) : (
          <div className="text-center">
            <h2 className={`text-2xl font-semibold mb-4 ${getThemeClasses('text_strong')}`}>
              Bem-vindo, {username} ({userRole === 'company_admin' ? companyName : userRole})!
            </h2>
            <div className="space-y-3">
              {userRole === 'admin' && (
                <>
                  <button
                    onClick={() => setShowManageCompaniesModal(true)}
                    className={`w-full ${getThemeClasses('primary_button')}`}
                  >
                    Gerenciar Empresas
                  </button>
                  <button
                    onClick={() => setShowRegisterCompanyModal(true)}
                    className={`w-full ${getThemeClasses('secondary_button')}`}
                  >
                    Registrar Nova Empresa
                  </button>
                </>
              )}

              {userRole === 'company_admin' && (
                <>
                  <button
                    onClick={() => setShowGeneratePixModal(true)}
                    className={`w-full ${getThemeClasses('primary_button')}`}
                  >
                    Gerar Pix
                  </button>
                  <button
                    onClick={() => setShowManageCompanyUsersModal(true)}
                    className={`w-full ${getThemeClasses('secondary_button')}`}
                  >
                    Gerenciar Usuários da Empresa
                  </button>
                  <button
                    onClick={() => setShowManageProductsModal(true)}
                    className={`w-full ${getThemeClasses('secondary_button')}`}
                  >
                    Gerenciar Produtos
                  </button>
                  <button
                    onClick={() => setShowManageSalesModal(true)}
                    className={`w-full ${getThemeClasses('secondary_button')}`}
                  >
                    Gerenciar Vendas
                  </button>
                </>
              )}

              {(userRole === 'gerente' || userRole === 'caixa') && (
                <>
                  <button
                    onClick={() => setShowManageProductsModal(true)}
                    className={`w-full ${getThemeClasses('primary_button')}`}
                  >
                    Ver Produtos
                  </button>
                  <button
                    onClick={() => setShowManageSalesModal(true)}
                    className={`w-full ${getThemeClasses('secondary_button')}`}
                  >
                    Registrar Venda
                  </button>
                </>
              )}

              <button
                onClick={handleLogout}
                className={`w-full ${getThemeClasses('secondary_button')} mt-4`}
              >
                Sair
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Registro de Empresa */}
      {showRegisterCompanyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className={`bg-white p-6 rounded-xl shadow-2xl w-full max-w-md border ${getThemeClasses('border_color')}`}>
            <h2 className={`text-2xl font-bold mb-4 ${getThemeClasses('text_strong')}`}>Registrar Nova Empresa</h2>
            <form onSubmit={handleRegisterCompany} className="space-y-4">
              <input
                type="text"
                placeholder="Nome de Usuário da Empresa (ID)"
                value={newCompanyUsername}
                onChange={(e) => setNewCompanyUsername(e.target.value)}
                className={`w-full p-3 border ${getThemeClasses('border_color')} rounded-lg`}
                required
                autocomplete="off" // Adicionado
              />
              <input
                type="password"
                placeholder="Senha da Empresa"
                value={newCompanyPassword}
                onChange={(e) => setNewCompanyPassword(e.target.value)}
                className={`w-full p-3 border ${getThemeClasses('border_color')} rounded-lg`}
                required
                autocomplete="new-password" // Sugerido para senhas
              />
              <input
                type="text"
                placeholder="Nome Completo da Empresa"
                value={newCompanyCompanyName}
                onChange={(e) => setNewCompanyCompanyName(e.target.value)}
                className={`w-full p-3 border ${getThemeClasses('border_color')} rounded-lg`}
                required
                autocomplete="off" // Adicionado
              />
              <select
                value={newCompanyDesignTheme}
                onChange={(e) => setNewCompanyDesignTheme(e.target.value)}
                className={`w-full p-3 border ${getThemeClasses('border_color')} rounded-lg`}
              >
                <option value="default">Tema Padrão</option>
                <option value="corporate">Tema Corporativo</option>
                <option value="vibrant">Tema Vibrante</option>
              </select>
              {/* Campo para Mercado Pago Access Token - Removido para OAuth */}
              {/* <input
                type="text"
                placeholder="Mercado Pago Access Token"
                value={newCompanyMercadoPagoAccessToken}
                onChange={(e) => setNewCompanyMercadoPagoAccessToken(e.target.value)}
                className={`w-full p-3 border ${getThemeClasses('border_color')} rounded-lg`}
              /> */}
              <button type="submit" className={`w-full ${getThemeClasses('primary_button')}`}>
                Registrar
              </button>
              <button
                type="button"
                onClick={() => setShowRegisterCompanyModal(false)}
                className={`w-full ${getThemeClasses('secondary_button')} mt-2`}
              >
                Cancelar
              </button>
            </form>
            {/* Botão para iniciar o fluxo OAuth - Simulado por enquanto */}
            <button
              onClick={() => setMessage('Iniciando fluxo OAuth do Mercado Pago... (implementação futura)')}
              className={`w-full ${getThemeClasses('secondary_button')} mt-4`}
            >
              Conectar Mercado Pago (OAuth)
            </button>
          </div>
        </div>
      )}

      {/* Modal de Gerar Pix */}
      {showGeneratePixModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className={`bg-white p-6 rounded-xl shadow-2xl w-full max-w-md border ${getThemeClasses('border_color')}`}>
            <h2 className={`text-2xl font-bold mb-4 ${getThemeClasses('text_strong')}`}>Gerar Pix</h2>
            <form onSubmit={handleGeneratePix} className="space-y-4">
              <input
                type="number"
                step="0.01"
                placeholder="Valor (ex: 10.50)"
                value={newPixAmount}
                onChange={(e) => setNewPixAmount(e.target.value)}
                className={`w-full p-3 border ${getThemeClasses('border_color')} rounded-lg`}
                required
              />
              <input
                type="text"
                placeholder="Descrição (opcional)"
                value={newPixDescription}
                onChange={(e) => setNewPixDescription(e.target.value)}
                className={`w-full p-3 border ${getThemeClasses('border_color')} rounded-lg`}
              />
              <button type="submit" className={`w-full ${getThemeClasses('primary_button')}`}>
                Gerar QR Code Pix
              </button>
              <button
                type="button"
                onClick={() => setShowGeneratePixModal(false)}
                className={`w-full ${getThemeClasses('secondary_button')} mt-2`}
              >
                Fechar
              </button>
            </form>

            {pixQRCode && (
              <div className="mt-6 text-center">
                <h3 className={`text-xl font-semibold mb-2 ${getThemeClasses('text_strong')}`}>QR Code Pix</h3>
                <img src={`data:image/png;base64,${pixQRCode}`} alt="QR Code Pix" className="mx-auto w-48 h-48 border border-gray-300 rounded-lg p-2" />
                <p className={`mt-4 ${getThemeClasses('text_medium')}`}>
                  Status: <span className={`${pixStatus === 'approved' ? 'text-green-600' : 'text-orange-500'}`}>{pixStatus}</span>
                </p>
                <p className={`mt-2 ${getThemeClasses('text_medium')}`}>ID do Pagamento: {pixPaymentId}</p>
                <div className="mt-4">
                  <p className={`font-semibold ${getThemeClasses('text_strong')}`}>Chave Pix Copia e Cola:</p>
                  <textarea
                    readOnly
                    value={pixCopyPasteKey}
                    className={`w-full p-2 border ${getThemeClasses('border_color')} rounded-lg mt-2 resize-none`}
                    rows="4"
                    onClick={(e) => copyToClipboard(e.target.value)}
                  />
                  <button
                    onClick={() => copyToClipboard(pixCopyPasteKey)}
                    className={`w-full ${getThemeClasses('secondary_button')} mt-2`}
                  >
                    Copiar Chave
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de Gerenciar Empresas (apenas para Admin) */}
      {showManageCompaniesModal && userRole === 'admin' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className={`bg-white p-6 rounded-xl shadow-2xl w-full max-w-2xl border ${getThemeClasses('border_color')}`}>
            <h2 className={`text-2xl font-bold mb-4 ${getThemeClasses('text_strong')}`}>Gerenciar Empresas</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white rounded-lg shadow-md">
                <thead>
                  <tr className={`bg-${designTheme.dominant_color?.split('-')[1] || 'blue'}-50`}>
                    <th className={`py-2 px-4 border-b ${getThemeClasses('border_color')} text-left ${getThemeClasses('text_strong')}`}>ID da Empresa</th>
                    <th className={`py-2 px-4 border-b ${getThemeClasses('border_color')} text-left ${getThemeClasses('text_strong')}`}>Nome da Empresa</th>
                    <th className={`py-2 px-4 border-b ${getThemeClasses('border_color')} text-left ${getThemeClasses('text_strong')}`}>Tema</th>
                    <th className={`py-2 px-4 border-b ${getThemeClasses('border_color')} text-left ${getThemeClasses('text_strong')}`}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {companies.map((company) => (
                    <tr key={company.id} className="hover:bg-gray-50">
                      <td className={`py-2 px-4 border-b ${getThemeClasses('border_color')} ${getThemeClasses('text_medium')}`}>{company.id}</td>
                      <td className={`py-2 px-4 border-b ${getThemeClasses('border_color')} ${getThemeClasses('text_medium')}`}>{company.company_name}</td>
                      <td className={`py-2 px-4 border-b ${getThemeClasses('border_color')} ${getThemeClasses('text_medium')}`}>{company.design_theme}</td>
                      <td className={`py-2 px-4 border-b ${getThemeClasses('border_color')}`}>
                        <button
                          onClick={() => handleDeleteCompany(company.id)}
                          className={`bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-3 rounded-lg text-sm`}
                        >
                          Excluir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              onClick={() => setShowManageCompaniesModal(false)}
              className={`w-full ${getThemeClasses('secondary_button')} mt-4`}
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Modal de Gerenciar Usuários da Empresa (apenas para company_admin) */}
      {showManageCompanyUsersModal && userRole === 'company_admin' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className={`bg-white p-6 rounded-xl shadow-2xl w-full max-w-2xl border ${getThemeClasses('border_color')}`}>
            <h2 className={`text-2xl font-bold mb-4 ${getThemeClasses('text_strong')}`}>Gerenciar Usuários da Empresa</h2>

            <h3 className={`text-xl font-semibold mb-3 ${getThemeClasses('text_strong')}`}>Adicionar Novo Usuário</h3>
            <form onSubmit={handleAddCompanyUser} className="space-y-4 mb-6">
              <input
                type="text"
                placeholder="Nome de Usuário"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                className={`w-full p-3 border ${getThemeClasses('border_color')} rounded-lg`}
                required
                autocomplete="off" // Adicionado
              />
              <input
                type="password"
                placeholder="Senha"
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
                className={`w-full p-3 border ${getThemeClasses('border_color')} rounded-lg`}
                required
                autocomplete="new-password" // Sugerido para senhas
              />
              <select
                value={newUserRole}
                onChange={(e) => setNewUserRole(e.target.value)}
                className={`w-full p-3 border ${getThemeClasses('border_color')} rounded-lg`}
              >
                <option value="caixa">Caixa</option>
                <option value="gerente">Gerente</option>
              </select>
              <button type="submit" className={`w-full ${getThemeClasses('primary_button')}`}>
                Adicionar Usuário
              </button>
            </form>

            <h3 className={`text-xl font-semibold mb-3 ${getThemeClasses('text_strong')}`}>Usuários Existentes</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white rounded-lg shadow-md">
                <thead>
                  <tr className={`bg-${designTheme.dominant_color?.split('-')[1] || 'blue'}-50`}>
                    <th className={`py-2 px-4 border-b ${getThemeClasses('border_color')} text-left ${getThemeClasses('text_strong')}`}>Nome de Usuário</th>
                    <th className={`py-2 px-4 border-b ${getThemeClasses('border_color')} text-left ${getThemeClasses('text_strong')}`}>Função</th>
                    <th className={`py-2 px-4 border-b ${getThemeClasses('border_color')} text-left ${getThemeClasses('text_strong')}`}>ID Firebase</th>
                    <th className={`py-2 px-4 border-b ${getThemeClasses('border_color')} text-left ${getThemeClasses('text_strong')}`}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {companyUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className={`py-2 px-4 border-b ${getThemeClasses('border_color')} ${getThemeClasses('text_medium')}`}>{user.username}</td>
                      <td className={`py-2 px-4 border-b ${getThemeClasses('border_color')} ${getThemeClasses('text_medium')}`}>{user.role}</td>
                      <td className={`py-2 px-4 border-b ${getThemeClasses('border_color')} ${getThemeClasses('text_medium')}`}>{user.firebase_uid}</td>
                      <td className={`py-2 px-4 border-b ${getThemeClasses('border_color')}`}>
                        <button
                          onClick={() => {
                            setUpdateUserId(user.id);
                            setUpdateUserName(user.username);
                            setUpdateUserRole(user.role);
                            setShowUpdateUserModal(true);
                          }}
                          className={`bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-1 px-3 rounded-lg text-sm mr-2`}
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleDeleteCompanyUser(user.id)}
                          className={`bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-3 rounded-lg text-sm`}
                        >
                          Excluir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              onClick={() => setShowManageCompanyUsersModal(false)}
              className={`w-full ${getThemeClasses('secondary_button')} mt-4`}
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Modal de Atualizar Usuário da Empresa */}
      {showUpdateUserModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className={`bg-white p-6 rounded-xl shadow-2xl w-full max-w-md border ${getThemeClasses('border_color')}`}>
            <h2 className={`text-2xl font-bold mb-4 ${getThemeClasses('text_strong')}`}>Editar Usuário</h2>
            <form onSubmit={handleUpdateCompanyUser} className="space-y-4">
              <input
                type="text"
                placeholder="Nome de Usuário"
                value={updateUserName}
                onChange={(e) => setUpdateUserName(e.target.value)}
                className={`w-full p-3 border ${getThemeClasses('border_color')} rounded-lg`}
                required
                autocomplete="off" // Adicionado
              />
              <input
                type="password"
                placeholder="Nova Senha (opcional)"
                value={updateUserPassword}
                onChange={(e) => setUpdateUserPassword(e.target.value)}
                className={`w-full p-3 border ${getThemeClasses('border_color')} rounded-lg`}
                autocomplete="new-password" // Sugerido para senhas
              />
              <select
                value={updateUserRole}
                onChange={(e) => setUpdateUserRole(e.target.value)}
                className={`w-full p-3 border ${getThemeClasses('border_color')} rounded-lg`}
              >
                <option value="caixa">Caixa</option>
                <option value="gerente">Gerente</option>
              </select>
              <button type="submit" className={`w-full ${getThemeClasses('primary_button')}`}>
                Salvar Alterações
              </button>
              <button
                type="button"
                onClick={() => setShowUpdateUserModal(false)}
                className={`w-full ${getThemeClasses('secondary_button')} mt-2`}
              >
                Cancelar
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Gerenciar Produtos */}
      {showManageProductsModal && (userRole === 'company_admin' || userRole === 'gerente' || userRole === 'caixa') && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className={`bg-white p-6 rounded-xl shadow-2xl w-full max-w-2xl border ${getThemeClasses('border_color')}`}>
            <h2 className={`text-2xl font-bold mb-4 ${getThemeClasses('text_strong')}`}>Gerenciar Produtos</h2>

            {(userRole === 'company_admin' || userRole === 'gerente') && (
              <>
                <h3 className={`text-xl font-semibold mb-3 ${getThemeClasses('text_strong')}`}>Adicionar Novo Produto</h3>
                <form onSubmit={handleAddProduct} className="space-y-4 mb-6">
                  <input
                    type="text"
                    placeholder="Nome do Produto"
                    value={newProductName}
                    onChange={(e) => setNewProductName(e.target.value)}
                    className={`w-full p-3 border ${getThemeClasses('border_color')} rounded-lg`}
                    required
                    autocomplete="off" // Adicionado
                  />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Preço"
                    value={newProductPrice}
                    onChange={(e) => setNewProductPrice(e.target.value)}
                    className={`w-full p-3 border ${getThemeClasses('border_color')} rounded-lg`}
                    required
                    autocomplete="off" // Adicionado
                  />
                  <input
                    type="number"
                    step="1"
                    placeholder="Estoque"
                    value={newProductStock}
                    onChange={(e) => setNewProductStock(e.target.value)}
                    className={`w-full p-3 border ${getThemeClasses('border_color')} rounded-lg`}
                    required
                    autocomplete="off" // Adicionado
                  />
                  <button type="submit" className={`w-full ${getThemeClasses('primary_button')}`}>
                    Adicionar Produto
                  </button>
                </form>
              </>
            )}

            <h3 className={`text-xl font-semibold mb-3 ${getThemeClasses('text_strong')}`}>Produtos Existentes</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white rounded-lg shadow-md">
                <thead>
                  <tr className={`bg-${designTheme.dominant_color?.split('-')[1] || 'blue'}-50`}>
                    <th className={`py-2 px-4 border-b ${getThemeClasses('border_color')} text-left ${getThemeClasses('text_strong')}`}>Nome</th>
                    <th className={`py-2 px-4 border-b ${getThemeClasses('border_color')} text-left ${getThemeClasses('text_strong')}`}>Preço</th>
                    <th className={`py-2 px-4 border-b ${getThemeClasses('border_color')} text-left ${getThemeClasses('text_strong')}`}>Estoque</th>
                    {(userRole === 'company_admin' || userRole === 'gerente') && (
                      <th className={`py-2 px-4 border-b ${getThemeClasses('border_color')} text-left ${getThemeClasses('text_strong')}`}>Ações</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50">
                      <td className={`py-2 px-4 border-b ${getThemeClasses('border_color')} ${getThemeClasses('text_medium')}`}>{product.name}</td>
                      <td className={`py-2 px-4 border-b ${getThemeClasses('border_color')} ${getThemeClasses('text_medium')}`}>R$ {product.price.toFixed(2)}</td>
                      <td className={`py-2 px-4 border-b ${getThemeClasses('border_color')} ${getThemeClasses('text_medium')}`}>{product.stock}</td>
                      {(userRole === 'company_admin' || userRole === 'gerente') && (
                        <td className={`py-2 px-4 border-b ${getThemeClasses('border_color')}`}>
                          <button
                            onClick={() => {
                              setUpdateProductId(product.id);
                              setUpdateProductName(product.name);
                              setUpdateProductPrice(product.price);
                              setUpdateProductStock(product.stock);
                              setShowManageProductsModal(true); // Reabre o modal para edição
                            }}
                            className={`bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-1 px-3 rounded-lg text-sm mr-2`}
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(product.id)}
                            className={`bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-3 rounded-lg text-sm`}
                          >
                            Excluir
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              onClick={() => setShowManageProductsModal(false)}
              className={`w-full ${getThemeClasses('secondary_button')} mt-4`}
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Modal de Atualizar Produto (integrado no Gerenciar Produtos) */}
      {showManageProductsModal && updateProductId && (userRole === 'company_admin' || userRole === 'gerente') && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className={`bg-white p-6 rounded-xl shadow-2xl w-full max-w-md border ${getThemeClasses('border_color')}`}>
            <h2 className={`text-2xl font-bold mb-4 ${getThemeClasses('text_strong')}`}>Editar Produto</h2>
            <form onSubmit={handleUpdateProduct} className="space-y-4">
              <input
                type="text"
                placeholder="Nome do Produto"
                value={updateProductName}
                onChange={(e) => setUpdateProductName(e.target.value)}
                className={`w-full p-3 border ${getThemeClasses('border_color')} rounded-lg`}
                required
                autocomplete="off" // Adicionado
              />
              <input
                type="number"
                step="0.01"
                placeholder="Preço"
                value={updateProductPrice}
                onChange={(e) => setUpdateProductPrice(e.target.value)}
                className={`w-full p-3 border ${getThemeClasses('border_color')} rounded-lg`}
                required
                autocomplete="off" // Adicionado
              />
              <input
                type="number"
                step="1"
                placeholder="Estoque"
                value={updateProductStock}
                onChange={(e) => setUpdateProductStock(e.target.value)}
                className={`w-full p-3 border ${getThemeClasses('border_color')} rounded-lg`}
                required
                autocomplete="off" // Adicionado
              />
              <button type="submit" className={`w-full ${getThemeClasses('primary_button')}`}>
                Salvar Alterações
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowManageProductsModal(false);
                  setUpdateProductId(''); // Limpa o ID para fechar o modal de edição
                }}
                className={`w-full ${getThemeClasses('secondary_button')} mt-2`}
              >
                Cancelar
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Gerenciar Vendas */}
      {showManageSalesModal && (userRole === 'company_admin' || userRole === 'gerente' || userRole === 'caixa') && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className={`bg-white p-6 rounded-xl shadow-2xl w-full max-w-2xl border ${getThemeClasses('border_color')}`}>
            <h2 className={`text-2xl font-bold mb-4 ${getThemeClasses('text_strong')}`}>Gerenciar Vendas</h2>

            <h3 className={`text-xl font-semibold mb-3 ${getThemeClasses('text_strong')}`}>Registrar Nova Venda</h3>
            <form onSubmit={handleAddSale} className="space-y-4 mb-6">
              <select
                value={newSaleProductId}
                onChange={(e) => setNewSaleProductId(e.target.value)}
                className={`w-full p-3 border ${getThemeClasses('border_color')} rounded-lg`}
                required
              >
                <option value="">Selecione um Produto</option>
                {products.map(product => (
                  <option key={product.id} value={product.id}>
                    {product.name} (Estoque: {product.stock}) - R$ {product.price.toFixed(2)}
                  </option>
                ))}
              </select>
              <input
                type="number"
                step="1"
                placeholder="Quantidade"
                value={newSaleQuantity}
                onChange={(e) => setNewSaleQuantity(e.target.value)}
                className={`w-full p-3 border ${getThemeClasses('border_color')} rounded-lg`}
                required
              />
              <select
                value={newSalePaymentMethod}
                onChange={(e) => setNewSalePaymentMethod(e.target.value)}
                className={`w-full p-3 border ${getThemeClasses('border_color')} rounded-lg`}
                required
              >
                <option value="Pix">Pix</option>
                <option value="Cartao">Cartão</option>
                <option value="Dinheiro">Dinheiro</option>
              </select>
              <p className={`text-lg font-semibold ${getThemeClasses('text_strong')}`}>Total: R$ {newSaleTotal}</p>
              <button type="submit" className={`w-full ${getThemeClasses('primary_button')}`}>
                Registrar Venda
              </button>
            </form>

            <h3 className={`text-xl font-semibold mb-3 ${getThemeClasses('text_strong')}`}>Histórico de Vendas</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white rounded-lg shadow-md">
                <thead>
                  <tr className={`bg-${designTheme.dominant_color?.split('-')[1] || 'blue'}-50`}>
                    <th className={`py-2 px-4 border-b ${getThemeClasses('border_color')} text-left ${getThemeClasses('text_strong')}`}>Produto</th>
                    <th className={`py-2 px-4 border-b ${getThemeClasses('border_color')} text-left ${getThemeClasses('text_strong')}`}>Qtd</th>
                    <th className={`py-2 px-4 border-b ${getThemeClasses('border_color')} text-left ${getThemeClasses('text_strong')}`}>Preço Unit.</th>
                    <th className={`py-2 px-4 border-b ${getThemeClasses('border_color')} text-left ${getThemeClasses('text_strong')}`}>Total</th>
                    <th className={`py-2 px-4 border-b ${getThemeClasses('border_color')} text-left ${getThemeClasses('text_strong')}`}>Pagamento</th>
                    <th className={`py-2 px-4 border-b ${getThemeClasses('border_color')} text-left ${getThemeClasses('text_strong')}`}>Data</th>
                    <th className={`py-2 px-4 border-b ${getThemeClasses('border_color')} text-left ${getThemeClasses('text_strong')}`}>Registrado Por</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-gray-50">
                      <td className={`py-2 px-4 border-b ${getThemeClasses('border_color')} ${getThemeClasses('text_medium')}`}>{sale.productName}</td>
                      <td className={`py-2 px-4 border-b ${getThemeClasses('border_color')} ${getThemeClasses('text_medium')}`}>{sale.quantity}</td>
                      <td className={`py-2 px-4 border-b ${getThemeClasses('border_color')} ${getThemeClasses('text_medium')}`}>R$ {sale.unitPrice.toFixed(2)}</td>
                      <td className={`py-2 px-4 border-b ${getThemeClasses('border_color')} ${getThemeClasses('text_medium')}`}>R$ {sale.total.toFixed(2)}</td>
                      <td className={`py-2 px-4 border-b ${getThemeClasses('border_color')} ${getThemeClasses('text_medium')}`}>{sale.paymentMethod}</td>
                      <td className={`py-2 px-4 border-b ${getThemeClasses('border_color')} ${getThemeClasses('text_medium')}`}>
                        {sale.timestamp?.toDate().toLocaleDateString()} {sale.timestamp?.toDate().toLocaleTimeString()}
                      </td>
                      <td className={`py-2 px-4 border-b ${getThemeClasses('border_color')} ${getThemeClasses('text_medium')}`}>{sale.recordedBy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              onClick={() => setShowManageSalesModal(false)}
              className={`w-full ${getThemeClasses('secondary_button')} mt-4`}
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
