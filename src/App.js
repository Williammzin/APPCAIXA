/* global __app_id */ // '__initial_auth_token' removido daqui
import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query, where, setDoc, getDoc } from 'firebase/firestore'; // 'getDocs' removido

// Firebase configuration and initialization
// Your specific Firebase project configuration is now hardcoded here for local development.
const firebaseConfig = {
    apiKey: "AIzaSyDNIJRlw0mJP349owctGbO58VZWGa0LtQs",
    authDomain: "caixa-1bd0c.firebaseapp.com",
    projectId: "caixa-1bd0c",
    storageBucket: "caixa-1bd0c.firebaseastorage.app",
    messagingSenderId: "651091159828",
    appId: "1:651091159828:web:1043424c00f4e71bf97001",
    measurementId: "G-4NJ0F95DVJ"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
// Removido: const storage = getStorage(app); // Inicializa o Firebase Storage

// Global variables for app ID (from Canvas environment)
const appId = typeof __app_id !== 'undefined' ? __app_id : 'local-app-id';
// Removido: initialAuthToken não é usado e estava causando erro de compilação.
// const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;


// URL base do seu backend Flask (AGORA APONTA PARA O KOYEB)
// ATENÇÃO: SUBSTITUA 'https://old-owl-williammzin-cd2d4d31.koyeb.app' PELA URL REAL DO SEU BACKEND KOYEB!
const FLASK_BACKEND_URL = 'https://old-owl-williammzin-cd2d4d31.koyeb.app';

// Main App Component
const App = () => {
    const [products, setProducts] = useState([]);
    const [cart, setCart] = useState([]);
    const [total, setTotal] = useState(0);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [change, setChange] = useState(0);
    const [difference, setDifference] = useState(0);
    const [paymentMethod, setPaymentMethod] = useState('Dinheiro');
    const [sales, setSales] = useState([]);
    // Atualizado: 'caixa', 'produtos', 'relatorios', 'gerenciar_empresas', 'gerenciar_usuarios'
    const [activeTab, setActiveTab] = useState('caixa');
    const [newProductName, setNewProductName] = useState('');
    const [newProductValue, setNewProductValue] = '';
    const [newProductCost, setNewProductCost] = '';
    const [newProductId, setNewProductId] = '';
    const [editingProduct, setEditingProduct] = useState(null);
    const [message, setMessage] = useState('');

    // Estados para autenticação via Flask backend
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [currentUser, setCurrentUser] = useState(null); // Armazena { username, role, company_name, design }
    const [loginUsername, setLoginUsername] = useState('');
    const [loginPassword, setLoginPassword] = useState('');

    // Estados para Gerenciar Empresas (para o admin principal)
    const [newCompanyUsername, setNewCompanyUsername] = useState('');
    const [newCompanyPassword, setNewCompanyPassword] = '';
    const [newCompanyName, setNewCompanyName] = useState('');
    const [newCompanyDesignTheme, setNewCompanyDesignTheme] = useState('default');
    const [newCompanyMercadoPagoAccessToken, setNewCompanyMercadoPagoAccessToken] = useState('');
    const [companies, setCompanies] = useState([]);

    // Estados para a funcionalidade Pix
    const [pixQrCodeData, setPixQrCodeData] = useState(null);
    const [isLoadingPix, setIsLoadingPix] = useState(false);

    // Estado para o termo de pesquisa de produtos
    const [searchTerm, setSearchTerm] = useState('');

    // NOVOS ESTADOS para Gerenciar Usuários da Empresa (para company_admin)
    const [companyUsers, setCompanyUsers] = useState([]); // Lista de usuários da empresa
    const [newCompanyUserUsername, setNewCompanyUserUsername] = useState('');
    const [newCompanyUserPassword, setNewCompanyUserPassword] = '';
    const [newCompanyUserRole, setNewCompanyUserRole] = useState('caixa'); // 'caixa', 'gerente'
    const [editingCompanyUser, setEditingCompanyUser] = useState(null);

    const messageTimeoutRef = useRef(null);

    // Function to display messages
    const showMessage = (msg, type = 'success') => {
        setMessage({ text: msg, type });
        if (messageTimeoutRef.current) {
            clearTimeout(messageTimeoutRef.current);
        }
        messageTimeoutRef.current = setTimeout(() => {
            setMessage('');
        }, 3000);
    };

    // Firebase Authentication (agora usa o token personalizado do Flask)
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user && isLoggedIn && currentUser && user.uid === currentUser.username) {
                console.log("Firebase Auth state changed: User is logged in with UID:", user.uid);
            } else if (!user && isLoggedIn) {
                console.warn("Firebase Auth state changed: User logged in via Flask, but Firebase Auth is not.");
            } else if (user && !isLoggedIn) {
                console.warn("Firebase Auth state changed: User logged in via Firebase, but not via Flask. (No auto-logout)");
            }
        });
        return () => unsubscribe();
    }, [isLoggedIn, currentUser]);

    // Firestore Listeners for Products, Sales, and Company Users (dependem do currentUser do Flask)
    useEffect(() => {
        if (!isLoggedIn || !currentUser || !currentUser.username) {
            setProducts([]);
            setSales([]);
            setCompanyUsers([]); // Limpa usuários da empresa também
            return;
        }

        console.log("Attempting to fetch Firestore data for user:", currentUser.username);

        // Products Listener (para company_admin e gerente)
        let unsubscribeProducts;
        if (currentUser.role === 'company_admin' || currentUser.role === 'gerente') {
            const productsCollectionRef = collection(db, `artifacts/${appId}/users/${currentUser.username}/products`);
            unsubscribeProducts = onSnapshot(productsCollectionRef, (snapshot) => {
                const productsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setProducts(productsData);
                console.log("Produtos carregados com sucesso!");
            }, (error) => {
                console.error("Erro ao carregar produtos:", error);
                showMessage("Erro ao carregar produtos do Firestore. Verifique as permissões.", "error");
            });
        } else {
            setProducts([]); // Limpa se não tiver permissão
        }


        // Sales Listener (para company_admin e gerente)
        let unsubscribeSales;
        if (currentUser.role === 'company_admin' || currentUser.role === 'gerente') {
            const salesCollectionRef = collection(db, `artifacts/${appId}/users/${currentUser.username}/sales`);
            unsubscribeSales = onSnapshot(salesCollectionRef, (snapshot) => {
                const salesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setSales(salesData);
                console.log("Vendas carregadas com sucesso!");
            }, (error) => {
                console.error("Erro ao carregar vendas:", error);
                showMessage("Erro ao carregar vendas do Firestore. Verifique as permissões.", "error");
            });
        } else {
            setSales([]); // Limpa se não tiver permissão
        }


        // Company Users Listener (APENAS para company_admin)
        let unsubscribeCompanyUsers;
        if (currentUser.role === 'company_admin') {
            const companyUsersCollectionRef = collection(db, `artifacts/${appId}/users/${currentUser.username}/company_users`);
            console.log("Firestore Company Users Listener Path:", companyUsersCollectionRef.path); // NOVO LOG
            unsubscribeCompanyUsers = onSnapshot(companyUsersCollectionRef, (snapshot) => {
                const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setCompanyUsers(usersData);
                console.log("Usuários da empresa carregados com sucesso!", usersData); // NOVO LOG
            }, (error) => {
                console.error("Erro ao carregar usuários da empresa:", error);
                showMessage("Erro ao carregar usuários da empresa do Firestore. Verifique as permissões.", "error");
            });
        } else {
            setCompanyUsers([]); // Limpa se não tiver permissão
        }


        return () => {
            if (unsubscribeProducts) unsubscribeProducts();
            if (unsubscribeSales) unsubscribeSales();
            if (unsubscribeCompanyUsers) unsubscribeCompanyUsers();
            console.log("Firestore listeners for Products, Sales, and Company Users unsubscribed.");
        };
    }, [isLoggedIn, currentUser]); // Removido 'appId' da dependência

    // Listener para carregar a lista de empresas (apenas para admin principal)
    useEffect(() => {
        if (!isLoggedIn || !currentUser || currentUser.role !== 'admin') {
            setCompanies([]);
            return;
        }

        const companiesCollectionRef = collection(db, `artifacts/${appId}/users`);
        const q = query(companiesCollectionRef, where("role", "==", "company_admin"));

        const unsubscribeCompanies = onSnapshot(q, (snapshot) => {
            const companiesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setCompanies(companiesData);
            console.log("Empresas carregadas com sucesso!");
        }, (error) => {
            console.error("Erro ao carregar empresas:", error);
            showMessage("Erro ao carregar empresas do Firestore. Verifique as permissões.", "error");
        });

        return () => {
            unsubscribeCompanies();
            console.log("Firestore listener for Companies unsubscribed.");
        };
    }, [isLoggedIn, currentUser]); // Removido 'appId' da dependência


    // Calculate total whenever cart changes
    useEffect(() => {
        const newTotal = cart.reduce((sum, item) => sum + (item.value * item.quantity), 0);
        setTotal(newTotal);
    }, [cart]);

    // Calculate change/difference whenever total or payment amount changes
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

    // Add product to cart
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

    // Remove product from cart
    const removeFromCart = (productId) => {
        setCart(cart.filter(item => item.id !== productId));
        showMessage("Item removido do carrinho.", "info");
    };

    // Increase quantity in cart
    const increaseQuantity = (productId) => {
        setCart(cart.map(item =>
            item.id === productId ? { ...item, quantity: item.quantity + 1 } : item
        ));
    };

    // Decrease quantity in cart
    const decreaseQuantity = (productId) => {
        setCart(cart.map(item =>
            item.id === productId && item.quantity > 1 ? { ...item, quantity: item.quantity - 1 } : item
        ).filter(item => item.quantity > 0)); // Remove if quantity becomes 0
    };

    // Finalize sale
    const finalizeSale = async () => {
        if (cart.length === 0) {
            showMessage("O carrinho está vazio!", "error");
            return;
        }

        // NOVO: Calcular o custo total dos produtos vendidos (CPV)
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
            // Lógica para Pix
            if (paymentMethod === 'Pix') {
                setIsLoadingPix(true);
                setPixQrCodeData(null); // Limpa dados Pix anteriores

                // 1. Gera um ID de venda único ANTES de qualquer chamada ao backend
                saleId = doc(collection(db, `artifacts/${appId}/users/${currentUser.username}/sales`)).id;

                // 2. Cria o documento de venda no Firestore com status 'pending'
                // Isso garante que o documento exista para ser atualizado pelo webhook
                const pixSaleData = {
                    ...baseSaleData,
                    status: 'pending', // Status inicial para Pix
                    payment_id: null, // Será preenchido após a resposta do MP
                    sale_id_frontend: saleId // Salva o ID gerado pelo frontend
                };
                await setDoc(doc(db, `artifacts/${appId}/users/${currentUser.username}/sales`, saleId), pixSaleData);
                showMessage("Iniciando pagamento Pix. Aguardando QR Code...", "info");

                // Obtém o ID Token do Firebase do usuário logado
                const idToken = await auth.currentUser.getIdToken();

                const response = await fetch(`${FLASK_BACKEND_URL}/pix/generate`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${idToken}`
                    },
                    body: JSON.stringify({
                        amount: total.toFixed(2),
                        description: "Pagamento de Venda",
                        // CORREÇÃO AQUI: Enviando como 'sale_id' em vez de 'external_reference'
                        sale_id: saleId,
                    }),
                });

                const data = await response.json();
                console.log("Dados Pix recebidos do backend:", data);

                if (response.ok) {
                    // Adiciona o prefixo data:image/png;base64, se ainda não tiver
                    if (data.qr_code_base64 && !data.qr_code_base64.startsWith('data:image/png;base64,')) {
                        data.qr_code_base64 = 'data:image/png;base64,' + data.qr_code_base64;
                    }
                    setPixQrCodeData(data);
                    showMessage("QR Code Pix gerado com sucesso! Aguardando pagamento...", "success");

                    // 3. Atualiza o documento de venda no Firestore com o payment_id do Mercado Pago
                    // Isso é crucial para que o webhook possa encontrar e atualizar
                    await updateDoc(doc(db, `artifacts/${appId}/users/${currentUser.username}/sales`, saleId), {
                        payment_id: data.payment_id // Salva o ID do pagamento do Mercado Pago
                    });

                    // Não limpa o carrinho aqui, pois a venda ainda está pendente.
                    // A limpeza ocorrerá quando o webhook confirmar o pagamento.

                } else {
                    // Se houver erro ao gerar Pix, remove a venda pendente criada
                    if (saleId) {
                        await deleteDoc(doc(db, `artifacts/${appId}/users/${currentUser.username}/sales`, saleId));
                    }
                    showMessage(`Erro ao gerar Pix: ${data.error || 'Erro desconhecido'}`, "error");
                }
            } else {
                // Lógica para Dinheiro e Cartão (sem Pix)
                // Adiciona a venda diretamente ao Firestore com status 'completed'
                const finalSaleData = {
                    ...baseSaleData,
                    status: 'completed' // Status final para Dinheiro/Cartão
                };
                await addDoc(collection(db, `artifacts/${appId}/users/${currentUser.username}/sales`), finalSaleData);
                showMessage("Venda finalizada com sucesso!");
            }

            // Limpa o carrinho e reinicia os estados APENAS se a venda não for Pix ou se o Pix for gerado com sucesso
            // Para Pix, a limpeza do carrinho será feita pelo webhook (ou um polling no frontend)
            // A condição foi ajustada para evitar erro de 'response is not defined'
            if (paymentMethod !== 'Pix' || (paymentMethod === 'Pix' && pixQrCodeData)) { // Verifica se pixQrCodeData foi preenchido
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
            // Se a venda foi criada mas o Pix falhou, tenta remover
            if (saleId && paymentMethod === 'Pix') {
                try {
                    await deleteDoc(doc(db, `artifacts/${appId}/users/${currentUser.username}/sales`, saleId));
                    console.log("Venda pendente removida após erro na geração do Pix.");
                } catch (deleteError) {
                    console.error("Erro ao remover venda pendente após falha na geração do Pix:", deleteError);
                }
            }
        } finally {
            setIsLoadingPix(false);
        }
    };

    // Product Management Functions
    const handleAddProduct = async () => {
        if (!newProductName || !newProductValue || !newProductId || newProductCost === '') { // NOVO: Validação para newProductCost
            showMessage("Preencha todos os campos do produto!", "error");
            return;
        }
        if (isNaN(parseFloat(newProductValue)) || isNaN(parseFloat(newProductCost))) { // NOVO: Validação para newProductCost
            showMessage("O valor e o custo do produto devem ser números!", "error");
            return;
        }

        const productData = {
            name: newProductName,
            value: parseFloat(newProductValue),
            cost: parseFloat(newProductCost) // NOVO: Salva o custo
        };

        try {
            // Referência ao documento com o ID fornecido pelo usuário
            const productDocRef = doc(db, `artifacts/${appId}/users/${currentUser.username}/products`, newProductId);
            const docSnap = await getDoc(productDocRef); // Verifica se o documento já existe

            if (docSnap.exists()) {
                showMessage("ID de produto já existe! Escolha um ID único.", "error");
                return;
            }

            // Usa setDoc para criar um documento com o ID fornecido pelo usuário
            await setDoc(productDocRef, productData);
            showMessage("Produto adicionado com sucesso!");
            setNewProductName('');
            setNewProductValue('');
            setNewProductCost(''); // NOVO: Limpa o campo de custo
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
        setNewProductCost(product.cost ? product.cost.toString() : ''); // NOVO: Carrega o custo
        setNewProductId(product.id); // Keep the ID for display, but it's not editable
    };

    const handleUpdateProduct = async () => {
        if (!editingProduct || !newProductName || !newProductValue || newProductCost === '') { // NOVO: Validação para newProductCost
            showMessage("Preencha todos os campos para atualizar!", "error");
            return;
        }
        if (isNaN(parseFloat(newProductValue)) || isNaN(parseFloat(newProductCost))) { // NOVO: Validação para newProductCost
            showMessage("O valor e o custo do produto devem ser números!", "error");
            return;
        }

        const productRef = doc(db, `artifacts/${appId}/users/${currentUser.username}/products`, editingProduct.id);
        try {
            await updateDoc(productRef, {
                name: newProductName,
                value: parseFloat(newProductValue),
                cost: parseFloat(newProductCost) // NOVO: Atualiza o custo
            });
            showMessage("Produto atualizado com sucesso!");
            setEditingProduct(null);
            setNewProductName('');
            setNewProductValue('');
            setNewProductCost(''); // NOVO: Limpa o campo de custo
            setNewProductId('');
        } catch (e) {
            console.error("Erro ao atualizar produto: ", e);
            showMessage("Erro ao atualizar produto.", "error");
        }
    };

    const handleDeleteProduct = async (productId) => {
        console.log("Tentando excluir produto com ID:", productId);
        console.log("Usuário atual para exclusão (currentUser.username):", currentUser.username);
        console.log("UID do usuário autenticado no Firebase (auth.currentUser?.uid):", auth.currentUser?.uid); // Log do UID real do Firebase Auth
        try {
            // O caminho para exclusão deve corresponder ao caminho usado para buscar/adicionar
            const docRef = doc(db, `artifacts/${appId}/users/${currentUser.username}/products`, productId);
            console.log("Caminho do documento Firestore para exclusão:", docRef.path);

            await deleteDoc(docRef);
            showMessage("Produto excluído com sucesso!");
        } catch (e) {
            console.error("Erro ao excluir produto:", e);
            console.error("Código do erro Firestore:", e.code); // Log do código de erro
            console.error("Mensagem do erro Firestore:", e.message); // Log da mensagem de erro
            if (e.code === 'permission-denied') {
                showMessage("Erro de permissão: Você não tem autorização para excluir este produto. Verifique as permissões.", "error");
            } else {
                showMessage("Erro ao excluir produto.", "error");
            }
        }
    };

    const cancelEdit = () => {
        setEditingProduct(null);
        setNewProductName('');
        setNewProductValue('');
        setNewProductCost(''); // NOVO: Limpa o campo de custo
        setNewProductId('');
    };

    // Calculate weekly sales report
    const getWeeklySales = () => {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        const weeklySales = sales.filter(sale => {
            const saleDate = sale.timestamp.toDate(); // Convert Firestore Timestamp to Date object
            return saleDate >= oneWeekAgo;
        });

        const salesByDay = {};
        weeklySales.forEach(sale => {
            const saleDate = sale.timestamp.toDate().toLocaleDateString('pt-BR');
            // NOVO: Soma o lucro em vez do total
            if (!salesByDay[saleDate]) {
                salesByDay[saleDate] = 0;
            }
            salesByDay[saleDate] += sale.profit || (sale.total - (sale.costOfGoodsSold || 0)); // Garante que o lucro seja calculado se não estiver salvo
        });

        // Sort by date for display
        const sortedSales = Object.entries(salesByDay).sort(([dateA], [dateB]) => {
            const [dayA, monthA, yearA] = dateA.split('/').map(Number);
            const [dayB, monthB, yearB] = dateB.split('/').map(Number);
            const dateObjA = new Date(yearA, monthA - 1, dayA);
            const dateObjB = new Date(yearB, monthB - 1, dayB);
            return dateObjA - dateObjB;
        });

        return sortedSales;
    };

    // --- Funções de Autenticação com o Backend Flask ---
    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            const response = await fetch(`${FLASK_BACKEND_URL}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username: loginUsername, password: loginPassword }),
            });

            const data = await response.json();
            console.log("Dados recebidos do backend:", data);

            if (response.ok) {
                const firebaseToken = data.firebase_token;
                if (firebaseToken) {
                    try {
                        await signInWithCustomToken(auth, firebaseToken);
                        showMessage(`Login bem-sucedido! Bem-vindo, ${data.username}.`, 'success');
                        setIsLoggedIn(true);
                        // Armazena os dados de design no currentUser
                        setCurrentUser({
                            username: data.username,
                            role: data.role,
                            company_name: data.company_name,
                            design: data.design // Armazena o objeto de design completo
                        });
                        setLoginPassword('');
                        // Redireciona para a aba apropriada após o login
                        if (data.role === 'admin') {
                            setActiveTab('gerenciar_empresas');
                        } else {
                            setActiveTab('caixa');
                        }
                    } catch (firebaseError) {
                        console.error("Erro ao autenticar no Firebase com token personalizado:", firebaseError);
                        showMessage(`Erro ao conectar ao Firebase: ${firebaseError.message}`, 'error');
                        setIsLoggedIn(false);
                        setCurrentUser(null);
                    }
                } else {
                    showMessage("Erro: Token Firebase não recebido do backend.", "error");
                    console.error("Firebase token missing in Flask response. Full data:", data);
                }
            } else {
                showMessage(`Erro de login: ${data.error || 'Credenciais inválidas'}`, 'error');
            }
        } catch (error) {
            console.error('Erro ao conectar ao backend para login:', error);
            showMessage('Erro ao conectar ao servidor. Verifique se o backend está rodando.', 'error');
        }
    };

    const handleLogout = async () => {
        // Resetar estados que controlam os listeners ANTES de deslogar do Firebase Auth
        setIsLoggedIn(false);
        setCurrentUser(null);
        setLoginUsername('');
        setLoginPassword('');
        setCart([]);
        setProducts([]);
        setSales([]);
        setCompanies([]);
        setCompanyUsers([]); // Limpa usuários da empresa no logout

        try {
            await auth.signOut(); // Desloga do Firebase Auth
            showMessage("Você foi desconectado.", "info");
            setActiveTab('caixa'); // Volta para a aba padrão após logout
        } catch (error) {
            console.error("Erro ao deslogar do Firebase:", error);
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

            if (response.ok) {
                showMessage(`Empresa "${data.company_name}" (Usuário: ${data.username}) registrada com sucesso!`, 'success');
                setNewCompanyUsername('');
                setNewCompanyPassword('');
                setNewCompanyName('');
                setNewCompanyDesignTheme('default');
                setNewCompanyMercadoPagoAccessToken(''); // Limpa o campo após o registro
            } else {
                showMessage(`Erro ao registrar empresa: ${data.error || 'Erro desconhecido'}`, "error");
            }
        } catch (error) {
            console.error('Erro ao conectar ao backend para registrar empresa:', error);
            showMessage('Erro ao conectar ao servidor para registrar empresa.', 'error');
        }
    };

    // Função para excluir uma empresa (login)
    const handleDeleteCompany = async (companyId) => {
        if (!window.confirm(`Tem certeza que deseja excluir a empresa ${companyId} e TODOS os seus dados (produtos, vendas, etc.)? Esta ação é irreversível!`)) {
            return;
        }

        try {
            const idToken = await auth.currentUser.getIdToken(); // Obtém o ID Token do usuário logado (admin)
            const response = await fetch(`${FLASK_BACKEND_URL}/delete_company`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}` // Envia o ID Token para autenticação no backend
                },
                body: JSON.stringify({ company_username: companyId }),
            });

            const data = await response.json();

            if (response.ok) {
                showMessage(`Empresa "${companyId}" excluída com sucesso!`, 'success');
            } else {
                showMessage(`Erro ao excluir empresa: ${data.error || 'Erro desconhecido'}`, "error");
            }
        } catch (error) {
            console.error('Erro ao conectar ao backend para excluir empresa:', error);
            showMessage('Erro ao conectar ao servidor para excluir empresa.', 'error');
        }
    };

    // --- Funções de Gerenciamento de Usuários da Empresa (para company_admin) ---
    const handleAddCompanyUser = async (e) => {
        e.preventDefault();
        if (!newCompanyUserUsername || !newCompanyUserPassword || !newCompanyUserRole) {
            showMessage("Preencha todos os campos para adicionar o usuário!", "error");
            return;
        }
        if (!currentUser || !currentUser.username) {
            showMessage("Erro: Administrador da empresa não identificado.", "error");
            return;
        }

        try {
            const idToken = await auth.currentUser.getIdToken(); // Obtém o ID Token do company_admin logado
            const response = await fetch(`${FLASK_BACKEND_URL}/company_users/add`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}` // Envia o ID Token para autenticação no backend
                },
                body: JSON.stringify({
                    company_id: currentUser.username, // ID da empresa do admin logado
                    username: newCompanyUserUsername,
                    password: newCompanyUserPassword,
                    role: newCompanyUserRole
                }),
            });

            const data = await response.json();

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
        // Não carregamos a senha para edição por segurança
        setNewCompanyUserPassword('');
    };

    const handleUpdateCompanyUser = async (e) => {
        e.preventDefault();
        if (!editingCompanyUser || !newCompanyUserUsername || !newCompanyUserRole) {
            showMessage("Preencha todos os campos para atualizar o usuário!", "error");
            return;
        }
        if (!currentUser || !currentUser.username) {
            showMessage("Erro: Administrador da empresa não identificado.", "error");
            return;
        }

        try {
            const idToken = await auth.currentUser.getIdToken(); // Obtém o ID Token do company_admin logado
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

    const handleDeleteCompanyUser = async (userId) => {
        if (!window.confirm(`Tem certeza que deseja excluir o usuário ${userId}? Esta ação é irreversível!`)) {
            return;
        }
        if (!currentUser || !currentUser.username) {
            showMessage("Erro: Administrador da empresa não identificado.", "error");
            return;
        }

        console.log("Tentando excluir usuário da empresa com ID:", userId); // NOVO LOG

        try {
            const idToken = await auth.currentUser.getIdToken(); // Obtém o ID Token do company_admin logado
            const response = await fetch(`${FLASK_BACKEND_URL}/company_users/delete`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`
                },
                body: JSON.stringify({
                    company_id: currentUser.username,
                    user_id: userId // O ID do documento do usuário no Firestore (que é o firebase_uid)
                }),
            });

            const data = await response.json();

            if (response.ok) {
                showMessage(`Usuário "${userId}" excluído com sucesso!`, 'success');
            } else {
                showMessage(`Erro ao excluir usuário: ${data.error || 'Erro desconhecido'}`, "error");
            }
        } catch (e) {
            console.error("Erro ao excluir usuário da empresa:", e);
            showMessage("Erro ao conectar ao servidor para excluir usuário.", "error");
        }
    };

    const cancelEditCompanyUser = () => {
        setEditingCompanyUser(null);
        setNewCompanyUserUsername('');
        setNewCompanyUserPassword('');
        setNewCompanyUserRole('caixa');
    };


    // Função para copiar a chave Pix para a área de transferência
    const copyPixKeyToClipboard = (key) => {
        // Usa document.execCommand('copy') por compatibilidade em iframes
        const el = document.createElement('textarea');
        el.value = key;
        document.body.appendChild(el);
        el.select();
        try {
            document.execCommand('copy');
            showMessage("Chave Pix copiada!", "success");
        } catch (err) {
            console.error('Erro ao copiar a chave Pix:', err);
            showMessage("Falha ao copiar a chave Pix.", "error");
        }
        document.body.removeChild(el);
    };

    // NOVO: Função para cancelar o pagamento Pix
    const handleCancelPixPayment = async (paymentId) => {
        if (!window.confirm(`Tem certeza que deseja cancelar o pagamento Pix com ID ${paymentId}?`)) {
            return;
        }

        if (!currentUser || !currentUser.username) {
            showMessage("Erro: Usuário da empresa não identificado para cancelar Pix.", "error");
            return;
        }

        try {
            const idToken = await auth.currentUser.getIdToken(); // Obtém o ID Token do company_admin logado
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

            if (response.ok) {
                showMessage(`Pagamento Pix ${paymentId} cancelado com sucesso!`, 'success');
                // Opcional: Atualizar o status da venda no Firestore no frontend, se necessário
                // Ou depender do webhook do Mercado Pago para fazer isso
            } else {
                showMessage(`Erro ao cancelar Pix: ${data.error || 'Erro desconhecido'}`, "error");
            }
        } catch (error) {
            console.error('Erro ao conectar ao servidor para cancelar Pix:', error);
            showMessage('Erro ao conectar ao servidor para cancelar Pix.', 'error');
        }
    };


    // Filtrar produtos com base no termo de pesquisa
    const filteredProducts = products.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.id.toLowerCase().includes(searchTerm.toLowerCase())
    );


    // Renderiza a tela de login se o usuário não estiver logado
    if (!isLoggedIn) {
        return (
            <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-gray-800"> {/* Adicionado bg-gray-800 como fallback */}
                {/* Video de Fundo para a tela de login */}
                <video
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="absolute z-0 w-full h-full object-cover"
                    src="https://videos.pexels.com/video-files/3752548/3752548-hd_1920_1080_24fps.mp4" // URL do vídeo para a tela de login
                    onError={(e) => console.error("Erro ao carregar o vídeo de fundo da tela de login:", e)}
                >
                    Seu navegador não suporta a tag de vídeo.
                </video>

                {/* Overlay para legibilidade */}
                <div className="absolute z-10 w-full h-full bg-black opacity-50"></div>

                {message && (
                    <div className={`fixed top-4 right-4 p-3 rounded-lg shadow-lg text-white z-50 transition-opacity duration-300 ${message.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
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
                                Login
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        );
    }

    // Renderiza o aplicativo principal se o usuário estiver logado
    const currentDesign = currentUser?.design || {}; // Garante que currentDesign não é nulo

    // Determina se o vídeo de fundo da aba "Gerenciar Empresas" deve ser ativo
    const showCompanyManagementVideo = isLoggedIn && activeTab === 'gerenciar_empresas' && currentUser?.role === 'admin';

    // Define o estilo de fundo dinamicamente (cores/gradiente)
    const backgroundClasses = currentDesign.dominant_color
        ? `${currentDesign.dominant_color}` // Usa a cor dominante se definida
        : `${currentDesign.gradient_from || 'from-blue-50'} ${currentDesign.gradient_to || 'to-indigo-100'}`; // Volta para o gradiente se não houver cor dominante

    return (
        <div
            className={`min-h-screen p-4 ${currentDesign.font_family || 'font-sans'} flex flex-col items-center relative`}
        >
            {/* Vídeo de Fundo Condicional para a aba "Gerenciar Empresas" */}
            {showCompanyManagementVideo && (
                <>
                    <video
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="absolute z-0 w-full h-full object-cover top-0 left-0"
                        src="https://videos.pexels.com/video-files/30163656/12934691_1920_1080_30fps.mp4" // URL do vídeo para a aba de gerenciamento de empresas
                        onError={(e) => console.error("Erro ao carregar o vídeo de fundo da Gerenciar Empresas:", e)}
                    >
                        Seu navegador não suporta a tag de vídeo para o fundo de gerenciamento de empresas.
                    </video>
                    {/* Overlay para legibilidade sobre o vídeo de fundo */}
                    <div className="absolute z-10 w-full h-full bg-black opacity-50 top-0 left-0"></div>
                </>
            )}

            {/* Fundo de cor/gradiente condicional para outras abas */}
            {!showCompanyManagementVideo && (
                <div className={`absolute z-0 w-full h-full top-0 left-0 ${backgroundClasses}`}></div>
            )}

            {/* Todo o conteúdo da aplicação com um z-index maior para ficar acima do fundo */}
            <div className="relative z-20 w-full flex flex-col items-center">
                {/* User ID Display */}
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

                {/* Message Box */}
                {message && (
                    <div className={`fixed top-4 right-4 p-3 rounded-lg shadow-lg text-white z-50 transition-opacity duration-300 ${message.type === 'success' ? currentDesign.success_color : currentDesign.error_color}`}>
                        {message.text}
                    </div>
                )}

                <h1 className={`text-4xl font-extrabold ${currentDesign.text_color_strong || 'text-gray-800'} mb-8 mt-4 rounded-xl p-3 bg-white shadow-lg`}>
                    Gerenciador de Caixa
                </h1>

                {/* Navigation Tabs */}
                <div className="flex space-x-4 mb-8 bg-white p-2 rounded-full shadow-md">
                    {/* Aba Caixa - Visível para company_admin, gerente, caixa */}
                    {(currentUser.role === 'company_admin' || currentUser.role === 'gerente' || currentUser.role === 'caixa') && (
                        <button
                            onClick={() => setActiveTab('caixa')}
                            className={`px-6 py-3 rounded-full text-lg font-medium transition-all duration-300 ${activeTab === 'caixa' ? `${currentDesign.primary_button_bg} text-white shadow-lg` : `${currentDesign.secondary_button_bg} ${currentDesign.secondary_button_text} ${currentDesign.secondary_button_hover_bg}`}`}
                        >
                            Caixa
                        </button>
                    )}
                    {/* Aba Produtos - Visível para company_admin e gerente */}
                    {(currentUser.role === 'company_admin' || currentUser.role === 'gerente') && (
                        <button
                            onClick={() => setActiveTab('produtos')}
                            className={`px-6 py-3 rounded-full text-lg font-medium transition-all duration-300 ${activeTab === 'produtos' ? `${currentDesign.primary_button_bg} text-white shadow-lg` : `${currentDesign.secondary_button_bg} ${currentDesign.secondary_button_text} ${currentDesign.secondary_button_hover_bg}`}`}
                        >
                            Produtos
                        </button>
                    )}
                    {/* Aba Relatórios - Visível para company_admin e gerente */}
                    {(currentUser.role === 'company_admin' || currentUser.role === 'gerente') && (
                        <button
                            onClick={() => setActiveTab('relatorios')}
                            className={`px-6 py-3 rounded-full text-lg font-medium transition-all duration-300 ${activeTab === 'relatorios' ? `${currentDesign.primary_button_bg} text-white shadow-lg` : `${currentDesign.secondary_button_bg} ${currentDesign.secondary_button_text} ${currentDesign.secondary_button_hover_bg}`}`}
                        >
                            Relatórios
                        </button>
                    )}
                    {/* Aba Gerenciar Usuários - Visível APENAS para company_admin */}
                    {currentUser.role === 'company_admin' && (
                        <button
                            onClick={() => setActiveTab('gerenciar_usuarios')}
                            className={`px-6 py-3 rounded-full text-lg font-medium transition-all duration-300 ${activeTab === 'gerenciar_usuarios' ? `${currentDesign.primary_button_bg} text-white shadow-lg` : `${currentDesign.secondary_button_bg} ${currentDesign.secondary_button_text} ${currentDesign.secondary_button_hover_bg}`}`}
                        >
                            Gerenciar Usuários
                        </button>
                    )}
                    {/* Aba Gerenciar Empresas - Visível APENAS para admin principal */}
                    {currentUser.role === 'admin' && (
                        <button
                            onClick={() => setActiveTab('gerenciar_empresas')}
                            className={`px-6 py-3 rounded-full text-lg font-medium transition-all duration-300 ${activeTab === 'gerenciar_empresas' ? `${currentDesign.primary_button_bg} text-white shadow-lg` : `${currentDesign.secondary_button_bg} ${currentDesign.secondary_button_text} ${currentDesign.secondary_button_hover_bg}`}`}
                        >
                            Gerenciar Empresas
                        </button>
                    )}
                </div>

                {/* Caixa Tab Content (Visível para company_admin, gerente, caixa) */}
                {(activeTab === 'caixa' && (currentUser.role === 'company_admin' || currentUser.role === 'gerente' || currentUser.role === 'caixa')) && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 w-full max-w-7xl">
                        {/* Products List */}
                        <div className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-xl">
                            <h2 className={`text-2xl font-bold ${currentDesign.text_color_medium || 'text-gray-700'} mb-4 pb-2 border-b-2 ${currentDesign.border_color || 'border-blue-200'}`}>
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
                                    <p className="text-gray-500">Nenhum produto encontrado ou cadastrado.</p>
                                ) : (
                                    filteredProducts.map(product => (
                                        <div key={product.id} className="flex justify-between items-center bg-gray-50 p-3 mb-2 rounded-lg shadow-sm">
                                            <div>
                                                <p className={`font-semibold ${currentDesign.text_color_strong || 'text-gray-800'}`}>{product.name} (ID: {product.id})</p>
                                                <p className={`${currentDesign.highlight_color || 'text-blue-600'} font-bold`}>R$ {product.value.toFixed(2)}</p>
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

                        {/* Cart and Payment */}
                        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-xl flex flex-col">
                            <h2 className={`text-2xl font-bold ${currentDesign.text_color_medium || 'text-gray-700'} mb-4 pb-2 border-b-2 ${currentDesign.border_color || 'border-blue-200'}`}>
                                Carrinho de Compras
                            </h2>
                            <div className="flex-grow max-h-80 overflow-y-auto mb-4">
                                {cart.length === 0 ? (
                                    <p className="text-gray-500">Carrinho vazio.</p>
                                ) : (
                                    cart.map(item => (
                                        <div key={item.id} className="flex justify-between items-center bg-gray-50 p-3 mb-2 rounded-lg shadow-sm">
                                            <div>
                                                <p className={`font-semibold ${currentDesign.text_color_strong || 'text-gray-800'}`}>{item.name}</p>
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

                            <div className={`mt-auto pt-4 border-t-2 ${currentDesign.border_color || 'border-blue-200'}`}>
                                <div className={`flex justify-between items-center text-2xl font-bold ${currentDesign.text_color_strong || 'text-gray-800'} mb-4`}>
                                    <span>Total:</span>
                                    <span>R$ {total.toFixed(2)}</span>
                                </div>

                                <div className="mb-4">
                                    <label htmlFor="paymentMethod" className={`block ${currentDesign.text_color_medium || 'text-gray-700'} text-lg font-semibold mb-2`}>Método de Pagamento:</label>
                                    <select
                                        id="paymentMethod"
                                        value={paymentMethod}
                                        onChange={(e) => {
                                            setPaymentMethod(e.target.value);
                                            setPixQrCodeData(null); // Limpa os dados do Pix ao mudar o método
                                        }}
                                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-lg"
                                    >
                                        <option value="Dinheiro">Dinheiro</option>
                                        <option value="Cartao">Cartão de Crédito/Débito</option>
                                        <option value="Pix">Pix</option>
                                    </select>
                                </div>

                                {paymentMethod === 'Dinheiro' && (
                                    <div className="mb-4">
                                        <label htmlFor="paymentAmount" className={`block ${currentDesign.text_color_medium || 'text-gray-700'} text-lg font-semibold mb-2`}>Valor Pago:</label>
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
                                                    Chave "copia e cola":
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
                                                {/* NOVO: Botão de Cancelar Pagamento Pix */}
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
                                                {/* Placeholder para o QR Code antes de gerar */}
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

                                <div className={`flex justify-between items-center text-xl ${currentDesign.text_color_medium || 'text-gray-700'} mb-2`}>
                                    <span>Diferença:</span>
                                    <span className="font-bold text-red-600">R$ {difference.toFixed(2)}</span>
                                </div>
                                <div className={`flex justify-between items-center text-xl ${currentDesign.text_color_medium || 'text-gray-700'} mb-4`}>
                                    <span>Troco:</span>
                                    <span className="font-bold text-green-600">R$ {change.toFixed(2)}</span>
                                </div>

                                <button
                                    onClick={finalizeSale}
                                    className={`w-full ${currentDesign.primary_button_bg || 'bg-blue-600'} ${currentDesign.primary_button_hover_bg || 'hover:bg-blue-700'} text-white text-xl font-bold py-4 rounded-xl transition-all duration-300 shadow-lg transform hover:scale-105`}
                                >
                                    Finalizar Venda
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Products Tab Content (Visível para company_admin e gerente) */}
                {(activeTab === 'produtos' && (currentUser.role === 'company_admin' || currentUser.role === 'gerente')) && (
                    <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-4xl">
                        <h2 className={`text-3xl font-bold ${currentDesign.text_color_medium || 'text-gray-700'} mb-6 pb-3 border-b-2 ${currentDesign.border_color || 'border-blue-200'}`}>
                            {editingProduct ? 'Editar Produto' : 'Adicionar Novo Produto'}
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            <div>
                                <label htmlFor="newProductId" className={`block ${currentDesign.text_color_medium || 'text-gray-700'} font-semibold mb-2`}>ID do Produto:</label>
                                <input
                                    type="text"
                                    id="newProductId"
                                    value={newProductId}
                                    onChange={(e) => setNewProductId(e.target.value)}
                                    placeholder="Ex: PROD001"
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                    disabled={!!editingProduct} // Disable ID input when editing
                                />
                            </div>
                            <div>
                                <label htmlFor="newProductName" className={`block ${currentDesign.text_color_medium || 'text-gray-700'} font-semibold mb-2`}>Nome do Produto:</label>
                                <input
                                    type="text"
                                    id="newProductName"
                                    value={newProductName}
                                    onChange={(e) => setNewProductName(e.target.value)}
                                    placeholder="Ex: Refrigerante Lata"
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                            <div>
                                <label htmlFor="newProductValue" className={`block ${currentDesign.text_color_medium || 'text-gray-700'} font-semibold mb-2`}>Valor (R$):</label>
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
                            {/* Campo para o Custo do Produto */}
                            <div>
                                <label htmlFor="newProductCost" className={`block ${currentDesign.text_color_medium || 'text-gray-700'} font-semibold mb-2`}>Custo (R$):</label>
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
                                    className={`${currentDesign.primary_button_bg || 'bg-blue-600'} ${currentDesign.primary_button_hover_bg || 'hover:bg-blue-700'} text-white px-6 py-3 rounded-xl font-bold transition-all duration-300 shadow-md transform hover:scale-105`}
                                >
                                    Adicionar Produto
                                </button>
                            )}
                        </div>

                        <h3 className={`text-2xl font-bold ${currentDesign.text_color_medium || 'text-gray-700'} mt-10 mb-4 pb-2 border-b-2 ${currentDesign.border_color || 'border-blue-200'}`}>
                            Lista de Produtos
                        </h3>
                        <div className="max-h-96 overflow-y-auto">
                            {products.length === 0 ? (
                                <p className="text-gray-500">Nenhum produto cadastrado.</p>
                            ) : (
                                <ul className="space-y-3">
                                    {products.map(product => (
                                        <li key={product.id} className="flex justify-between items-center bg-gray-50 p-4 rounded-lg shadow-sm">
                                            <div>
                                                <p className={`font-semibold ${currentDesign.text_color_strong || 'text-gray-800'} text-lg`}>Produto: {product.name} (ID: {product.id})</p>
                                                <p className={`${currentDesign.highlight_color || 'text-blue-600'} font-bold text-xl`}>R$ {product.value.toFixed(2)}</p>
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

                {/* Reports Tab Content (Visível para company_admin e gerente) */}
                {(activeTab === 'relatorios' && (currentUser.role === 'company_admin' || currentUser.role === 'gerente')) && (
                    <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-4xl">
                        <h2 className={`text-3xl font-bold ${currentDesign.text_color_medium || 'text-gray-700'} mb-6 pb-3 border-b-2 ${currentDesign.border_color || 'border-blue-200'}`}>
                            Relatório de Lucro Semanal
                        </h2>
                        {sales.length === 0 ? (
                            <p className="text-gray-500">Nenhuma venda registrada ainda.</p>
                        ) : (
                            <div className="max-h-96 overflow-y-auto">
                                <table className="min-w-full bg-white rounded-lg overflow-hidden shadow-md">
                                    <thead className={`${currentDesign.primary_button_bg || 'bg-blue-500'} text-white`}>
                                        <tr>
                                            <th className="py-3 px-4 text-left text-sm font-semibold uppercase">Data</th>
                                            <th className="py-3 px-4 text-left text-sm font-semibold uppercase">Lucro Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {getWeeklySales().map(([date, profit]) => (
                                            <tr key={date} className="hover:bg-gray-50">
                                                <td className={`py-3 px-4 ${currentDesign.text_color_strong || 'text-gray-800'}`}>
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

                        <h3 className={`text-2xl font-bold ${currentDesign.text_color_medium || 'text-gray-700'} mt-10 mb-4 pb-2 border-b-2 ${currentDesign.border_color || 'border-blue-200'}`}>
                            Todas as Vendas
                        </h3>
                        <div className="max-h-96 overflow-y-auto">
                            {sales.length === 0 ? (
                                <p className="text-gray-500">Nenhuma venda registrada ainda.</p>
                            ) : (
                                <table className="min-w-full bg-white rounded-lg overflow-hidden shadow-md">
                                    <thead className={`${currentDesign.primary_button_bg || 'bg-blue-500'} text-white`}>
                                        <tr>
                                            <th className="py-3 px-4 text-left text-sm font-semibold uppercase">Data/Hora</th>
                                            <th className="py-3 px-4 text-left text-sm font-semibold uppercase">Itens</th>
                                            <th className="py-3 px-4 text-left text-sm font-semibold uppercase">Total</th>
                                            <th className="py-3 px-4 text-left text-sm font-semibold uppercase">Custo</th>
                                            <th className="py-3 px-4 text-left text-sm font-semibold uppercase">Lucro</th>
                                            <th className="py-3 px-4 text-left text-sm font-semibold uppercase">Método</th>
                                            <th className="py-3 px-4 text-left text-sm font-semibold uppercase">Status</th> {/* NOVO: Coluna de Status */}
                                            <th className="py-3 px-4 text-left text-sm font-semibold uppercase">Ações</th> {/* NOVO: Coluna de Ações */}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {sales.map(sale => (
                                            <tr key={sale.id} className="hover:bg-gray-50">
                                                <td className={`py-3 px-4 ${currentDesign.text_color_strong || 'text-gray-800'}`}>
                                                    {sale.timestamp.toDate().toLocaleString('pt-BR')}
                                                </td>
                                                <td className={`py-3 px-4 ${currentDesign.text_color_medium || 'text-gray-700'}`}>
                                                    {sale.items.map(item => (
                                                        <p key={item.productId}>{item.name} (x{item.quantity})</p>
                                                    ))}
                                                </td>
                                                <td className="py-3 px-4 text-green-600 font-bold">R$ {sale.total.toFixed(2)}</td>
                                                <td className="py-3 px-4 text-gray-600">R$ {(sale.costOfGoodsSold || 0).toFixed(2)}</td>
                                                <td className="py-3 px-4 text-purple-600 font-bold">R$ {(sale.profit || (sale.total - (sale.costOfGoodsSold || 0))).toFixed(2)}</td>
                                                <td className={`py-3 px-4 ${currentDesign.text_color_medium || 'text-gray-700'}`}>{sale.paymentMethod}</td>
                                                <td className={`py-3 px-4 ${currentDesign.text_color_medium || 'text-gray-700'}`}>
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

                {/* Gerenciar Usuários Tab Content (Visível APENAS para company_admin) */}
                {activeTab === 'gerenciar_usuarios' && currentUser.role === 'company_admin' && (
                    <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-4xl">
                        <h2 className={`text-3xl font-bold ${currentDesign.text_color_medium || 'text-gray-700'} mb-6 pb-3 border-b-2 ${currentDesign.border_color || 'border-blue-200'}`}>
                            {editingCompanyUser ? 'Editar Usuário da Empresa' : 'Adicionar Novo Usuário da Empresa'}
                        </h2>
                        <form onSubmit={editingCompanyUser ? handleUpdateCompanyUser : handleAddCompanyUser} className="space-y-4 mb-8">
                            <div>
                                <label htmlFor="newCompanyUserUsername" className={`block ${currentDesign.text_color_medium || 'text-gray-700'} font-semibold mb-2`}>Nome de Usuário:</label>
                                <input
                                    type="text"
                                    id="newCompanyUserUsername"
                                    value={newCompanyUserUsername}
                                    onChange={(e) => setNewCompanyUserUsername(e.target.value)}
                                    placeholder="Ex: caixa01"
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                    required
                                    disabled={!!editingCompanyUser} // Desabilita edição do username
                                />
                            </div>
                            <div>
                                <label htmlFor="newCompanyUserPassword" className={`block ${currentDesign.text_color_medium || 'text-gray-700'} font-semibold mb-2`}>Senha:</label>
                                <input
                                    type="password"
                                    id="newCompanyUserPassword"
                                    value={newCompanyUserPassword}
                                    onChange={(e) => setNewCompanyUserPassword(e.target.value)}
                                    placeholder={editingCompanyUser ? "Deixe em branco para manter a senha atual" : "********"}
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                    required={!editingCompanyUser} // Senha é obrigatória apenas ao adicionar
                                />
                            </div>
                            <div>
                                <label htmlFor="newCompanyUserRole" className={`block ${currentDesign.text_color_medium || 'text-gray-700'} font-semibold mb-2`}>Função:</label>
                                <select
                                    id="newCompanyUserRole"
                                    value={newCompanyUserRole}
                                    onChange={(e) => setNewCompanyUserRole(e.target.value)}
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                    required
                                >
                                    <option value="caixa">Caixa</option>
                                    <option value="gerente">Gerente</option>
                                    {/* O company_admin não pode criar outro company_admin */}
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
                                        className={`${currentDesign.primary_button_bg || 'bg-blue-600'} ${currentDesign.primary_button_hover_bg || 'hover:bg-blue-700'} text-white px-6 py-3 rounded-xl font-bold transition-all duration-300 shadow-md transform hover:scale-105`}
                                >
                                        Adicionar Usuário
                                    </button>
                                )}
                            </div>
                        </form>

                        <h3 className={`text-2xl font-bold ${currentDesign.text_color_medium || 'text-gray-700'} mt-10 mb-4 pb-2 border-b-2 ${currentDesign.border_color || 'border-blue-200'}`}>
                            Usuários da Empresa
                        </h3>
                        <div className="max-h-96 overflow-y-auto">
                            {companyUsers.length === 0 ? (
                                <p className="text-gray-500">Nenhum usuário cadastrado para esta empresa.</p>
                            ) : (
                                <ul className="space-y-3">
                                    {companyUsers.map(user => (
                                        <li key={user.id} className="flex justify-between items-center bg-gray-50 p-4 rounded-lg shadow-sm">
                                            <div>
                                                <p className={`font-semibold ${currentDesign.text_color_strong || 'text-gray-800'} text-lg`}>Usuário: {user.username}</p>
                                                <p className="text-gray-600 text-sm">Função: {user.role}</p>
                                                {/* Opcional: Mostrar o firebase_uid para depuração */}
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

                {/* Gerenciar Empresas Tab Content (Visível APENAS para admin principal) */}
                {activeTab === 'gerenciar_empresas' && currentUser.role === 'admin' && (
                    <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-4xl">
                        <h2 className={`text-3xl font-bold ${currentDesign.text_color_medium || 'text-gray-700'} mb-6 pb-3 border-b-2 ${currentDesign.border_color || 'border-blue-200'}`}>
                            Registrar Nova Empresa
                        </h2>
                        <form onSubmit={handleRegisterCompany} className="space-y-4 mb-8">
                            <div>
                                <label htmlFor="newCompanyUsername" className={`block ${currentDesign.text_color_medium || 'text-gray-700'} font-semibold mb-2`}>Nome de Usuário da Empresa (ID):</label>
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
                                <label htmlFor="newCompanyPassword" className={`block ${currentDesign.text_color_medium || 'text-gray-700'} font-semibold mb-2`}>Senha da Empresa:</label>
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
                                <label htmlFor="newCompanyName" className={`block ${currentDesign.text_color_medium || 'text-gray-700'} font-semibold mb-2`}>Nome Completo da Empresa:</label>
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
                                <label htmlFor="newCompanyDesignTheme" className={`block ${currentDesign.text_color_medium || 'text-gray-700'} font-semibold mb-2`}>Tema de Design (Cores/Fontes):</label>
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
                                <label htmlFor="newCompanyMercadoPagoAccessToken" className={`block ${currentDesign.text_color_medium || 'text-gray-700'} font-semibold mb-2`}>Token de Acesso Mercado Pago:</label>
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

                        <h3 className={`text-2xl font-bold ${currentDesign.text_color_medium || 'text-gray-700'} mt-10 mb-4 pb-2 border-b-2 ${currentDesign.border_color || 'border-blue-200'}`}>
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
                                                <p className={`font-semibold ${currentDesign.text_color_strong || 'text-gray-800'} text-lg`}>Nome: {company.company_name}</p>
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
        </div>
    );
};

export default App;
