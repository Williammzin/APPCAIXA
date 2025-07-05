/* global __app_id, __firebase_config, __initial_auth_token */
import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query, where, setDoc, getDoc } from 'firebase/firestore';

// URL base do seu backend Flask
// ATENÇÃO: SUBSTITUA 'https://old-owl-williammzin-cd2d4d31.koyeb.app' PELA URL REAL DO SEU BACKEND KOYEB!
const FLASK_BACKEND_URL = 'https://old-owl-williammzin-cd2d4d31.koyeb.app';

// Temas padrão para o design da interface
const DEFAULT_THEMES = {
    default: {
        gradient_from: 'from-blue-50',
        gradient_to: 'to-indigo-100',
        primary_button_bg: 'bg-blue-600',
        primary_button_hover_bg: 'hover:bg-blue-700',
        secondary_button_bg: 'bg-gray-200',
        secondary_button_text: 'text-gray-700',
        secondary_button_hover_bg: 'hover:bg-gray-100',
        text_color_strong: 'text-gray-800',
        text_color_medium: 'text-gray-700',
        border_color: 'border-blue-200',
        highlight_color: 'text-blue-600',
        success_color: 'bg-green-500',
        error_color: 'bg-red-500',
        font_family: 'font-sans',
        dominant_color: 'bg-blue-50' // Usado para cabeçalhos de tabela, etc.
    },
    corporate: {
        gradient_from: 'from-gray-100',
        gradient_to: 'to-gray-200',
        primary_button_bg: 'bg-purple-700',
        primary_button_hover_bg: 'hover:bg-purple-800',
        secondary_button_bg: 'bg-gray-300',
        secondary_button_text: 'text-gray-800',
        secondary_button_hover_bg: 'hover:bg-gray-400',
        text_color_strong: 'text-gray-900',
        text_color_medium: 'text-gray-700',
        border_color: 'border-purple-300',
        highlight_color: 'text-purple-700',
        success_color: 'bg-green-600',
        error_color: 'bg-red-600',
        font_family: 'font-serif',
        dominant_color: 'bg-purple-100'
    },
    vibrant: {
        gradient_from: 'from-pink-100',
        gradient_to: 'to-yellow-100',
        primary_button_bg: 'bg-pink-500',
        primary_button_hover_bg: 'hover:bg-pink-600',
        secondary_button_bg: 'bg-yellow-200',
        secondary_button_text: 'text-yellow-800',
        secondary_button_hover_bg: 'hover:bg-yellow-300',
        text_color_strong: 'text-purple-900',
        text_color_medium: 'text-purple-700',
        border_color: 'border-pink-300',
        highlight_color: 'text-orange-500',
        success_color: 'bg-lime-500',
        error_color: 'bg-rose-500',
        font_family: 'font-mono',
        dominant_color: 'bg-pink-50'
    }
};

// Componente de Modal de Confirmação
const ConfirmModal = ({ message, onConfirm, onCancel }) => {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full text-center">
                <p className="text-lg font-semibold mb-6">{message}</p>
                <div className="flex justify-around">
                    <button
                        onClick={onConfirm}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200"
                    >
                        Confirmar
                    </button>
                    <button
                        onClick={onCancel}
                        className="bg-gray-400 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200"
                    >
                        Cancelar
                    </button>
                </div>
            </div>
        </div>
    );
};

// Componente Principal da Aplicação
const App = () => {
    console.log("O componente App está sendo renderizado...");

    // Estados para instâncias do Firebase
    const [firebaseAuth, setFirebaseAuth] = useState(null);
    const [firestoreDb, setFirestoreDb] = useState(null);

    // ID da Aplicação do ambiente Canvas
    const [appId, setAppId] = useState('local-app-id');

    // Estados para dados da loja
    const [products, setProducts] = useState([]);
    const [sales, setSales] = useState([]);
    const [companies, setCompanies] = useState([]); // Apenas para o admin principal
    const [companyUsers, setCompanyUsers] = useState([]); // Apenas para company_admin

    // Estados do carrinho e pagamento
    const [cart, setCart] = useState([]);
    const [total, setTotal] = useState(0);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [change, setChange] = useState(0);
    const [difference, setDifference] = useState(0);
    const [paymentMethod, setPaymentMethod] = useState('Dinheiro');

    // Estados para gerenciamento de produtos
    const [newProductName, setNewProductName] = useState('');
    const [newProductValue, setNewProductValue] = useState('');
    const [newProductCost, setNewProductCost] = useState('');
    const [newProductId, setNewProductId] = useState('');
    const [editingProduct, setEditingProduct] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Estados para autenticação e usuário atual
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [currentUser, setCurrentUser] = useState(null); // Armazena { username, role, company_name, design }
    const [loginUsername, setLoginUsername] = useState('');
    const [loginPassword, setLoginPassword] = useState('');

    // Estados para registro de empresa (apenas para admin principal)
    const [newCompanyUsername, setNewCompanyUsername] = useState('');
    const [newCompanyPassword, setNewCompanyPassword] = useState('');
    const [newCompanyName, setNewCompanyName] = useState('');
    const [newCompanyDesignTheme, setNewCompanyDesignTheme] = useState('default');
    const [newCompanyMercadoPagoAccessToken, setNewCompanyMercadoPagoAccessToken] = useState('');

    // Estados para gerenciamento de usuários da empresa (apenas para company_admin)
    const [newCompanyUserUsername, setNewCompanyUserUsername] = useState('');
    const [newCompanyUserPassword, setNewCompanyUserPassword] = useState('');
    const [newCompanyUserRole, setNewCompanyUserRole] = useState('caixa');
    const [editingCompanyUser, setEditingCompanyUser] = useState(null);

    // Estados para funcionalidade Pix
    const [pixQrCodeData, setPixQrCodeData] = useState(null);
    const [isLoadingPix, setIsLoadingPix] = useState(false);

    // Estados para controle de abas
    const [activeTab, setActiveTab] = useState('caixa');

    // Estados para mensagens de feedback
    const [message, setMessage] = useState('');
    const messageTimeoutRef = useRef(null);

    // Estados para o modal de confirmação
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [confirmModalMessage, setConfirmModalMessage] = useState('');
    const [confirmModalAction, setConfirmModalAction] = useState(null);
    const [confirmModalPayload, setConfirmModalPayload] = useState(null);

    // Novo estado para controlar status do Pix da venda atual
    const [pixStatus, setPixStatus] = useState(null);
    // Novo estado para controlar se há Pix pendente (para desabilitar botão)
    const [isPixPending, setIsPixPending] = useState(false);

    // Função para exibir mensagens na interface
    const showMessage = (msg, type = 'success') => {
        setMessage({ text: msg, type });
        if (messageTimeoutRef.current) {
            clearTimeout(messageTimeoutRef.current);
        }
        messageTimeoutRef.current = setTimeout(() => {
            setMessage('');
        }, 3000);
    };

    // Efeito para inicialização do Firebase e listener de autenticação
    useEffect(() => {
        console.log("useEffect: Inicialização do Firebase e Listener de Autenticação.");
        let firebaseConfig = null;
        let currentAppId = 'local-app-id';

        // Tenta obter a configuração do ambiente Canvas
        if (typeof __firebase_config !== 'undefined' && typeof __app_id !== 'undefined') {
            try {
                firebaseConfig = JSON.parse(__firebase_config);
                currentAppId = __app_id;
                console.log("Configuração do Firebase e ID do App carregados do ambiente Canvas.");
            } catch (e) {
                console.error("Erro ao fazer parse de __firebase_config:", e);
                showMessage("Erro ao carregar a configuração do Firebase.", "error");
            }
        } else {
            throw new Error("Firebase config não encontrada! Defina __firebase_config e __app_id no ambiente.");
        }

        if (firebaseConfig) {
            try {
                const app = initializeApp(firebaseConfig);
                const auth = getAuth(app);
                const db = getFirestore(app);

                setFirebaseAuth(auth);
                setFirestoreDb(db);
                setAppId(currentAppId);

                console.log("Firebase App, Auth e Firestore inicializados e definidos no estado.");

                // Listener de mudança de estado de autenticação
                const unsubscribe = onAuthStateChanged(auth, async (user) => {
                    console.log("Estado de autenticação do Firebase alterado. Usuário:", user);
                    if (user) {
                        try {
                            const idTokenResult = await user.getIdTokenResult(true);
                            const role = idTokenResult.claims.role;
                            const companyName = idTokenResult.claims.company_name;
                            const design = idTokenResult.claims.design;

                            setCurrentUser({
                                username: user.uid, // Usando UID como username para consistência com Flask
                                role: role,
                                company_name: companyName,
                                design: design
                            });
                            setIsLoggedIn(true);
                            console.log("Usuário logado e estado currentUser atualizado:", user.uid, role);
                        } catch (claimsError) {
                            console.error("Erro ao obter custom claims do usuário:", claimsError);
                            showMessage("Erro ao recuperar detalhes do usuário. Por favor, tente fazer login novamente.", "error");
                            setIsLoggedIn(false);
                            setCurrentUser(null);
                        }
                    } else {
                        console.log("Nenhum usuário autenticado no Firebase.");
                        setIsLoggedIn(false);
                        setCurrentUser(null);
                    }
                });

                // Tenta fazer login com o token personalizado inicial do ambiente Canvas
                if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                    signInWithCustomToken(auth, __initial_auth_token)
                        .then(() => console.log("Login com token personalizado inicial bem-sucedido."))
                        .catch(error => console.error("Erro ao fazer login com token personalizado inicial:", error));
                }

                return () => unsubscribe(); // Limpeza do listener na desmontagem do componente
            } catch (e) {
                console.error("Erro crítico ao inicializar o Firebase:", e);
                showMessage("Erro crítico ao inicializar o Firebase. Por favor, verifique o console.", "error");
            }
        }
    }, []); // Array de dependências vazio significa que este efeito é executado apenas uma vez na montagem

    // Efeito para listeners do Firestore (Produtos, Vendas, Usuários da Empresa, Empresas)
    // Depende de firestoreDb e currentUser para garantir que o Firebase esteja inicializado e o usuário logado
    useEffect(() => {
        console.log("useEffect: Listeners do Firestore acionados. firestoreDb:", !!firestoreDb, "currentUser:", currentUser);

        if (!firestoreDb || !currentUser || !currentUser.username) {
            console.log("Listeners do Firestore ignorados: DB não pronto ou currentUser não definido.");
            setProducts([]);
            setSales([]);
            setCompanyUsers([]);
            setCompanies([]);
            return;
        }

        console.log("Tentando buscar dados do Firestore para o usuário:", currentUser.username);

        let unsubscribeProducts;
        let unsubscribeSales;
        let unsubscribeCompanyUsers;
        let unsubscribeCompanies;

        // Listener de Produtos (para company_admin, gerente, caixa)
        if (['company_admin', 'gerente', 'caixa'].includes(currentUser.role)) {
            const productsCollectionRef = collection(firestoreDb, `artifacts/${appId}/users/${currentUser.username}/products`);
            unsubscribeProducts = onSnapshot(productsCollectionRef, (snapshot) => {
                console.log("Snapshot de Produtos do Firestore recebido.");
                const productsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setProducts(productsData);
                console.log("Produtos carregados com sucesso!");
            }, (error) => {
                console.error("Erro ao carregar produtos:", error);
                showMessage("Erro ao carregar produtos do Firestore. Verifique as permissões.", "error");
            });
        } else {
            setProducts([]);
        }

        // Listener de Vendas (para company_admin, gerente, caixa)
        if (['company_admin', 'gerente', 'caixa'].includes(currentUser.role)) {
            const salesCollectionRef = collection(firestoreDb, `artifacts/${appId}/users/${currentUser.username}/sales`);
            unsubscribeSales = onSnapshot(salesCollectionRef, (snapshot) => {
                console.log("Snapshot de Vendas do Firestore recebido.");
                const salesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setSales(salesData);
                console.log("Vendas carregadas com sucesso!");
            }, (error) => {
                console.error("Erro ao carregar vendas:", error);
                showMessage("Erro ao carregar vendas do Firestore. Verifique as permissões.", "error");
            });
        } else {
            setSales([]);
        }

        // Listener de Usuários da Empresa (APENAS para company_admin)
        if (currentUser.role === 'company_admin') {
            const companyUsersCollectionRef = collection(firestoreDb, `artifacts/${appId}/users/${currentUser.username}/company_users`);
            console.log("Caminho do Listener de Usuários da Empresa do Firestore:", companyUsersCollectionRef.path);
            unsubscribeCompanyUsers = onSnapshot(companyUsersCollectionRef, (snapshot) => {
                console.log("Snapshot de Usuários da Empresa do Firestore recebido.");
                const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setCompanyUsers(usersData);
                console.log("Usuários da empresa carregados com sucesso!", usersData);
            }, (error) => {
                console.error("Erro ao carregar usuários da empresa:", error);
                showMessage("Erro ao carregar usuários da empresa do Firestore. Verifique as permissões.", "error");
            });
        } else {
            setCompanyUsers([]);
        }

        // Listener para a lista de empresas (APENAS para o admin principal)
        if (currentUser.role === 'admin') {
            const companiesCollectionRef = collection(firestoreDb, `artifacts/${appId}/users`);
            const q = query(companiesCollectionRef, where("role", "==", "company_admin"));

            unsubscribeCompanies = onSnapshot(q, (snapshot) => {
                console.log("Snapshot de Empresas do Firestore recebido.");
                const companiesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setCompanies(companiesData);
                console.log("Empresas carregadas com sucesso!");
            }, (error) => {
                console.error("Erro ao carregar empresas:", error);
                showMessage("Erro ao carregar empresas do Firestore. Verifique as permissões.", "error");
            });
        } else {
            setCompanies([]);
        }

        // Função de limpeza para cancelar as inscrições dos listeners
        return () => {
            if (unsubscribeProducts) unsubscribeProducts();
            if (unsubscribeSales) unsubscribeSales();
            if (unsubscribeCompanyUsers) unsubscribeCompanyUsers();
            if (unsubscribeCompanies) unsubscribeCompanies();
            console.log("Listeners do Firestore para Produtos, Vendas, Usuários da Empresa e Empresas desinscritos.");
        };
    }, [firestoreDb, currentUser, appId]); // Depende de firestoreDb e currentUser

    // Efeito para calcular o total do carrinho
    useEffect(() => {
        const newTotal = cart.reduce((sum, item) => sum + (item.value * item.quantity), 0);
        setTotal(newTotal);
    }, [cart]);

    // Efeito para calcular troco/diferença de pagamento
    useEffect(() => {
        const paid = parseFloat(paymentAmount) || 0;
        if (paid >= total) {
            setChange(paid - total);
            setDifference(0);
        } else {
            setChange(0);
            setDifference(total - paid);
        }
    }, [total, paymentAmount]);

    // Adiciona um produto ao carrinho
    const addToCart = (product) => {
        const existingItem = cart.find(item => item.id === product.id);
        if (existingItem) {
            setCart(cart.map(item =>
                item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
            ));
        } else {
            setCart([...cart, { ...product, quantity: 1 }]);
        }
        showMessage(`${product.name} adicionado ao carrinho!`);
    };

    // Remove um produto do carrinho
    const removeFromCart = (productId) => {
        setCart(cart.filter(item => item.id !== productId));
        showMessage("Item removido do carrinho.", "info");
    };

    // Aumenta a quantidade de um item no carrinho
    const increaseQuantity = (productId) => {
        setCart(cart.map(item =>
            item.id === productId ? { ...item, quantity: item.quantity + 1 } : item
        ));
    };

    // Diminui a quantidade de um item no carrinho
    const decreaseQuantity = (productId) => {
        setCart(cart.map(item =>
            item.id === productId && item.quantity > 1 ? { ...item, quantity: item.quantity - 1 } : item
        ).filter(item => item.quantity > 0)); // Remove se a quantidade se tornar 0
    };

    // Finaliza uma venda (dinheiro, cartão ou Pix)
    const finalizeSale = async () => {
        if (cart.length === 0) {
            showMessage("O carrinho está vazio!", "error");
            return;
        }
        if (!firestoreDb || !currentUser || !firebaseAuth) {
            showMessage("Erro: Serviço de banco de dados ou autenticação não disponível.", "error");
            return;
        }
        // Evita múltiplos Pix pendentes
        if (paymentMethod === 'Pix' && isPixPending) {
            showMessage("Já existe um pagamento Pix pendente. Aguarde a confirmação antes de gerar outro.", "error");
            return;
        }

        // Calcula o custo total dos produtos vendidos (CPV)
        const costOfGoodsSold = cart.reduce((sum, item) => sum + ((item.cost || 0) * item.quantity), 0);

        // Prepara os dados básicos da venda
        const baseSaleData = {
            items: cart.map(item => ({
                productId: item.id,
                name: item.name,
                value: item.value,
                cost: item.cost || 0,
                quantity: item.quantity
            })),
            total: total,
            costOfGoodsSold: costOfGoodsSold,
            profit: total - costOfGoodsSold,
            paymentMethod: paymentMethod,
            paymentAmount: parseFloat(paymentAmount) || 0,
            change: change,
            timestamp: new Date(),
            userId: currentUser.username
        };

        let saleId = null; // Para armazenar o ID da venda gerado

        try {
            // Lógica para pagamento Pix
            if (paymentMethod === 'Pix') {
                setIsLoadingPix(true);
                setPixQrCodeData(null); // Limpa dados Pix anteriores

                // 1. Gera um ID de venda único ANTES de qualquer chamada ao backend
                saleId = doc(collection(firestoreDb, `artifacts/${appId}/users/${currentUser.username}/sales`)).id;

                // 2. Cria o documento de venda no Firestore com status 'pending'
                // Isso garante que o documento exista para ser atualizado pelo webhook
                const pixSaleData = {
                    ...baseSaleData,
                    status: 'pending', // Status inicial para Pix
                    payment_id: null, // Será preenchido após a resposta do MP
                    sale_id_frontend: saleId // Salva o ID gerado no frontend
                };
                await setDoc(doc(firestoreDb, `artifacts/${appId}/users/${currentUser.username}/sales`, saleId), pixSaleData);
                showMessage("Iniciando pagamento Pix. Aguardando QR Code...", "info");

                // Obtém o ID Token do usuário Firebase logado
                const idToken = await firebaseAuth.currentUser.getIdToken();

                const response = await fetch(`${FLASK_BACKEND_URL}/pix/generate`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${idToken}`
                    },
                    body: JSON.stringify({
                        amount: total.toFixed(2),
                        description: "Pagamento de Venda",
                        company_username: currentUser.username,
                        sale_id: saleId,
                    }),
                });

                const data = await response.json();

                if (response.ok) {
                    // Adiciona o prefixo data:image/png;base64, se não estiver presente
                    if (data.qr_code_base64 && !data.qr_code_base64.startsWith('data:image/png;base64,')) {
                        data.qr_code_base64 = 'data:image/png;base64,' + data.qr_code_base64;
                    }
                    setPixQrCodeData(data);
                    showMessage("QR Code Pix gerado com sucesso! Aguardando pagamento...", "success");

                    // 3. Atualiza o documento de venda no Firestore com o payment_id do Mercado Pago
                    // Isso é crucial para o webhook encontrar e atualizar
                    await updateDoc(doc(firestoreDb, `artifacts/${appId}/users/${currentUser.username}/sales`, saleId), {
                        payment_id: data.payment_id // Salva o ID de pagamento do Mercado Pago
                    });

                    // Não limpa o carrinho aqui, pois a venda ainda está pendente.
                    // O carrinho será limpo quando o webhook confirmar o pagamento.

                } else {
                    // Se a geração do Pix falhar, remove a venda pendente criada
                    if (saleId) {
                        await deleteDoc(doc(firestoreDb, `artifacts/${appId}/users/${currentUser.username}/sales`, saleId));
                    }
                    showMessage(`Erro ao gerar Pix: ${data.error || 'Erro desconhecido'}`, "error");
                }
            } else {
                // Lógica para Dinheiro e Cartão (não-Pix)
                // Adiciona a venda diretamente ao Firestore com status 'completed'
                const finalSaleData = {
                    ...baseSaleData,
                    status: 'completed' // Status final para Dinheiro/Cartão
                };
                await addDoc(collection(firestoreDb, `artifacts/${appId}/users/${currentUser.username}/sales`), finalSaleData);
                showMessage("Venda finalizada com sucesso!");
            }

            // Limpa o carrinho e redefine os estados APENAS se a venda não for Pix ou se o Pix foi gerado com sucesso
            if (paymentMethod !== 'Pix' || (paymentMethod === 'Pix' && pixQrCodeData)) {
                setCart([]);
                setPaymentAmount('');
                setChange(0);
                setDifference(0);
                setPaymentMethod('Dinheiro');
                setPixQrCodeData(null);
            }

        } catch (e) {
            console.error("Erro ao finalizar venda ou gerar Pix:", e);
            showMessage("Erro ao finalizar venda ou gerar Pix.", "error");
            // Se a venda foi criada mas o Pix falhou, tenta removê-la
            if (saleId && paymentMethod === 'Pix') {
                try {
                    await deleteDoc(doc(firestoreDb, `artifacts/${appId}/users/${currentUser.username}/sales`, saleId));
                } catch (deleteError) {
                    console.error("Erro ao remover venda pendente após falha na geração do Pix:", deleteError);
                }
            }
        } finally {
            setIsLoadingPix(false);
        }
    };

    // Funções de Gerenciamento de Produtos
    const handleAddProduct = async () => {
        if (!newProductName || !newProductValue || !newProductId || newProductCost === '') {
            showMessage("Preencha todos os campos do produto!", "error");
            return;
        }
        if (isNaN(parseFloat(newProductValue)) || isNaN(parseFloat(newProductCost))) {
            showMessage("Valor e custo do produto devem ser números!", "error");
            return;
        }
        if (!firestoreDb || !currentUser) {
            showMessage("Erro: Banco de dados ou usuário não disponível.", "error");
            return;
        }

        const productData = {
            name: newProductName,
            value: parseFloat(newProductValue),
            cost: parseFloat(newProductCost)
        };

        try {
            // Referência ao documento com o ID fornecido pelo usuário
            const productDocRef = doc(firestoreDb, `artifacts/${appId}/users/${currentUser.username}/products`, newProductId);
            const docSnap = await getDoc(productDocRef); // Verifica se o documento já existe

            if (docSnap.exists()) {
                showMessage("ID do produto já existe! Escolha um ID único.", "error");
                return;
            }

            // Usa setDoc para criar um documento com o ID fornecido pelo usuário
            await setDoc(productDocRef, productData);
            showMessage("Produto adicionado com sucesso!");
            setNewProductName('');
            setNewProductValue('');
            setNewProductCost('');
            setNewProductId('');
        } catch (e) {
            console.error("Erro ao adicionar produto: ", e);
            showMessage("Erro ao adicionar produto.", "error");
        }
    };

    const handleEditProduct = (product) => {
        setEditingProduct(product);
        setNewProductName(product.name);
        setNewProductValue(product.value.toString());
        setNewProductCost(product.cost ? product.cost.toString() : '');
        setNewProductId(product.id); // Mantém o ID para exibição, mas não é editável
    };

    const handleUpdateProduct = async () => {
        if (!editingProduct || !newProductName || !newProductValue || newProductCost === '') {
            showMessage("Preencha todos os campos para atualizar!", "error");
            return;
        }
        if (isNaN(parseFloat(newProductValue)) || isNaN(parseFloat(newProductCost))) {
            showMessage("Valor e custo do produto devem ser números!", "error");
            return;
        }
        if (!firestoreDb || !currentUser) {
            showMessage("Erro: Banco de dados ou usuário não disponível.", "error");
            return;
        }

        const productRef = doc(firestoreDb, `artifacts/${appId}/users/${currentUser.username}/products`, editingProduct.id);
        try {
            await updateDoc(productRef, {
                name: newProductName,
                value: parseFloat(newProductValue),
                cost: parseFloat(newProductCost)
            });
            showMessage("Produto atualizado com sucesso!");
            setEditingProduct(null);
            setNewProductName('');
            setNewProductValue('');
            setNewProductCost('');
            setNewProductId('');
        } catch (e) {
            console.error("Erro ao atualizar produto: ", e);
            showMessage("Erro ao atualizar produto.", "error");
        }
    };

    const handleDeleteProduct = async (productId) => {
        if (!firestoreDb || !currentUser) {
            showMessage("Erro: Banco de dados ou usuário não disponível.", "error");
            setShowConfirmModal(false);
            return;
        }
        setConfirmModalMessage(`Tem certeza que deseja excluir o produto com ID: ${productId}?`);
        setConfirmModalAction(() => async () => {
            try {
                const docRef = doc(firestoreDb, `artifacts/${appId}/users/${currentUser.username}/products`, productId);
                await deleteDoc(docRef);
                showMessage("Produto excluído com sucesso!");
            } catch (e) {
                console.error("Erro ao excluir produto:", e);
                if (e.code === 'permission-denied') {
                    showMessage("Erro de permissão: Você não está autorizado a excluir este produto. Verifique as permissões.", "error");
                } else {
                    showMessage("Erro ao excluir produto.", "error");
                }
            } finally {
                setShowConfirmModal(false);
            }
        });
        setConfirmModalPayload(productId);
        setShowConfirmModal(true);
    };

    const cancelEdit = () => {
        setEditingProduct(null);
        setNewProductName('');
        setNewProductValue('');
        setNewProductCost('');
        setNewProductId('');
    };

    // Calcula o relatório de vendas semanal
    const getWeeklySales = () => {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        const weeklySales = sales.filter(sale => {
            // Garante que o timestamp existe e é um Firestore Timestamp
            if (sale.timestamp && typeof sale.timestamp.toDate === 'function') {
                const saleDate = sale.timestamp.toDate();
                return saleDate >= oneWeekAgo;
            }
            return false;
        });

        const salesByDay = {};
        weeklySales.forEach(sale => {
            const saleDate = sale.timestamp.toDate().toLocaleDateString('pt-BR');
            // Soma o lucro em vez do total
            if (!salesByDay[saleDate]) {
                salesByDay[saleDate] = 0;
            }
            salesByDay[saleDate] += sale.profit || (sale.total - (sale.costOfGoodsSold || 0)); // Garante que o lucro seja calculado se não salvo
        });

        // Ordena por data para exibição
        const sortedSales = Object.entries(salesByDay).sort(([dateA], [dateB]) => {
            const [dayA, monthA, yearA] = dateA.split('/').map(Number);
            const [dayB, monthB, yearB] = dateB.split('/').map(Number);
            const dateObjA = new Date(yearA, monthA - 1, dayA);
            const dateObjB = new Date(yearB, monthB - 1, dayB);
            return dateObjA - dateObjB;
        });

        return sortedSales;
    };

    // --- Funções de Autenticação do Backend Flask ---
    const handleLogin = async (e) => {
        e.preventDefault();
        console.log("Tentando login...");
        if (!firebaseAuth) {
            showMessage("A autenticação do Firebase não foi inicializada.", "error");
            return;
        }
        try {
            const response = await fetch(`${FLASK_BACKEND_URL}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username: loginUsername, password: loginPassword }),
            });

            const data = await response.json();
            console.log("Dados da resposta de login:", data);

            if (response.ok) {
                const firebaseToken = data.firebase_token;
                if (firebaseToken) {
                    try {
                        await signInWithCustomToken(firebaseAuth, firebaseToken);
                        showMessage(`Login bem-sucedido! Bem-vindo(a), ${data.username}.`, 'success');
                        // O estado currentUser será atualizado pelo listener onAuthStateChanged
                        setLoginPassword('');
                        // Redireciona para a aba apropriada após o login
                        if (data.role === 'admin') {
                            setActiveTab('gerenciar_empresas');
                        } else {
                            setActiveTab('caixa');
                        }
                    } catch (firebaseError) {
                        console.error("Erro ao autenticar com o token personalizado do Firebase:", firebaseError);
                        showMessage(`Erro ao conectar ao Firebase: ${firebaseError.message}`, 'error');
                        setIsLoggedIn(false);
                        setCurrentUser(null);
                    }
                } else {
                    showMessage("Erro: Token do Firebase não recebido do backend.", "error");
                    console.error("Token do Firebase ausente na resposta do Flask. Dados completos:", data);
                }
            } else {
                showMessage(`Erro de login: ${data.error || 'Credenciais inválidas'}`, 'error');
            }
        } catch (error) {
            console.error('Erro ao conectar ao backend para login:', error);
            showMessage('Erro ao conectar ao servidor. Verifique se o backend está em execução.', 'error');
        }
    };

    const handleLogout = async () => {
        console.log("Tentando logout...");
        if (!firebaseAuth) {
            showMessage("A autenticação do Firebase não foi inicializada.", "error");
            return;
        }
        // Redefine os estados que controlam os listeners ANTES de fazer logout do Firebase Auth
        setIsLoggedIn(false);
        setCurrentUser(null);
        setLoginUsername('');
        setLoginPassword('');
        setCart([]);
        setProducts([]);
        setSales([]);
        setCompanies([]);
        setCompanyUsers([]);
        setPixQrCodeData(null); // Limpa dados do Pix ao sair

        try {
            await signOut(firebaseAuth); // Faz logout do Firebase Auth
            showMessage("Você foi desconectado(a).", "info");
            setActiveTab('caixa'); // Retorna para a aba padrão após o logout
            console.log("Logout bem-sucedido.");
        } catch (error) {
            console.error("Erro ao fazer logout do Firebase:", error);
            showMessage("Erro ao desconectar.", "error");
        }
    };

    // --- Funções de Gerenciamento de Empresas (para o admin principal) ---
    const handleRegisterCompany = async (e) => {
        e.preventDefault();
        if (!newCompanyUsername || !newCompanyPassword || !newCompanyName) {
            showMessage("Preencha todos os campos para registrar a empresa!", "error");
            return;
        }
        console.log("Tentando registrar empresa...");

        try {
            const response = await fetch(`${FLASK_BACKEND_URL}/register_company`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username: newCompanyUsername,
                    password: newCompanyPassword,
                    company_name: newCompanyName,
                    design_theme: newCompanyDesignTheme,
                    mercado_pago_access_token: newCompanyMercadoPagoAccessToken,
                }),
            });

            const data = await response.json();
            console.log("Dados da resposta de registro de empresa:", data);

            if (response.ok) {
                showMessage(`Empresa "${data.company_name}" (Usuário: ${data.username}) registrada com sucesso!`, 'success');
                setNewCompanyUsername('');
                setNewCompanyPassword('');
                setNewCompanyName('');
                setNewCompanyDesignTheme('default');
                setNewCompanyMercadoPagoAccessToken('');
            } else {
                showMessage(`Erro ao registrar empresa: ${data.error || 'Erro desconhecido'}`, "error");
            }
        } catch (error) {
            console.error('Erro ao conectar ao backend para registrar empresa:', error);
            showMessage('Erro ao conectar ao servidor para registrar empresa.', 'error');
        }
    };

    // Função para excluir uma empresa (login)
    const handleDeleteCompany = async (companyIdToDelete) => {
        if (!firebaseAuth || !firebaseAuth.currentUser) {
            showMessage("Erro: Usuário não autenticado.", "error");
            setShowConfirmModal(false);
            return;
        }
        setConfirmModalMessage(`Tem certeza que deseja excluir a empresa ${companyIdToDelete} e TODOS os seus dados (produtos, vendas, etc.)? Esta ação é irreversível!`);
        setConfirmModalAction(() => async () => {
            console.log("Tentando excluir empresa:", companyIdToDelete);
            try {
                const idToken = await firebaseAuth.currentUser.getIdToken();
                const response = await fetch(`${FLASK_BACKEND_URL}/delete_company`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${idToken}`
                    },
                    body: JSON.stringify({ company_username: companyIdToDelete }),
                });

                const data = await response.json();
                console.log("Dados da resposta de exclusão de empresa:", data);

                if (response.ok) {
                    showMessage(`Empresa "${companyIdToDelete}" excluída com sucesso!`, 'success');
                } else {
                    showMessage(`Erro ao excluir empresa: ${data.error || 'Erro desconhecido'}`, "error");
                }
            } catch (error) {
                console.error('Erro ao conectar ao backend para excluir empresa:', error);
                showMessage('Erro ao conectar ao servidor para excluir empresa.', 'error');
            } finally {
                setShowConfirmModal(false);
            }
        });
        setConfirmModalPayload(companyIdToDelete);
        setShowConfirmModal(true);
    };

    // --- Funções de Gerenciamento de Usuários da Empresa (para company_admin) ---
    const handleAddCompanyUser = async (e) => {
        e.preventDefault();
        if (!newCompanyUserUsername || !newCompanyUserPassword || !newCompanyUserRole) {
            showMessage("Preencha todos os campos para adicionar o usuário!", "error");
            return;
        }
        if (!currentUser || !currentUser.username || !firebaseAuth || !firebaseAuth.currentUser) {
            showMessage("Erro: Administrador da empresa não identificado ou não autenticado.", "error");
            return;
        }
        console.log("Tentando adicionar usuário da empresa...");

        try {
            const idToken = await firebaseAuth.currentUser.getIdToken();
            const response = await fetch(`${FLASK_BACKEND_URL}/company_users/add`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`
                },
                body: JSON.stringify({
                    company_id: currentUser.username,
                    username: newCompanyUserUsername,
                    password: newCompanyUserPassword,
                    role: newCompanyUserRole
                }),
            });

            const data = await response.json();
            console.log("Dados da resposta de adição de usuário da empresa:", data);

            if (response.ok) {
                showMessage(`Usuário "${data.username}" (${data.role}) adicionado com sucesso!`, 'success');
                setNewCompanyUserUsername('');
                setNewCompanyUserPassword('');
                setNewCompanyUserRole('caixa');
            } else {
                showMessage(`Erro ao adicionar usuário: ${data.error || 'Erro desconhecido'}`, "error");
            }
        } catch (e) {
            console.error("Erro ao adicionar usuário da empresa: ", e);
            showMessage("Erro ao conectar ao servidor para adicionar usuário.", "error");
        }
    };

    const handleEditCompanyUser = (user) => {
        setEditingCompanyUser(user);
        setNewCompanyUserUsername(user.username);
        setNewCompanyUserRole(user.role);
        setNewCompanyUserPassword(''); // Não carrega a senha por segurança
    };

    const handleUpdateCompanyUser = async (e) => {
        e.preventDefault();
        if (!editingCompanyUser || !newCompanyUserUsername || !newCompanyUserRole) {
            showMessage("Preencha todos os campos para atualizar o usuário!", "error");
            return;
        }
        if (!currentUser || !currentUser.username || !firebaseAuth || !firebaseAuth.currentUser) {
            showMessage("Erro: Administrador da empresa não identificado ou não autenticado.", "error");
            return;
        }
        console.log("Tentando atualizar usuário da empresa:", editingCompanyUser.id);

        try {
            const idToken = await firebaseAuth.currentUser.getIdToken();
            const response = await fetch(`${FLASK_BACKEND_URL}/company_users/update`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`
                },
                body: JSON.stringify({
                    company_id: currentUser.username,
                    user_id: editingCompanyUser.id, // O ID do documento do usuário no Firestore (que é o firebase_uid)
                    username: newCompanyUserUsername,
                    password: newCompanyUserPassword || null, // Envia null se a senha não for alterada
                    role: newCompanyUserRole
                }),
            });

            const data = await response.json();
            console.log("Dados da resposta de atualização de usuário da empresa:", data);

            if (response.ok) {
                showMessage(`Usuário "${data.username}" atualizado com sucesso!`, 'success');
                setEditingCompanyUser(null);
                setNewCompanyUserUsername('');
                setNewCompanyUserPassword('');
                setNewCompanyUserRole('caixa');
            } else {
                showMessage(`Erro ao atualizar usuário: ${data.error || 'Erro desconhecido'}`, "error");
            }
        } catch (e) {
            console.error("Erro ao atualizar usuário da empresa: ", e);
            showMessage("Erro ao conectar ao servidor para atualizar usuário.", "error");
        }
    };

    const handleDeleteCompanyUser = async (userIdToDelete) => {
        if (!currentUser || !currentUser.username || !firebaseAuth || !firebaseAuth.currentUser) {
            showMessage("Erro: Administrador da empresa não identificado ou não autenticado.", "error");
            setShowConfirmModal(false);
            return;
        }
        setConfirmModalMessage(`Tem certeza que deseja excluir o usuário ${userIdToDelete}? Esta ação é irreversível!`);
        setConfirmModalAction(() => async () => {
            console.log("Tentando excluir usuário da empresa:", userIdToDelete);
            try {
                const idToken = await firebaseAuth.currentUser.getIdToken();
                const response = await fetch(`${FLASK_BACKEND_URL}/company_users/delete`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${idToken}`
                    },
                    body: JSON.stringify({
                        company_id: currentUser.username,
                        user_id: userIdToDelete // O ID do documento do usuário no Firestore (que é o firebase_uid)
                    }),
                });

                const data = await response.json();
                console.log("Dados da resposta de exclusão de usuário da empresa:", data);

                if (response.ok) {
                    showMessage(`Usuário "${userIdToDelete}" excluído com sucesso!`, 'success');
                } else {
                    showMessage(`Erro ao excluir usuário: ${data.error || 'Erro desconhecido'}`, "error");
                }
            } catch (e) {
                console.error("Erro ao excluir usuário da empresa:", e);
                showMessage("Erro ao conectar ao servidor para excluir usuário.", "error");
            } finally {
                setShowConfirmModal(false);
            }
        });
        setConfirmModalPayload(userIdToDelete);
        setShowConfirmModal(true);
    };

    const cancelEditCompanyUser = () => {
        setEditingCompanyUser(null);
        setNewCompanyUserUsername('');
        setNewCompanyUserPassword('');
        setNewCompanyUserRole('caixa');
    };

    // Função para copiar a chave Pix para a área de transferência
    const copyPixKeyToClipboard = (key) => {
        // Usa document.execCommand('copy') para compatibilidade em iframes
        const el = document.createElement('textarea');
        el.value = key;
        document.body.appendChild(el);
        el.select();
        try {
            document.execCommand('copy');
            showMessage("Chave Pix copiada!", "success");
        } catch (err) {
            console.error('Erro ao copiar chave Pix:', err);
            showMessage("Falha ao copiar chave Pix.", "error");
        }
        document.body.removeChild(el);
    };

    // Função para cancelar pagamento Pix
    const handleCancelPixPayment = async (paymentId) => {
        if (!currentUser || !currentUser.username || !firebaseAuth || !firebaseAuth.currentUser) {
            showMessage("Erro: Usuário da empresa não identificado para cancelar Pix.", "error");
            setShowConfirmModal(false);
            return;
        }
        setConfirmModalMessage(`Tem certeza que deseja cancelar o pagamento Pix com ID ${paymentId}?`);
        setConfirmModalAction(() => async () => {
            console.log("Tentando cancelar pagamento Pix:", paymentId);

            try {
                const idToken = await firebaseAuth.currentUser.getIdToken();
                const response = await fetch(`${FLASK_BACKEND_URL}/pix/cancel`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${idToken}`
                    },
                    body: JSON.stringify({
                        payment_id: paymentId,
                        company_username: currentUser.username
                    }),
                });

                const data = await response.json();
                console.log("Dados da resposta de cancelamento de Pix:", data);

                if (response.ok) {
                    showMessage(`Pagamento Pix ${paymentId} cancelado com sucesso!`, 'success');
                    // Opcional: Atualizar o status da venda no Firestore no frontend, se necessário
                    // Ou confiar no webhook do Mercado Pago para fazer isso
                } else {
                    showMessage(`Erro ao cancelar Pix: ${data.error || 'Erro desconhecido'}`, "error");
                }
            } catch (error) {
                console.error('Erro ao conectar ao servidor para cancelar Pix:', error);
                showMessage('Erro ao conectar ao servidor para cancelar Pix.', "error");
            } finally {
                setShowConfirmModal(false);
            }
        });
        setConfirmModalPayload(paymentId);
        setShowConfirmModal(true);
    };

    // Filtra produtos com base no termo de pesquisa
    const filteredProducts = products.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Função auxiliar para obter classes Tailwind de forma segura com base no tema
    const getThemeClasses = (element) => {
        const theme = currentUser?.design || DEFAULT_THEMES.default;

        const getColorClass = (prop, defaultColor) => {
            const color = theme[prop];
            if (color && typeof color === 'string' && color.includes('-')) {
                return color; // Já é uma classe Tailwind completa como 'bg-blue-500'
            }
            // Fallback para uma classe de cor Tailwind padrão
            return defaultColor;
        };

        switch (element) {
            case 'gradient_bg': return `bg-gradient-to-br ${getColorClass('gradient_from', 'from-blue-50')} ${getColorClass('gradient_to', 'to-indigo-100')}`;
            case 'primary_button_bg': return getColorClass('primary_button_bg', 'bg-blue-600');
            case 'primary_button_hover_bg': return getColorClass('primary_button_hover_bg', 'hover:bg-blue-700');
            case 'secondary_button_bg': return getColorClass('secondary_button_bg', 'bg-gray-200');
            case 'secondary_button_text': return getColorClass('secondary_button_text', 'text-gray-700');
            case 'secondary_button_hover_bg': return getColorClass('secondary_button_hover_bg', 'hover:bg-gray-100');
            case 'text_color_strong': return getColorClass('text_color_strong', 'text-gray-800');
            case 'text_color_medium': return getColorClass('text_color_medium', 'text-gray-700');
            case 'border_color': return getColorClass('border_color', 'border-blue-200');
            case 'highlight_color': return getColorClass('highlight_color', 'text-blue-600');
            case 'success_color': return getColorClass('success_color', 'bg-green-500');
            case 'error_color': return getColorClass('error_color', 'bg-red-500');
            case 'font_family': return theme.font_family || 'font-sans';
            case 'dominant_color_bg': return getColorClass('dominant_color', 'bg-blue-50');
            default: return '';
        }
    };

    // Efeito para escutar atualizações do status Pix da venda pendente
    useEffect(() => {
        let unsubscribe = null;
        if (
            firestoreDb &&
            currentUser &&
            pixQrCodeData &&
            pixQrCodeData.sale_id_frontend
        ) {
            setIsPixPending(true);
            const saleDocRef = doc(
                firestoreDb,
                `artifacts/${appId}/users/${currentUser.username}/sales`,
                pixQrCodeData.sale_id_frontend
            );
            unsubscribe = onSnapshot(saleDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    const saleData = docSnap.data();
                    if (saleData.status !== pixStatus) {
                        setPixStatus(saleData.status);
                        if (saleData.status === 'approved') {
                            showMessage('Pagamento Pix aprovado! Venda finalizada.', 'success');
                            setCart([]);
                            setPaymentAmount('');
                            setChange(0);
                            setDifference(0);
                            setPaymentMethod('Dinheiro');
                            setPixQrCodeData(null);
                            setPixStatus(null);
                            setIsPixPending(false);
                        } else if (saleData.status === 'cancelled') {
                            showMessage('Pagamento Pix cancelado.', 'error');
                            setPixQrCodeData(null);
                            setPixStatus(null);
                            setIsPixPending(false);
                        } else if (saleData.status === 'pending') {
                            showMessage('Aguardando pagamento Pix...', 'info');
                        }
                    }
                }
            });
        } else {
            setPixStatus(null);
            setIsPixPending(false);
        }
        return () => {
            if (unsubscribe) unsubscribe();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [firestoreDb, currentUser, pixQrCodeData]);

    // Renderiza a tela de login se o usuário não estiver logado
    if (!isLoggedIn) {
        return (
            <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-gray-800">
                {/* Vídeo de fundo para a tela de login */}
                <video
                    autoPlay
                    loop={true}
                    muted
                    playsInline
                    className="absolute z-0 w-full h-full object-cover"
                    src="https://videos.pexels.com/video-files/3752548/3752548-hd_1920_1080_24fps.mp4"
                    onError={(e) => console.error("Erro ao carregar o vídeo de fundo da tela de login:", e)}
                >
                    Seu navegador não suporta a tag de vídeo.
                </video>

                {/* Overlay para legibilidade */}
                <div className="absolute z-10 w-full h-full bg-black opacity-50"></div>

                {message && (
                    <div className={`fixed top-4 right-4 p-3 rounded-lg shadow-lg text-white z-50 transition-opacity duration-300 ${message.type === 'success' ? getThemeClasses('success_color') : getThemeClasses('error_color')}`}>
                        {message.text}
                    </div>
                )}
                <div className="relative z-20 bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
                    <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">
                        Login
                    </h2>
                    <form onSubmit={handleLogin}>
                        <div className="mb-4">
                            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="loginUsername">
                                Nome de Usuário:
                            </label>
                            <input
                                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                id="loginUsername"
                                type="text"
                                placeholder="Nome de Usuário"
                                value={loginUsername}
                                onChange={(e) => setLoginUsername(e.target.value)}
                                required
                            />
                        </div>
                        <div className="mb-6">
                            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="loginPassword">
                                Senha:
                            </label>
                            <input
                                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline"
                                id="loginPassword"
                                type="password"
                                placeholder="********"
                                value={loginPassword}
                                onChange={(e) => setLoginPassword(e.target.value)}
                                required
                            />
                        </div>
                        <div className="flex items-center justify-center">
                            <button
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200"
                                type="submit"
                            >
                                Entrar
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        );
    }

    // Renderiza a aplicação principal se o usuário estiver logado
    const currentDesign = currentUser?.design || DEFAULT_THEMES.default; // Garante que currentDesign não seja nulo

    // Determina se o vídeo de fundo da aba "Gerenciar Empresas" deve estar ativo
    const showCompanyManagementVideo = isLoggedIn && activeTab === 'gerenciar_empresas' && currentUser?.role === 'admin';

    // Define o estilo de fundo dinamicamente (cores/gradiente)
    const backgroundClasses = currentDesign.dominant_color
        ? `${currentDesign.dominant_color}`
        : `${currentDesign.gradient_from || 'from-blue-50'} ${currentDesign.gradient_to || 'to-indigo-100'}`;

    return (
        <div
            className={`min-h-screen p-4 ${getThemeClasses('font_family')} flex flex-col items-center relative`}
        >
            {/* Fundo de vídeo para a aba "Gerenciar Empresas" */}
            {showCompanyManagementVideo ? (
                <>
                    <video
                        autoPlay
                        loop={true}
                        muted
                        playsInline
                        className="absolute z-0 w-full h-full object-cover top-0 left-0"
                        src="https://videos.pexels.com/video-files/30163656/12934691_1920_1080_30fps.mp4"
                        onError={(e) => console.error("Erro ao carregar o vídeo de fundo de Gerenciar Empresas:", e)}
                    >
                        Seu navegador não suporta a tag de vídeo para o fundo de gerenciamento de empresas.
                    </video>
                    <div className="absolute z-10 w-full h-full bg-black opacity-50 top-0 left-0"></div>
                </>
            ) : (
                // Fundo de cor/gradiente para as outras abas
                <div className={`absolute z-0 w-full h-full top-0 left-0 ${backgroundClasses}`}></div>
            )}

            {/* Todo o conteúdo da aplicação com um z-index maior para ficar acima do fundo */}
            <div className="relative z-20 w-full flex flex-col items-center">
                {/* Exibição do ID do Usuário */}
                {currentUser && (
                    <div className="absolute top-4 left-4 bg-white p-2 rounded-lg shadow-md text-sm text-gray-700">
                        Usuário Logado: <span className="font-semibold">{currentUser.username}</span> (Função: {currentUser.role})
                        {currentUser.company_name && (
                            <span className="ml-2">Empresa: {currentUser.company_name}</span>
                        )}
                        <button
                            onClick={handleLogout}
                            className="ml-4 bg-red-500 hover:bg-red-600 text-white text-xs px-2 py-1 rounded-full transition-colors duration-200"
                        >
                            Sair
                        </button>
                    </div>
                )}

                {/* Caixa de Mensagens */}
                {message && (
                    <div className={`fixed top-4 right-4 p-3 rounded-lg shadow-lg text-white z-50 transition-opacity duration-300 ${message.type === 'success' ? getThemeClasses('success_color') : getThemeClasses('error_color')}`}>
                        {message.text}
                    </div>
                )}

                <h1 className={`text-4xl font-extrabold ${getThemeClasses('text_color_strong')} mb-8 mt-4 rounded-xl p-3 bg-white shadow-lg`}>
                    Gerenciador de Caixa
                </h1>

                {/* Abas de Navegação */}
                <div className="flex space-x-4 mb-8 bg-white p-2 rounded-full shadow-md">
                    {/* Aba Caixa - Visível para company_admin, gerente, caixa */}
                    {(currentUser.role === 'company_admin' || currentUser.role === 'gerente' || currentUser.role === 'caixa') && (
                        <button
                            onClick={() => setActiveTab('caixa')}
                            className={`px-6 py-3 rounded-full text-lg font-medium transition-all duration-300 ${activeTab === 'caixa' ? `${getThemeClasses('primary_button_bg')} text-white shadow-lg` : `${getThemeClasses('secondary_button_bg')} ${getThemeClasses('secondary_button_text')} ${getThemeClasses('secondary_button_hover_bg')}`}`}
                        >
                            Caixa
                        </button>
                    )}
                    {/* Aba Produtos - Visível para company_admin e gerente */}
                    {(currentUser.role === 'company_admin' || currentUser.role === 'gerente') && (
                        <button
                            onClick={() => setActiveTab('produtos')}
                            className={`px-6 py-3 rounded-full text-lg font-medium transition-all duration-300 ${activeTab === 'produtos' ? `${getThemeClasses('primary_button_bg')} text-white shadow-lg` : `${getThemeClasses('secondary_button_bg')} ${getThemeClasses('secondary_button_text')} ${getThemeClasses('secondary_button_hover_bg')}`}`}
                        >
                            Produtos
                        </button>
                    )}
                    {/* Aba Relatórios - Visível para company_admin e gerente */}
                    {(currentUser.role === 'company_admin' || currentUser.role === 'gerente') && (
                        <button
                            onClick={() => setActiveTab('relatorios')}
                            className={`px-6 py-3 rounded-full text-lg font-medium transition-all duration-300 ${activeTab === 'relatorios' ? `${getThemeClasses('primary_button_bg')} text-white shadow-lg` : `${getThemeClasses('secondary_button_bg')} ${getThemeClasses('secondary_button_text')} ${getThemeClasses('secondary_button_hover_bg')}`}`}
                        >
                            Relatórios
                        </button>
                    )}
                    {/* Aba Gerenciar Usuários - Visível APENAS para company_admin */}
                    {currentUser.role === 'company_admin' && (
                        <button
                            onClick={() => setActiveTab('gerenciar_usuarios')}
                            className={`px-6 py-3 rounded-full text-lg font-medium transition-all duration-300 ${activeTab === 'gerenciar_usuarios' ? `${getThemeClasses('primary_button_bg')} text-white shadow-lg` : `${getThemeClasses('secondary_button_bg')} ${getThemeClasses('secondary_button_text')} ${getThemeClasses('secondary_button_hover_bg')}`}`}
                        >
                            Gerenciar Usuários
                        </button>
                    )}
                    {/* Aba Gerenciar Empresas - Visível APENAS para o admin principal */}
                    {currentUser.role === 'admin' && (
                        <button
                            onClick={() => setActiveTab('gerenciar_empresas')}
                            className={`px-6 py-3 rounded-full text-lg font-medium transition-all duration-300 ${activeTab === 'gerenciar_empresas' ? `${getThemeClasses('primary_button_bg')} text-white shadow-lg` : `${getThemeClasses('secondary_button_bg')} ${getThemeClasses('secondary_button_text')} ${getThemeClasses('secondary_button_hover_bg')}`}`}
                        >
                            Gerenciar Empresas
                        </button>
                    )}
                </div>

                {/* Conteúdo da Aba Caixa (Visível para company_admin, gerente, caixa) */}
                {(activeTab === 'caixa' && (currentUser.role === 'company_admin' || currentUser.role === 'gerente' || currentUser.role === 'caixa')) && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 w-full max-w-7xl">
                        {/* Lista de Produtos */}
                        <div className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-xl">
                            <h2 className={`text-2xl font-bold ${getThemeClasses('text_color_medium')} mb-4 pb-2 border-b-2 ${getThemeClasses('border_color')}`}>
                                Produtos Disponíveis
                            </h2>
                            {/* Barra de Pesquisa */}
                            <div className="mb-4">
                                <input
                                    type="text"
                                    placeholder="Pesquisar produto por nome ou ID..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                            <div className="max-h-96 overflow-y-auto">
                                {filteredProducts.length === 0 ? (
                                    <p className="text-gray-500">Nenhum produto encontrado ou registrado.</p>
                                ) : (
                                    filteredProducts.map(product => (
                                        <div key={product.id} className="flex justify-between items-center bg-gray-50 p-3 mb-2 rounded-lg shadow-sm">
                                            <div>
                                                <p className={`font-semibold ${getThemeClasses('text_color_strong')}`}>{product.name} (ID: {product.id})</p>
                                                <p className={`${getThemeClasses('highlight_color')} font-bold`}>R$ {product.value.toFixed(2)}</p>
                                            </div>
                                            <button
                                                onClick={() => addToCart(product)}
                                                className={`bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-full transition-colors duration-200 shadow-md`}
                                            >
                                                Adicionar
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Carrinho e Pagamento */}
                        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-xl flex flex-col">
                            <h2 className={`text-2xl font-bold ${getThemeClasses('text_color_medium')} mb-4 pb-2 border-b-2 ${getThemeClasses('border_color')}`}>
                                Carrinho de Compras
                            </h2>
                            <div className="flex-grow max-h-80 overflow-y-auto mb-4">
                                {cart.length === 0 ? (
                                    <p className="text-gray-500">O carrinho está vazio.</p>
                                ) : (
                                    cart.map(item => (
                                        <div key={item.id} className="flex justify-between items-center bg-gray-50 p-3 mb-2 rounded-lg shadow-sm">
                                            <div>
                                                <p className={`font-semibold ${getThemeClasses('text_color_strong')}`}>{item.name}</p>
                                                <p className="text-gray-600">R$ {item.value.toFixed(2)} x {item.quantity}</p>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <button
                                                    onClick={() => decreaseQuantity(item.id)}
                                                    className="bg-red-400 hover:bg-red-500 text-white w-8 h-8 rounded-full flex items-center justify-center text-lg font-bold"
                                                >
                                                    -
                                                </button>
                                                <span className="font-bold text-lg">{item.quantity}</span>
                                                <button
                                                    onClick={() => increaseQuantity(item.id)}
                                                    className="bg-green-400 hover:bg-green-500 text-white w-8 h-8 rounded-full flex items-center justify-center text-lg font-bold"
                                                >
                                                    +
                                                </button>
                                                <button
                                                    onClick={() => removeFromCart(item.id)}
                                                    className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-full text-sm shadow-md"
                                                >
                                                    Remover
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            <div className={`mt-auto pt-4 border-t-2 ${getThemeClasses('border_color')}`}>
                                <div className={`flex justify-between items-center text-2xl font-bold ${getThemeClasses('text_color_strong')} mb-4`}>
                                    <span>Total:</span>
                                    <span>R$ {total.toFixed(2)}</span>
                                </div>

                                <div className="mb-4">
                                    <label htmlFor="paymentMethod" className={`block ${getThemeClasses('text_color_medium')} text-lg font-semibold mb-2`}>Método de Pagamento:</label>
                                    <select
                                        id="paymentMethod"
                                        value={paymentMethod}
                                        onChange={(e) => {
                                            setPaymentMethod(e.target.value);
                                            setPixQrCodeData(null); // Limpa dados do Pix ao mudar o método
                                        }}
                                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-lg"
                                    >
                                        <option value="Dinheiro">Dinheiro</option>
                                        <option value="Cartao">Cartão</option>
                                        <option value="Pix">Pix</option>
                                    </select>
                                </div>

                                {paymentMethod === 'Dinheiro' && (
                                    <div className="mb-4">
                                        <label htmlFor="paymentAmount" className={`block ${getThemeClasses('text_color_medium')} text-lg font-semibold mb-2`}>Valor Pago:</label>
                                        <input
                                            type="number"
                                            id="paymentAmount"
                                            value={paymentAmount}
                                            onChange={(e) => setPaymentAmount(e.target.value)}
                                            placeholder="R$ 0.00"
                                            step="0.01"
                                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-lg"
                                        />
                                    </div>
                                )}

                                {paymentMethod === 'Pix' && (
                                    <div className="mb-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200 text-yellow-800">
                                        <p className="font-semibold">Funcionalidade Pix:</p>
                                        <p className="text-sm">
                                            Para gerar o QR Code Pix, o aplicativo fará uma requisição ao seu backend Flask.
                                        </p>
                                        {pixStatus && (
                                            <div className="my-2">
                                                {pixStatus === 'pending' && (
                                                    <span className="text-yellow-600 font-semibold">Status: Aguardando pagamento...</span>
                                                )}
                                                {pixStatus === 'approved' && (
                                                    <span className="text-green-600 font-semibold">Status: Pagamento aprovado!</span>
                                                )}
                                                {pixStatus === 'cancelled' && (
                                                    <span className="text-red-600 font-semibold">Status: Pagamento cancelado.</span>
                                                )}
                                            </div>
                                        )}
                                        {isLoadingPix ? (
                                            <div className="flex justify-center items-center py-4">
                                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
                                                <p className="ml-3">Gerando QR Code...</p>
                                            </div>
                                        ) : pixQrCodeData ? (
                                            <div className="mt-3 text-center">
                                                {/* Imagem do QR Code (usando base64 do backend) */}
                                                <img
                                                    src={pixQrCodeData.qr_code_base64 || `https://placehold.co/150x150/E0F2F7/000000?text=QR+Code+Pix`}
                                                    alt="QR Code Pix"
                                                    className="mx-auto rounded-lg shadow-md w-64 h-64"
                                                />
                                                <p className="mt-2 text-sm text-gray-700">
                                                    Chave "Copia e Cola":
                                                </p>
                                                <div className="flex items-center justify-center mt-1">
                                                    <input
                                                        type="text"
                                                        readOnly
                                                        value={pixQrCodeData.copy_paste_key}
                                                        className="flex-grow p-2 border border-gray-300 rounded-l-lg text-sm bg-gray-100"
                                                    />
                                                    <button
                                                        onClick={() => copyPixKeyToClipboard(pixQrCodeData.copy_paste_key)}
                                                        className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-r-lg text-sm"
                                                    >
                                                        Copiar
                                                    </button>
                                                </div>
                                                {/* Botão para Cancelar Pagamento Pix */}
                                                {pixQrCodeData.payment_id && (
                                                    <button
                                                        onClick={() => handleCancelPixPayment(pixQrCodeData.payment_id)}
                                                        className="mt-4 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm shadow-md"
                                                    >
                                                        Cancelar Pagamento Pix
                                                    </button>
                                                )}
                                                <p className="mt-2 text-xs text-gray-600">
                                                    * Em um cenário real, a venda seria finalizada após a confirmação do pagamento Pix via webhook.
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="mt-3 text-center">
                                                {/* Placeholder para QR Code antes da geração */}
                                                <img
                                                    src="https://placehold.co/150x150/E0F2F7/000000?text=QR+Code+Pix"
                                                    alt="Placeholder QR Code Pix"
                                                    className="mx-auto rounded-lg shadow-md w-64 h-64"
                                                />
                                                <p className="mt-2 text-xs text-gray-600">
                                                    Clique em "Finalizar Venda" para gerar o QR Code.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className={`flex justify-between items-center text-xl ${getThemeClasses('text_color_medium')} mb-2`}>
                                    <span>Diferença:</span>
                                    <span className="font-bold text-red-600">R$ {difference.toFixed(2)}</span>
                                </div>
                                <div className={`flex justify-between items-center text-xl ${getThemeClasses('text_color_medium')} mb-4`}>
                                    <span>Troco:</span>
                                    <span className="font-bold text-green-600">R$ {change.toFixed(2)}</span>
                                </div>

                                <button
                                    onClick={finalizeSale}
                                    className={`w-full ${getThemeClasses('primary_button_bg')} ${getThemeClasses('primary_button_hover_bg')} text-white text-xl font-bold py-4 rounded-xl transition-all duration-300 shadow-lg transform hover:scale-105`}
                                    disabled={paymentMethod === 'Pix' && isPixPending}
                                >
                                    {paymentMethod === 'Pix' && isPixPending ? "Aguardando pagamento Pix..." : "Finalizar Venda"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Conteúdo da Aba Produtos (Visível para company_admin e gerente) */}
                {(activeTab === 'produtos' && (currentUser.role === 'company_admin' || currentUser.role === 'gerente')) && (
                    <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-4xl">
                        <h2 className={`text-3xl font-bold ${getThemeClasses('text_color_medium')} mb-6 pb-3 border-b-2 ${getThemeClasses('border_color')}`}>
                            {editingProduct ? 'Editar Produto' : 'Adicionar Novo Produto'}
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            <div>
                                <label htmlFor="newProductId" className={`block ${getThemeClasses('text_color_medium')} font-semibold mb-2`}>ID do Produto:</label>
                                <input
                                    type="text"
                                    id="newProductId"
                                    value={newProductId}
                                    onChange={(e) => setNewProductId(e.target.value)}
                                    placeholder="Ex: PROD001"
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                    disabled={!!editingProduct} // Desabilita a entrada de ID ao editar
                                />
                            </div>
                            <div>
                                <label htmlFor="newProductName" className={`block ${getThemeClasses('text_color_medium')} font-semibold mb-2`}>Nome do Produto:</label>
                                <input
                                    type="text"
                                    id="newProductName"
                                    value={newProductName}
                                    onChange={(e) => setNewProductName(e.target.value)}
                                    placeholder="Ex: Refrigerante"
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                            <div>
                                <label htmlFor="newProductValue" className={`block ${getThemeClasses('text_color_medium')} font-semibold mb-2`}>Valor (R$):</label>
                                <input
                                    type="number"
                                    id="newProductValue"
                                    value={newProductValue}
                                    onChange={(e) => setNewProductValue(e.target.value)}
                                    placeholder="Ex: 5.50"
                                    step="0.01"
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                            {/* Campo para Custo do Produto */}
                            <div>
                                <label htmlFor="newProductCost" className={`block ${getThemeClasses('text_color_medium')} font-semibold mb-2`}>Custo (R$):</label>
                                <input
                                    type="number"
                                    id="newProductCost"
                                    value={newProductCost}
                                    onChange={(e) => setNewProductCost(e.target.value)}
                                    placeholder="Ex: 2.00"
                                    step="0.01"
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end space-x-4">
                            {editingProduct ? (
                                <>
                                    <button
                                        onClick={handleUpdateProduct}
                                        className={`bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-bold transition-all duration-300 shadow-md transform hover:scale-105`}
                                    >
                                        Atualizar Produto
                                    </button>
                                    <button
                                        onClick={cancelEdit}
                                        className={`bg-gray-500 hover:bg-gray-600 text-white px-6 py-3 rounded-xl font-bold transition-all duration-300 shadow-md transform hover:scale-105`}
                                    >
                                        Cancelar
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={handleAddProduct}
                                    className={`${getThemeClasses('primary_button_bg')} ${getThemeClasses('primary_button_hover_bg')} text-white px-6 py-3 rounded-xl font-bold transition-all duration-300 shadow-md transform hover:scale-105`}
                                >
                                    Adicionar Produto
                                </button>
                            )}
                        </div>

                        <h3 className={`text-2xl font-bold ${getThemeClasses('text_color_medium')} mt-10 mb-4 pb-2 border-b-2 ${getThemeClasses('border_color')}`}>
                            Lista de Produtos
                        </h3>
                        <div className="max-h-96 overflow-y-auto">
                            {products.length === 0 ? (
                                <p className="text-gray-500">Nenhum produto registrado.</p>
                            ) : (
                                <ul className="space-y-3">
                                    {products.map(product => (
                                        <li key={product.id} className="flex justify-between items-center bg-gray-50 p-4 rounded-lg shadow-sm">
                                            <div>
                                                <p className={`font-semibold ${getThemeClasses('text_color_strong')} text-lg`}>Produto: {product.name} (ID: {product.id})</p>
                                                <p className={`${getThemeClasses('highlight_color')} font-bold text-xl`}>R$ {product.value.toFixed(2)}</p>
                                                <p className="text-gray-600 text-sm">Custo: R$ {product.cost ? product.cost.toFixed(2) : '0.00'}</p>
                                            </div>
                                            <div className="flex space-x-3">
                                                <button
                                                    onClick={() => handleEditProduct(product)}
                                                    className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-full transition-colors duration-200 shadow-md"
                                                >
                                                    Editar
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteProduct(product.id)}
                                                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-full transition-colors duration-200 shadow-md"
                                                >
                                                    Excluir
                                                </button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                )}

                {/* Conteúdo da Aba Relatórios (Visível para company_admin e gerente) */}
                {(activeTab === 'relatorios' && (currentUser.role === 'company_admin' || currentUser.role === 'gerente')) && (
                    <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-4xl">
                        <h2 className={`text-3xl font-bold ${getThemeClasses('text_color_medium')} mb-6 pb-3 border-b-2 ${getThemeClasses('border_color')}`}>
                            Relatório de Lucro Semanal
                        </h2>
                        {sales.length === 0 ? (
                            <p className="text-gray-500">Nenhuma venda registrada ainda.</p>
                        ) : (
                            <div className="max-h-96 overflow-y-auto">
                                <table className="min-w-full bg-white rounded-lg shadow-md">
                                    <thead className={`${getThemeClasses('primary_button_bg')} text-white`}>
                                        <tr>
                                            <th className="py-3 px-4 text-left text-sm font-semibold uppercase">Data</th>
                                            <th className="py-3 px-4 text-left text-sm font-semibold uppercase">Lucro Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {getWeeklySales().map(([date, profit]) => (
                                            <tr key={date} className="hover:bg-gray-50">
                                                <td className={`py-3 px-4 ${getThemeClasses('text_color_strong')}`}>
                                                    {date}
                                                </td>
                                                <td className="py-3 px-4 text-green-600 font-bold">R$ {profit.toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {getWeeklySales().length === 0 && (
                                    <p className="text-gray-500 mt-4">Nenhuma venda na última semana.</p>
                                )}
                            </div>
                        )}

                        <h3 className={`text-2xl font-bold ${getThemeClasses('text_color_medium')} mt-10 mb-4 pb-2 border-b-2 ${getThemeClasses('border_color')}`}>
                            Todas as Vendas
                        </h3>
                        <div className="max-h-96 overflow-y-auto">
                            {sales.length === 0 ? (
                                <p className="text-gray-500">Nenhuma venda registrada ainda.</p>
                            ) : (
                                <table className="min-w-full bg-white rounded-lg shadow-md">
                                    <thead className={`${getThemeClasses('primary_button_bg')} text-white`}>
                                        <tr>
                                            <th className="py-3 px-4 text-left text-sm font-semibold uppercase">Data/Hora</th>
                                            <th className="py-3 px-4 text-left text-sm font-semibold uppercase">Itens</th>
                                            <th className="py-3 px-4 text-left text-sm font-semibold uppercase">Total</th>
                                            <th className="py-3 px-4 text-left text-sm font-semibold uppercase">Custo</th>
                                            <th className="py-3 px-4 text-left text-sm font-semibold uppercase">Lucro</th>
                                            <th className="py-3 px-4 text-left text-sm font-semibold uppercase">Método</th>
                                            <th className="py-3 px-4 text-left text-sm font-semibold uppercase">Status</th>
                                            <th className="py-3 px-4 text-left text-sm font-semibold uppercase">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {sales.map(sale => (
                                            <tr key={sale.id} className="hover:bg-gray-50">
                                                <td className={`py-3 px-4 ${getThemeClasses('text_color_strong')}`}>
                                                    {sale.timestamp && typeof sale.timestamp.toDate === 'function' ? sale.timestamp.toDate().toLocaleString('pt-BR') : 'N/A'}
                                                </td>
                                                <td className={`py-3 px-4 ${getThemeClasses('text_color_medium')}`}>
                                                    {sale.items.map(item => (
                                                        <p key={item.productId}>{item.name} (x{item.quantity})</p>
                                                    ))}
                                                </td>
                                                <td className="py-3 px-4 text-green-600 font-bold">R$ {sale.total.toFixed(2)}</td>
                                                <td className="py-3 px-4 text-gray-600">R$ {(sale.costOfGoodsSold || 0).toFixed(2)}</td>
                                                <td className="py-3 px-4 text-purple-600 font-bold">R$ ${(sale.profit || (sale.total - (sale.costOfGoodsSold || 0))).toFixed(2)}</td>
                                                <td className={`py-3 px-4 ${getThemeClasses('text_color_medium')}`}>{sale.paymentMethod}</td>
                                                <td className={`py-3 px-4 ${getThemeClasses('text_color_medium')}`}>
                                                    {sale.paymentMethod === 'Pix' && sale.status === 'pending' ? (
                                                        <span className="text-yellow-600 font-semibold">Pendente</span>
                                                    ) : sale.paymentMethod === 'Pix' && sale.status === 'approved' ? (
                                                        <span className="text-green-600 font-semibold">Aprovado</span>
                                                    ) : sale.paymentMethod === 'Pix' && sale.status === 'cancelled' ? (
                                                        <span className="text-red-600 font-semibold">Cancelado</span>
                                                    ) : (
                                                        <span className="text-gray-600">N/A</span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4">
                                                    {sale.paymentMethod === 'Pix' && sale.status === 'pending' && (
                                                        <button
                                                            onClick={() => handleCancelPixPayment(sale.payment_id)}
                                                            className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-full text-sm shadow-md"
                                                        >
                                                            Cancelar Pix
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                )}

                {/* Conteúdo da Aba Gerenciar Usuários (Visível APENAS para company_admin) */}
                {activeTab === 'gerenciar_usuarios' && currentUser.role === 'company_admin' && (
                    <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-4xl">
                        <h2 className={`text-3xl font-bold ${getThemeClasses('text_color_medium')} mb-6 pb-3 border-b-2 ${getThemeClasses('border_color')}`}>
                            {editingCompanyUser ? 'Editar Usuário da Empresa' : 'Adicionar Novo Usuário da Empresa'}
                        </h2>
                        <form onSubmit={editingCompanyUser ? handleUpdateCompanyUser : handleAddCompanyUser} className="space-y-4 mb-8">
                            <div>
                                <label htmlFor="newCompanyUserUsername" className={`block ${getThemeClasses('text_color_medium')} font-semibold mb-2`}>Nome de Usuário:</label>
                                <input
                                    type="text"
                                    id="newCompanyUserUsername"
                                    value={newCompanyUserUsername}
                                    onChange={(e) => setNewCompanyUserUsername(e.target.value)}
                                    placeholder="Ex: caixa01"
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                    required
                                    disabled={!!editingCompanyUser} // Desabilita a edição do nome de usuário
                                />
                            </div>
                            <div>
                                <label htmlFor="newCompanyUserPassword" className={`block ${getThemeClasses('text_color_medium')} font-semibold mb-2`}>Senha:</label>
                                <input
                                    type="password"
                                    id="newCompanyUserPassword"
                                    value={newCompanyUserPassword}
                                    onChange={(e) => setNewCompanyUserPassword(e.target.value)}
                                    placeholder={editingCompanyUser ? "Deixe em branco para manter a senha atual" : "********"}
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                    required={!editingCompanyUser} // A senha é obrigatória apenas ao adicionar
                                />
                            </div>
                            <div>
                                <label htmlFor="newCompanyUserRole" className={`block ${getThemeClasses('text_color_medium')} font-semibold mb-2`}>Função:</label>
                                <select
                                    id="newCompanyUserRole"
                                    value={newCompanyUserRole}
                                    onChange={(e) => setNewCompanyUserRole(e.target.value)}
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                    required
                                >
                                    <option value="caixa">Caixa</option>
                                    <option value="gerente">Gerente</option>
                                    {/* company_admin não pode criar outro company_admin */}
                                </select>
                            </div>
                            <div className="flex justify-end space-x-4">
                                {editingCompanyUser ? (
                                    <>
                                        <button
                                            type="submit"
                                            className={`bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-bold transition-all duration-300 shadow-md transform hover:scale-105`}
                                        >
                                            Atualizar Usuário
                                        </button>
                                        <button
                                            type="button"
                                            onClick={cancelEditCompanyUser}
                                            className={`bg-gray-500 hover:bg-gray-600 text-white px-6 py-3 rounded-xl font-bold transition-all duration-300 shadow-md transform hover:scale-105`}
                                        >
                                            Cancelar
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        type="submit"
                                        className={`${getThemeClasses('primary_button_bg')} ${getThemeClasses('primary_button_hover_bg')} text-white px-6 py-3 rounded-xl font-bold transition-all duration-300 shadow-md transform hover:scale-105`}
                                >
                                        Adicionar Usuário
                                    </button>
                                )}
                            </div>
                        </form>

                        <h3 className={`text-2xl font-bold ${getThemeClasses('text_color_medium')} mt-10 mb-4 pb-2 border-b-2 ${getThemeClasses('border_color')}`}>
                            Usuários da Empresa
                        </h3>
                        <div className="max-h-96 overflow-y-auto">
                            {companyUsers.length === 0 ? (
                                <p className="text-gray-500">Nenhum usuário registrado para esta empresa.</p>
                            ) : (
                                <ul className="space-y-3">
                                    {companyUsers.map(user => (
                                        <li key={user.id} className="flex justify-between items-center bg-gray-50 p-4 rounded-lg shadow-sm">
                                            <div>
                                                <p className={`font-semibold ${getThemeClasses('text_color_strong')} text-lg`}>Usuário: {user.username}</p>
                                                <p className="text-gray-600 text-sm">Função: {user.role}</p>
                                                {/* Opcional: Exibir firebase_uid para depuração */}
                                                {/* <p className="text-gray-400 text-xs">UID: {user.firebase_uid}</p> */}
                                            </div>
                                            <div className="flex space-x-3">
                                                <button
                                                    onClick={() => handleEditCompanyUser(user)}
                                                    className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-full transition-colors duration-200 shadow-md"
                                                >
                                                    Editar
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteCompanyUser(user.id)}
                                                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-full transition-colors duration-200 shadow-md"
                                                >
                                                    Excluir
                                                </button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                )}

                {/* Conteúdo da Aba Gerenciar Empresas (Visível APENAS para o admin principal) */}
                {activeTab === 'gerenciar_empresas' && currentUser.role === 'admin' && (
                    <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-4xl">
                        <h2 className={`text-3xl font-bold ${getThemeClasses('text_color_medium')} mb-6 pb-3 border-b-2 ${getThemeClasses('border_color')}`}>
                            Registrar Nova Empresa
                        </h2>
                        <form onSubmit={handleRegisterCompany} className="space-y-4 mb-8">
                            <div>
                                <label htmlFor="newCompanyUsername" className={`block ${getThemeClasses('text_color_medium')} font-semibold mb-2`}>Nome de Usuário da Empresa (ID):</label>
                                <input
                                    type="text"
                                    id="newCompanyUsername"
                                    value={newCompanyUsername}
                                    onChange={(e) => setNewCompanyUsername(e.target.value)}
                                    placeholder="Ex: empresa_abc"
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                    required
                                />
                            </div>
                            <div>
                                <label htmlFor="newCompanyPassword" className={`block ${getThemeClasses('text_color_medium')} font-semibold mb-2`}>Senha da Empresa:</label>
                                <input
                                    type="password"
                                    id="newCompanyPassword"
                                    value={newCompanyPassword}
                                    onChange={(e) => setNewCompanyPassword(e.target.value)}
                                    placeholder="********"
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                    required
                                />
                            </div>
                            <div>
                                <label htmlFor="newCompanyName" className={`block ${getThemeClasses('text_color_medium')} font-semibold mb-2`}>Nome Completo da Empresa:</label>
                                <input
                                    type="text"
                                    id="newCompanyName"
                                    value={newCompanyName}
                                    onChange={(e) => setNewCompanyName(e.target.value)}
                                    placeholder="Ex: ABC Comércio e Serviços Ltda."
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                    required
                                />
                            </div>
                            <div>
                                <label htmlFor="newCompanyDesignTheme" className={`block ${getThemeClasses('text_color_medium')} font-semibold mb-2`}>Tema de Design (Cores/Fontes):</label>
                                <select
                                    id="newCompanyDesignTheme"
                                    value={newCompanyDesignTheme}
                                    onChange={(e) => setNewCompanyDesignTheme(e.target.value)}
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                >
                                    <option value="default">Padrão</option>
                                    <option value="corporate">Corporativo</option>
                                    <option value="vibrant">Vibrante</option>
                                </select>
                            </div>
                            <div>
                                <label htmlFor="newCompanyMercadoPagoAccessToken" className={`block ${getThemeClasses('text_color_medium')} font-semibold mb-2`}>Mercado Pago Access Token:</label>
                                <input
                                    type="text"
                                    id="newCompanyMercadoPagoAccessToken"
                                    value={newCompanyMercadoPagoAccessToken}
                                    onChange={(e) => setNewCompanyMercadoPagoAccessToken(e.target.value)}
                                    placeholder="Token MP (ex: APP_USR-xxxxxxxxxxxx)"
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                            <div className="flex justify-end">
                                <button
                                    type="submit"
                                    onClick={handleRegisterCompany}
                                    className={`bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-bold transition-all duration-300 shadow-md transform hover:scale-105`}
                                >
                                    Registrar Empresa
                                </button>
                            </div>
                        </form>

                        <h3 className={`text-2xl font-bold ${getThemeClasses('text_color_medium')} mt-10 mb-4 pb-2 border-b-2 ${getThemeClasses('border_color')}`}>
                            Empresas Registradas
                        </h3>
                        <div className="max-h-96 overflow-y-auto">
                            {companies.length === 0 ? (
                                <p className="text-gray-500">Nenhuma empresa registrada ainda.</p>
                            ) : (
                                <ul className="space-y-3">
                                    {companies.map(company => (
                                        <li key={company.id} className="flex justify-between items-center bg-gray-50 p-4 rounded-lg shadow-sm">
                                            <div>
                                                <p className={`font-semibold ${getThemeClasses('text_color_strong')} text-lg`}>Nome: {company.company_name}</p>
                                                <p className="text-gray-600 text-sm">Usuário (ID): {company.id}</p>
                                                <p className="text-gray-600 text-sm">Tema: {company.design_theme}</p>
                                            </div>
                                            <div className="flex space-x-3">
                                                <button
                                                    onClick={() => handleDeleteCompany(company.id)}
                                                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-full transition-colors duration-200 shadow-md"
                                                >
                                                    Excluir Empresa
                                                </button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                )}
            </div>
            {showConfirmModal && (
                <ConfirmModal
                    message={confirmModalMessage}
                    onConfirm={() => {
                        if (confirmModalAction) {
                            confirmModalAction(confirmModalPayload);
                        }
                    }}
                    onCancel={() => setShowConfirmModal(false)}
                />
            )}
        </div>
    );
};

export default App;
