/* global __app_id, __firebase_config, __initial_auth_token */
import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query, where, setDoc, getDoc } from 'firebase/firestore';

// URL base do seu backend Flask (AGORA APONTA PARA O KOYEB)
// ATENÇÃO: SUBSTITUA 'https://old-owl-williammzin-cd2d4d31.koyeb.app' PELA URL REAL DO SEU BACKEND KOYEB!
const FLASK_BACKEND_URL = 'https://old-owl-williammzin-cd2d4d31.koyeb.app';

// Default themes in case currentUser.design is not available or incomplete
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
        dominant_color: 'bg-blue-50' // Used for table headers, etc.
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

// Confirm Modal Component
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

// Main App Component
const App = () => {
    console.log("App component is rendering...");

    // Firebase instances as states
    const [firebaseApp, setFirebaseApp] = useState(null);
    const [firebaseAuth, setFirebaseAuth] = useState(null);
    const [firestoreDb, setFirestoreDb] = useState(null);

    // App ID from Canvas environment
    const [appId, setAppId] = useState('local-app-id');

    const [products, setProducts] = useState([]);
    const [cart, setCart] = useState([]);
    const [total, setTotal] = useState(0);
    const [paymentAmount, setPaymentAmount] = '';
    const [change, setChange] = useState(0);
    const [difference, setDifference] = 0;
    const [paymentMethod, setPaymentMethod] = useState('Dinheiro');
    const [sales, setSales] = useState([]);
    const [activeTab, setActiveTab] = useState('caixa');
    const [newProductName, setNewProductName] = '';
    const [newProductValue, setNewProductValue] = '';
    const [newProductCost, setNewProductCost] = '';
    const [newProductId, setNewProductId] = '';
    const [editingProduct, setEditingProduct] = null;
    const [message, setMessage] = useState('');

    // Estados para autenticação via Flask backend
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [currentUser, setCurrentUser] = useState(null); // Armazena { username, role, company_name, design }
    const [loginUsername, setLoginUsername] = useState('');
    const [loginPassword, setLoginPassword] = useState('');

    // Estados para Gerenciar Empresas (para o admin principal)
    const [newCompanyUsername, setNewCompanyUsername] = useState('');
    const [newCompanyPassword, setNewCompanyPassword] = '';
    const [newCompanyName, setNewCompanyName] = '';
    const [newCompanyDesignTheme, setNewCompanyDesignTheme] = useState('default');
    const [newCompanyMercadoPagoAccessToken, setNewCompanyMercadoPagoAccessToken] = '';
    const [companies, setCompanies] = useState([]);

    // Estados para a funcionalidade Pix
    const [pixQrCodeData, setPixQrCodeData] = useState(null);
    const [isLoadingPix, setIsLoadingPix] = useState(false);

    // Estado para o termo de pesquisa de produtos
    const [searchTerm, setSearchTerm] = useState('');

    // NOVOS ESTADOS para Gerenciar Usuários da Empresa (para company_admin)
    const [companyUsers, setCompanyUsers] = useState([]); // Lista de usuários da empresa
    const [newCompanyUserUsername, setNewCompanyUserUsername] = '';
    const [newCompanyUserPassword, setNewCompanyUserPassword] = '';
    const [newCompanyUserRole, setNewCompanyUserRole] = useState('caixa'); // 'caixa', 'gerente'
    const [editingCompanyUser, setEditingCompanyUser] = null;

    // Estados para o modal de confirmação
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [confirmModalMessage, setConfirmModalMessage] = useState('');
    const [confirmModalAction, setConfirmModalAction] = useState(null); // Função a ser executada na confirmação
    const [confirmModalPayload, setConfirmModalPayload] = null; // Payload para a função de confirmação

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

    // Firebase Initialization and Auth Listener
    useEffect(() => {
        console.log("useEffect: Firebase Initialization and Auth Listener.");
        let firebaseConfig = null;
        let currentAppId = 'local-app-id';

        // Try to get config from Canvas environment
        if (typeof __firebase_config !== 'undefined' && typeof __app_id !== 'undefined') {
            try {
                firebaseConfig = JSON.parse(__firebase_config);
                currentAppId = __app_id;
                console.log("Firebase Config and App ID loaded from Canvas environment.");
            } catch (e) {
                console.error("Error parsing __firebase_config:", e);
                showMessage("Error loading Firebase configuration.", "error");
            }
        } else {
            console.warn("Variables __firebase_config or __app_id not defined. Using default fallback configuration.");
            // Fallback configuration for local development (REPLACE WITH YOUR ACTUAL FIREBASE CONFIG)
            firebaseConfig = {
                apiKey: "YOUR_FIREBASE_API_KEY",
                authDomain: "YOUR_FIREBASE_PROJECT_ID.firebaseapp.com",
                projectId: "YOUR_FIREBASE_PROJECT_ID",
                storageBucket: "YOUR_FIREBASE_PROJECT_ID.appspot.com",
                messagingSenderId: "YOUR_FIREBASE_MESSAGING_SENDER_ID",
                appId: "YOUR_FIREBASE_APP_ID",
                measurementId: "YOUR_FIREBASE_MEASUREMENT_ID"
            };
        }

        if (firebaseConfig) {
            try {
                const app = initializeApp(firebaseConfig);
                const auth = getAuth(app);
                const db = getFirestore(app);

                // eslint-disable-next-line no-unused-vars
                setFirebaseApp(app); // This line is where the ESLint warning occurs
                setFirebaseAuth(auth);
                setFirestoreDb(db);
                setAppId(currentAppId);

                console.log("Firebase App, Auth, and Firestore initialized and set to state.");

                // Auth state change listener
                const unsubscribe = onAuthStateChanged(auth, async (user) => {
                    console.log("Firebase Auth state changed. User:", user);
                    if (user) {
                        try {
                            const idTokenResult = await user.getIdTokenResult(true);
                            const role = idTokenResult.claims.role;
                            const companyName = idTokenResult.claims.company_name;
                            const design = idTokenResult.claims.design;

                            setCurrentUser({
                                username: user.uid, // Using UID as username for consistency with Flask
                                role: role,
                                company_name: companyName,
                                design: design
                            });
                            setIsLoggedIn(true);
                            console.log("User logged in and currentUser state updated:", user.uid, role);
                        } catch (claimsError) {
                            console.error("Error getting user claims:", claimsError);
                            showMessage("Error retrieving user details. Please try logging in again.", "error");
                            setIsLoggedIn(false);
                            setCurrentUser(null);
                        }
                    } else {
                        console.log("No user authenticated in Firebase.");
                        setIsLoggedIn(false);
                        setCurrentUser(null);
                    }
                });

                // Attempt to sign in with custom token from Canvas environment
                if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                    signInWithCustomToken(auth, __initial_auth_token)
                        .then(() => console.log("Signed in with initial custom token."))
                        .catch(error => console.error("Error signing in with initial custom token:", error));
                }

                return () => unsubscribe(); // Cleanup auth listener on component unmount
            } catch (e) {
                console.error("Critical error initializing Firebase:", e);
                showMessage("Critical error initializing Firebase. Please check console.", "error");
            }
        }
    }, []); // Empty dependency array means this runs once on mount

    // Firestore Listeners for Products, Sales, and Company Users (depend on firestoreDb and currentUser)
    useEffect(() => {
        console.log("useEffect: Firestore listeners triggered. firestoreDb:", !!firestoreDb, "currentUser:", currentUser);

        if (!firestoreDb || !currentUser || !currentUser.username) {
            console.log("Firestore listeners skipped: DB not ready or currentUser not set.");
            setProducts([]);
            setSales([]);
            setCompanyUsers([]);
            setCompanies([]);
            return;
        }

        console.log("Attempting to fetch Firestore data for user:", currentUser.username);

        let unsubscribeProducts;
        let unsubscribeSales;
        let unsubscribeCompanyUsers;
        let unsubscribeCompanies;

        // Products Listener (for company_admin, gerente, caixa)
        if (['company_admin', 'gerente', 'caixa'].includes(currentUser.role)) {
            const productsCollectionRef = collection(firestoreDb, `artifacts/${appId}/users/${currentUser.username}/products`);
            unsubscribeProducts = onSnapshot(productsCollectionRef, (snapshot) => {
                console.log("Firestore Products Snapshot received.");
                const productsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setProducts(productsData);
                console.log("Products loaded successfully!");
            }, (error) => {
                console.error("Error loading products:", error);
                showMessage("Error loading products from Firestore. Check permissions.", "error");
            });
        } else {
            setProducts([]);
        }

        // Sales Listener (for company_admin, gerente, caixa)
        if (['company_admin', 'gerente', 'caixa'].includes(currentUser.role)) {
            const salesCollectionRef = collection(firestoreDb, `artifacts/${appId}/users/${currentUser.username}/sales`);
            unsubscribeSales = onSnapshot(salesCollectionRef, (snapshot) => {
                console.log("Firestore Sales Snapshot received.");
                const salesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setSales(salesData);
                console.log("Sales loaded successfully!");
            }, (error) => {
                console.error("Error loading sales:", error);
                showMessage("Error loading sales from Firestore. Check permissions.", "error");
            });
        } else {
            setSales([]);
        }

        // Company Users Listener (ONLY for company_admin)
        if (currentUser.role === 'company_admin') {
            const companyUsersCollectionRef = collection(firestoreDb, `artifacts/${appId}/users/${currentUser.username}/company_users`);
            console.log("Firestore Company Users Listener Path:", companyUsersCollectionRef.path);
            unsubscribeCompanyUsers = onSnapshot(companyUsersCollectionRef, (snapshot) => {
                console.log("Firestore Company Users Snapshot received.");
                const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setCompanyUsers(usersData);
                console.log("Company users loaded successfully!", usersData);
            }, (error) => {
                console.error("Error loading company users:", error);
                showMessage("Error loading company users from Firestore. Check permissions.", "error");
            });
        } else {
            setCompanyUsers([]);
        }

        // Listener for companies list (ONLY for main admin)
        if (currentUser.role === 'admin') {
            const companiesCollectionRef = collection(firestoreDb, `artifacts/${appId}/users`);
            const q = query(companiesCollectionRef, where("role", "==", "company_admin"));

            unsubscribeCompanies = onSnapshot(q, (snapshot) => {
                console.log("Firestore Companies Snapshot received.");
                const companiesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setCompanies(companiesData);
                console.log("Companies loaded successfully!");
            }, (error) => {
                console.error("Error loading companies:", error);
                showMessage("Error loading companies from Firestore. Check permissions.", "error");
            });
        } else {
            setCompanies([]);
        }

        return () => {
            if (unsubscribeProducts) unsubscribeProducts();
            if (unsubscribeSales) unsubscribeSales();
            if (unsubscribeCompanyUsers) unsubscribeCompanyUsers();
            if (unsubscribeCompanies) unsubscribeCompanies();
            console.log("Firestore listeners for Products, Sales, Company Users, and Companies unsubscribed.");
        };
    }, [firestoreDb, currentUser, appId]); // Depend on firestoreDb and currentUser

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
        if (!firestoreDb || !currentUser || !firebaseAuth) {
            showMessage("Erro: Serviço de banco de dados ou autenticação não disponível.", "error");
            return;
        }

        // Calculate total cost of goods sold (CPV)
        const costOfGoodsSold = cart.reduce((sum, item) => sum + ((item.cost || 0) * item.quantity), 0);

        // Prepare basic sale data
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

        let saleId = null; // To store the generated sale ID

        try {
            // Pix logic
            if (paymentMethod === 'Pix') {
                setIsLoadingPix(true);
                setPixQrCodeData(null); // Clear previous Pix data

                // 1. Generate a unique sale ID BEFORE any backend call
                saleId = doc(collection(firestoreDb, `artifacts/${appId}/users/${currentUser.username}/sales`)).id;

                // 2. Create the sale document in Firestore with 'pending' status
                // This ensures the document exists to be updated by the webhook
                const pixSaleData = {
                    ...baseSaleData,
                    status: 'pending', // Initial status for Pix
                    payment_id: null, // Will be filled after MP response
                    sale_id_frontend: saleId // Save the frontend generated ID
                };
                await setDoc(doc(firestoreDb, `artifacts/${appId}/users/${currentUser.username}/sales`, saleId), pixSaleData);
                showMessage("Initiating Pix payment. Awaiting QR Code...", "info");

                // Get ID Token from the logged-in Firebase user
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
                    // Add data:image/png;base64, prefix if not present
                    if (data.qr_code_base64 && !data.qr_code_base64.startsWith('data:image/png;base64,')) {
                        data.qr_code_base64 = 'data:image/png;base64,' + data.qr_code_base64;
                    }
                    setPixQrCodeData(data);
                    showMessage("Pix QR Code generated successfully! Awaiting payment...", "success");

                    // 3. Update the sale document in Firestore with Mercado Pago payment_id
                    // This is crucial for the webhook to find and update
                    await updateDoc(doc(firestoreDb, `artifacts/${appId}/users/${currentUser.username}/sales`, saleId), {
                        payment_id: data.payment_id // Save Mercado Pago payment ID
                    });

                    // Do not clear cart here, as the sale is still pending.
                    // Cart will be cleared when the webhook confirms payment.

                } else {
                    // If Pix generation fails, remove the pending sale created
                    if (saleId) {
                        await deleteDoc(doc(firestoreDb, `artifacts/${appId}/users/${currentUser.username}/sales`, saleId));
                    }
                    showMessage(`Error generating Pix: ${data.error || 'Unknown error'}`, "error");
                }
            } else {
                // Logic for Cash and Card (non-Pix)
                // Add the sale directly to Firestore with 'completed' status
                const finalSaleData = {
                    ...baseSaleData,
                    status: 'completed' // Final status for Cash/Card
                };
                await addDoc(collection(firestoreDb, `artifacts/${appId}/users/${currentUser.username}/sales`), finalSaleData);
                showMessage("Sale finalized successfully!");
            }

            // Clear cart and reset states ONLY if sale is not Pix or if Pix was generated successfully
            if (paymentMethod !== 'Pix' || (paymentMethod === 'Pix' && pixQrCodeData)) {
                setCart([]);
                setPaymentAmount('');
                setChange(0);
                setDifference(0);
                setPaymentMethod('Dinheiro');
                setPixQrCodeData(null);
            }

        } catch (e) {
            console.error("Error finalizing sale or generating Pix:", e);
            showMessage("Error finalizing sale or generating Pix.", "error");
            // If sale was created but Pix failed, try to remove it
            if (saleId && paymentMethod === 'Pix') {
                try {
                    await deleteDoc(doc(firestoreDb, `artifacts/${appId}/users/${currentUser.username}/sales`, saleId));
                } catch (deleteError) {
                    console.error("Error removing pending sale after Pix generation failure:", deleteError);
                }
            }
        } finally {
            setIsLoadingPix(false);
        }
    };

    // Product Management Functions
    const handleAddProduct = async () => {
        if (!newProductName || !newProductValue || !newProductId || newProductCost === '') {
            showMessage("Fill in all product fields!", "error");
            return;
        }
        if (isNaN(parseFloat(newProductValue)) || isNaN(parseFloat(newProductCost))) {
            showMessage("Product value and cost must be numbers!", "error");
            return;
        }
        if (!firestoreDb || !currentUser) {
            showMessage("Error: Database or user not available.", "error");
            return;
        }

        const productData = {
            name: newProductName,
            value: parseFloat(newProductValue),
            cost: parseFloat(newProductCost)
        };

        try {
            // Reference to the document with the user-provided ID
            const productDocRef = doc(firestoreDb, `artifacts/${appId}/users/${currentUser.username}/products`, newProductId);
            const docSnap = await getDoc(productDocRef); // Check if document already exists

            if (docSnap.exists()) {
                showMessage("Product ID already exists! Choose a unique ID.", "error");
                return;
            }

            // Use setDoc to create a document with the user-provided ID
            await setDoc(productDocRef, productData);
            showMessage("Product added successfully!");
            setNewProductName('');
            setNewProductValue('');
            setNewProductCost('');
            setNewProductId('');
        } catch (e) {
            console.error("Error adding product: ", e);
            showMessage("Error adding product.", "error");
        }
    };

    const handleEditProduct = (product) => {
        setEditingProduct(product);
        setNewProductName(product.name);
        setNewProductValue(product.value.toString());
        setNewProductCost(product.cost ? product.cost.toString() : '');
        setNewProductId(product.id); // Keep the ID for display, but it's not editable
    };

    const handleUpdateProduct = async () => {
        if (!editingProduct || !newProductName || !newProductValue || newProductCost === '') {
            showMessage("Fill in all fields to update!", "error");
            return;
        }
        if (isNaN(parseFloat(newProductValue)) || isNaN(parseFloat(newProductCost))) {
            showMessage("Product value and cost must be numbers!", "error");
            return;
        }
        if (!firestoreDb || !currentUser) {
            showMessage("Error: Database or user not available.", "error");
            return;
        }

        const productRef = doc(firestoreDb, `artifacts/${appId}/users/${currentUser.username}/products`, editingProduct.id);
        try {
            await updateDoc(productRef, {
                name: newProductName,
                value: parseFloat(newProductValue),
                cost: parseFloat(newProductCost)
            });
            showMessage("Product updated successfully!");
            setEditingProduct(null);
            setNewProductName('');
            setNewProductValue('');
            setNewProductCost('');
            setNewProductId('');
        } catch (e) {
            console.error("Error updating product: ", e);
            showMessage("Error updating product.", "error");
        }
    };

    const handleDeleteProduct = async (productId) => {
        if (!firestoreDb || !currentUser) {
            showMessage("Error: Database or user not available.", "error");
            setShowConfirmModal(false);
            return;
        }
        setConfirmModalMessage(`Are you sure you want to delete product with ID: ${productId}?`);
        setConfirmModalAction(() => async () => {
            try {
                const docRef = doc(firestoreDb, `artifacts/${appId}/users/${currentUser.username}/products`, productId);
                await deleteDoc(docRef);
                showMessage("Product deleted successfully!");
            } catch (e) {
                console.error("Error deleting product:", e);
                if (e.code === 'permission-denied') {
                    showMessage("Permission error: You are not authorized to delete this product. Check permissions.", "error");
                } else {
                    showMessage("Error deleting product.", "error");
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

    // Calculate weekly sales report
    const getWeeklySales = () => {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        const weeklySales = sales.filter(sale => {
            // Ensure timestamp exists and is a Firestore Timestamp
            if (sale.timestamp && typeof sale.timestamp.toDate === 'function') {
                const saleDate = sale.timestamp.toDate();
                return saleDate >= oneWeekAgo;
            }
            return false;
        });

        const salesByDay = {};
        weeklySales.forEach(sale => {
            const saleDate = sale.timestamp.toDate().toLocaleDateString('pt-BR');
            // Sum profit instead of total
            if (!salesByDay[saleDate]) {
                salesByDay[saleDate] = 0;
            }
            salesByDay[saleDate] += sale.profit || (sale.total - (sale.costOfGoodsSold || 0)); // Ensure profit is calculated if not saved
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

    // --- Flask Backend Authentication Functions ---
    const handleLogin = async (e) => {
        e.preventDefault();
        console.log("Attempting login...");
        if (!firebaseAuth) {
            showMessage("Firebase authentication is not initialized.", "error");
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
            console.log("Login response data:", data);

            if (response.ok) {
                const firebaseToken = data.firebase_token;
                if (firebaseToken) {
                    try {
                        await signInWithCustomToken(firebaseAuth, firebaseToken);
                        showMessage(`Login successful! Welcome, ${data.username}.`, 'success');
                        // currentUser state will be updated by onAuthStateChanged listener
                        setLoginPassword('');
                        // Redirect to the appropriate tab after login
                        if (data.role === 'admin') {
                            setActiveTab('gerenciar_empresas');
                        } else {
                            setActiveTab('caixa');
                        }
                    } catch (firebaseError) {
                        console.error("Error authenticating with Firebase custom token:", firebaseError);
                        showMessage(`Error connecting to Firebase: ${firebaseError.message}`, 'error');
                        setIsLoggedIn(false);
                        setCurrentUser(null);
                    }
                } else {
                    showMessage("Error: Firebase token not received from backend.", "error");
                    console.error("Firebase token missing in Flask response. Full data:", data);
                }
            } else {
                showMessage(`Login error: ${data.error || 'Invalid credentials'}`, 'error');
            }
        } catch (error) {
            console.error('Error connecting to backend for login:', error);
            showMessage('Error connecting to server. Check if backend is running.', 'error');
        }
    };

    const handleLogout = async () => {
        console.log("Attempting logout...");
        if (!firebaseAuth) {
            showMessage("Firebase authentication is not initialized.", "error");
            return;
        }
        // Reset states that control listeners BEFORE logging out from Firebase Auth
        setIsLoggedIn(false);
        setCurrentUser(null);
        setLoginUsername('');
        setLoginPassword('');
        setCart([]);
        setProducts([]);
        setSales([]);
        setCompanies([]);
        setCompanyUsers([]);

        try {
            await firebaseAuth.signOut(); // Log out from Firebase Auth
            showMessage("You have been disconnected.", "info");
            setActiveTab('caixa'); // Return to default tab after logout
            console.log("Logout successful.");
        } catch (error) {
            console.error("Error logging out from Firebase:", error);
            showMessage("Error disconnecting.", "error");
        }
    };

    // --- Company Management Functions (for main admin) ---
    const handleRegisterCompany = async (e) => {
        e.preventDefault();
        if (!newCompanyUsername || !newCompanyPassword || !newCompanyName) {
            showMessage("Fill in all fields to register the company!", "error");
            return;
        }
        console.log("Attempting to register company...");

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
            console.log("Register company response data:", data);

            if (response.ok) {
                showMessage(`Company "${data.company_name}" (User: ${data.username}) registered successfully!`, 'success');
                setNewCompanyUsername('');
                setNewCompanyPassword('');
                setNewCompanyName('');
                setNewCompanyDesignTheme('default');
                setNewCompanyMercadoPagoAccessToken('');
            } else {
                showMessage(`Error registering company: ${data.error || 'Unknown error'}`, "error");
            }
        } catch (error) {
            console.error('Error connecting to backend to register company:', error);
            showMessage('Error connecting to server to register company.', 'error');
        }
    };

    // Function to delete a company (login)
    const handleDeleteCompany = async (companyIdToDelete) => {
        if (!firebaseAuth || !firebaseAuth.currentUser) {
            showMessage("Error: User not authenticated.", "error");
            setShowConfirmModal(false);
            return;
        }
        setConfirmModalMessage(`Are you sure you want to delete company ${companyIdToDelete} and ALL its data (products, sales, etc.)? This action is irreversible!`);
        setConfirmModalAction(() => async () => {
            console.log("Attempting to delete company:", companyIdToDelete);
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
                console.log("Delete company response data:", data);

                if (response.ok) {
                    showMessage(`Company "${companyIdToDelete}" deleted successfully!`, 'success');
                } else {
                    showMessage(`Error deleting company: ${data.error || 'Unknown error'}`, "error");
                }
            } catch (error) {
                console.error('Error connecting to backend to delete company:', error);
                showMessage('Error connecting to server to delete company.', 'error');
            } finally {
                setShowConfirmModal(false);
            }
        });
        setConfirmModalPayload(companyIdToDelete);
        setShowConfirmModal(true);
    };

    // --- Company User Management Functions (for company_admin) ---
    const handleAddCompanyUser = async (e) => {
        e.preventDefault();
        if (!newCompanyUserUsername || !newCompanyUserPassword || !newCompanyUserRole) {
            showMessage("Fill in all fields to add the user!", "error");
            return;
        }
        if (!currentUser || !currentUser.username || !firebaseAuth || !firebaseAuth.currentUser) {
            showMessage("Error: Company administrator not identified or not authenticated.", "error");
            return;
        }
        console.log("Attempting to add company user...");

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
            console.log("Add company user response data:", data);

            if (response.ok) {
                showMessage(`User "${data.username}" (${data.role}) added successfully!`, 'success');
                setNewCompanyUserUsername('');
                setNewCompanyUserPassword('');
                setNewCompanyUserRole('caixa');
            } else {
                showMessage(`Error adding user: ${data.error || 'Unknown error'}`, "error");
            }
        } catch (e) {
            console.error("Error adding company user: ", e);
            showMessage("Error connecting to server to add user.", "error");
        }
    };

    const handleEditCompanyUser = (user) => {
        setEditingCompanyUser(user);
        setNewCompanyUserUsername(user.username);
        setNewCompanyUserRole(user.role);
        setNewCompanyUserPassword(''); // Do not load password for security
    };

    const handleUpdateCompanyUser = async (e) => {
        e.preventDefault();
        if (!editingCompanyUser || !newCompanyUserUsername || !newCompanyUserRole) {
            showMessage("Fill in all fields to update the user!", "error");
            return;
        }
        if (!currentUser || !currentUser.username || !firebaseAuth || !firebaseAuth.currentUser) {
            showMessage("Error: Company administrator not identified or not authenticated.", "error");
            return;
        }
        console.log("Attempting to update company user:", editingCompanyUser.id);

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
                    user_id: editingCompanyUser.id, // The Firestore user document ID (which is firebase_uid)
                    username: newCompanyUserUsername,
                    password: newCompanyUserPassword || null, // Send null if password is not changed
                    role: newCompanyUserRole
                }),
            });

            const data = await response.json();
            console.log("Update company user response data:", data);

            if (response.ok) {
                showMessage(`User "${data.username}" updated successfully!`, 'success');
                setEditingCompanyUser(null);
                setNewCompanyUserUsername('');
                setNewCompanyUserPassword('');
                setNewCompanyUserRole('caixa');
            } else {
                showMessage(`Error updating user: ${data.error || 'Unknown error'}`, "error");
            }
        } catch (e) {
            console.error("Error updating company user: ", e);
            showMessage("Error connecting to server to update user.", "error");
        }
    };

    const handleDeleteCompanyUser = async (userIdToDelete) => {
        if (!currentUser || !currentUser.username || !firebaseAuth || !firebaseAuth.currentUser) {
            showMessage("Error: Company administrator not identified or not authenticated.", "error");
            setShowConfirmModal(false);
            return;
        }
        setConfirmModalMessage(`Are you sure you want to delete user ${userIdToDelete}? This action is irreversible!`);
        setConfirmModalAction(() => async () => {
            console.log("Attempting to delete company user:", userIdToDelete);
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
                        user_id: userIdToDelete // The Firestore user document ID (which is firebase_uid)
                    }),
                });

                const data = await response.json();
                console.log("Delete company user response data:", data);

                if (response.ok) {
                    showMessage(`User "${userIdToDelete}" deleted successfully!`, 'success');
                } else {
                    showMessage(`Error deleting user: ${data.error || 'Unknown error'}`, "error");
                }
            } catch (e) {
                console.error("Error deleting company user:", e);
                showMessage("Error connecting to server to delete user.", "error");
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

    // Function to copy Pix key to clipboard
    const copyPixKeyToClipboard = (key) => {
        // Use document.execCommand('copy') for compatibility in iframes
        const el = document.createElement('textarea');
        el.value = key;
        document.body.appendChild(el);
        el.select();
        try {
            document.execCommand('copy');
            showMessage("Pix key copied!", "success");
        } catch (err) {
            console.error('Error copying Pix key:', err);
            showMessage("Failed to copy Pix key.", "error");
        }
        document.body.removeChild(el);
    };

    // NEW: Function to cancel Pix payment
    const handleCancelPixPayment = async (paymentId) => {
        if (!currentUser || !currentUser.username || !firebaseAuth || !firebaseAuth.currentUser) {
            showMessage("Error: Company user not identified to cancel Pix.", "error");
            setShowConfirmModal(false);
            return;
        }
        setConfirmModalMessage(`Are you sure you want to cancel Pix payment with ID ${paymentId}?`);
        setConfirmModalAction(() => async () => {
            console.log("Attempting to cancel Pix payment:", paymentId);

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
                console.log("Cancel Pix response data:", data);

                if (response.ok) {
                    showMessage(`Pix payment ${paymentId} cancelled successfully!`, 'success');
                    // Optional: Update sale status in Firestore on the frontend if needed
                    // Or rely on Mercado Pago webhook to do this
                } else {
                    showMessage(`Error cancelling Pix: ${data.error || 'Unknown error'}`, "error");
                }
            } catch (error) {
                console.error('Error connecting to server to cancel Pix:', error);
                showMessage('Error connecting to server to cancel Pix.', "error");
            } finally {
                setShowConfirmModal(false);
            }
        });
        setConfirmModalPayload(paymentId);
        setShowConfirmModal(true);
    };

    // Filter products based on search term
    const filteredProducts = products.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Helper function to get Tailwind classes safely
    const getThemeClasses = (element) => {
        const theme = currentUser?.design || DEFAULT_THEMES.default;

        const getColorClass = (prop, defaultColor) => {
            const color = theme[prop];
            if (color && typeof color === 'string' && color.includes('-')) {
                return color; // Already a complete Tailwind class like 'bg-blue-500'
            }
            // Fallback to a default Tailwind color class
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

    // Render login screen if user is not logged in
    if (!isLoggedIn) {
        return (
            <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-gray-800">
                {/* Background Video for login screen */}
                <video
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="absolute z-0 w-full h-full object-cover"
                    src="https://videos.pexels.com/video-files/3752548/3752548-hd_1920_1080_24fps.mp4"
                    onError={(e) => console.error("Error loading login screen background video:", e)}
                >
                    Your browser does not support the video tag.
                </video>

                {/* Overlay for readability */}
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
                                Username:
                            </label>
                            <input
                                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                id="loginUsername"
                                type="text"
                                placeholder="Username"
                                value={loginUsername}
                                onChange={(e) => setLoginUsername(e.target.value)}
                                required
                            />
                        </div>
                        <div className="mb-6">
                            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="loginPassword">
                                Password:
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

    // Render the main application if user is logged in
    const currentDesign = currentUser?.design || DEFAULT_THEMES.default; // Ensure currentDesign is not null

    // Determine if the "Manage Companies" tab background video should be active
    const showCompanyManagementVideo = isLoggedIn && activeTab === 'gerenciar_empresas' && currentUser?.role === 'admin';

    // Define background style dynamically (colors/gradient)
    const backgroundClasses = currentDesign.dominant_color
        ? `${currentDesign.dominant_color}` // Use dominant color if defined
        : `${currentDesign.gradient_from || 'from-blue-50'} ${currentDesign.gradient_to || 'to-indigo-100'}`; // Fallback to gradient if no dominant color

    return (
        <div
            className={`min-h-screen p-4 ${getThemeClasses('font_family')} flex flex-col items-center relative`}
        >
            {/* Conditional Background Video for "Manage Companies" tab */}
            {showCompanyManagementVideo && (
                <>
                    <video
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="absolute z-0 w-full h-full object-cover top-0 left-0"
                        src="https://videos.pexels.com/video-files/30163656/12934691_1920_1080_30fps.mp4"
                        onError={(e) => console.error("Error loading Manage Companies background video:", e)}
                    >
                        Your browser does not support the video tag for the company management background.
                    </video>
                    {/* Overlay for readability over background video */}
                    <div className="absolute z-10 w-full h-full bg-black opacity-50 top-0 left-0"></div>
                </>
            )}

            {/* Conditional color/gradient background for other tabs */}
            {!showCompanyManagementVideo && (
                <div className={`absolute z-0 w-full h-full top-0 left-0 ${backgroundClasses}`}></div>
            )}

            {/* All application content with a higher z-index to be above the background */}
            <div className="relative z-20 w-full flex flex-col items-center">
                {/* User ID Display */}
                {currentUser && (
                    <div className="absolute top-4 left-4 bg-white p-2 rounded-lg shadow-md text-sm text-gray-700">
                        Logged in User: <span className="font-semibold">{currentUser.username}</span> (Role: {currentUser.role})
                        {currentUser.company_name && (
                            <span className="ml-2">Company: {currentUser.company_name}</span>
                        )}
                        <button
                            onClick={handleLogout}
                            className="ml-4 bg-red-500 hover:bg-red-600 text-white text-xs px-2 py-1 rounded-full transition-colors duration-200"
                        >
                            Logout
                        </button>
                    </div>
                )}

                {/* Message Box */}
                {message && (
                    <div className={`fixed top-4 right-4 p-3 rounded-lg shadow-lg text-white z-50 transition-opacity duration-300 ${message.type === 'success' ? getThemeClasses('success_color') : getThemeClasses('error_color')}`}>
                        {message.text}
                    </div>
                )}

                <h1 className={`text-4xl font-extrabold ${getThemeClasses('text_color_strong')} mb-8 mt-4 rounded-xl p-3 bg-white shadow-lg`}>
                    Cash Manager
                </h1>

                {/* Navigation Tabs */}
                <div className="flex space-x-4 mb-8 bg-white p-2 rounded-full shadow-md">
                    {/* Cashier Tab - Visible to company_admin, manager, cashier */}
                    {(currentUser.role === 'company_admin' || currentUser.role === 'gerente' || currentUser.role === 'caixa') && (
                        <button
                            onClick={() => setActiveTab('caixa')}
                            className={`px-6 py-3 rounded-full text-lg font-medium transition-all duration-300 ${activeTab === 'caixa' ? `${getThemeClasses('primary_button_bg')} text-white shadow-lg` : `${getThemeClasses('secondary_button_bg')} ${getThemeClasses('secondary_button_text')} ${getThemeClasses('secondary_button_hover_bg')}`}`}
                        >
                            Cashier
                        </button>
                    )}
                    {/* Products Tab - Visible to company_admin and manager */}
                    {(currentUser.role === 'company_admin' || currentUser.role === 'gerente') && (
                        <button
                            onClick={() => setActiveTab('produtos')}
                            className={`px-6 py-3 rounded-full text-lg font-medium transition-all duration-300 ${activeTab === 'produtos' ? `${getThemeClasses('primary_button_bg')} text-white shadow-lg` : `${getThemeClasses('secondary_button_bg')} ${getThemeClasses('secondary_button_text')} ${getThemeClasses('secondary_button_hover_bg')}`}`}
                        >
                            Products
                        </button>
                    )}
                    {/* Reports Tab - Visible to company_admin and manager */}
                    {(currentUser.role === 'company_admin' || currentUser.role === 'gerente') && (
                        <button
                            onClick={() => setActiveTab('relatorios')}
                            className={`px-6 py-3 rounded-full text-lg font-medium transition-all duration-300 ${activeTab === 'relatorios' ? `${getThemeClasses('primary_button_bg')} text-white shadow-lg` : `${getThemeClasses('secondary_button_bg')} ${getThemeClasses('secondary_button_text')} ${getThemeClasses('secondary_button_hover_bg')}`}`}
                        >
                            Reports
                        </button>
                    )}
                    {/* Manage Users Tab - Visible ONLY to company_admin */}
                    {currentUser.role === 'company_admin' && (
                        <button
                            onClick={() => setActiveTab('gerenciar_usuarios')}
                            className={`px-6 py-3 rounded-full text-lg font-medium transition-all duration-300 ${activeTab === 'gerenciar_usuarios' ? `${getThemeClasses('primary_button_bg')} text-white shadow-lg` : `${getThemeClasses('secondary_button_bg')} ${getThemeClasses('secondary_button_text')} ${getThemeClasses('secondary_button_hover_bg')}`}`}
                        >
                            Manage Users
                        </button>
                    )}
                    {/* Manage Companies Tab - Visible ONLY to main admin */}
                    {currentUser.role === 'admin' && (
                        <button
                            onClick={() => setActiveTab('gerenciar_empresas')}
                            className={`px-6 py-3 rounded-full text-lg font-medium transition-all duration-300 ${activeTab === 'gerenciar_empresas' ? `${getThemeClasses('primary_button_bg')} text-white shadow-lg` : `${getThemeClasses('secondary_button_bg')} ${getThemeClasses('secondary_button_text')} ${getThemeClasses('secondary_button_hover_bg')}`}`}
                        >
                            Manage Companies
                        </button>
                    )}
                </div>

                {/* Cashier Tab Content (Visible to company_admin, manager, cashier) */}
                {(activeTab === 'caixa' && (currentUser.role === 'company_admin' || currentUser.role === 'gerente' || currentUser.role === 'caixa')) && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 w-full max-w-7xl">
                        {/* Products List */}
                        <div className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-xl">
                            <h2 className={`text-2xl font-bold ${getThemeClasses('text_color_medium')} mb-4 pb-2 border-b-2 ${getThemeClasses('border_color')}`}>
                                Available Products
                            </h2>
                            {/* Search Bar */}
                            <div className="mb-4">
                                <input
                                    type="text"
                                    placeholder="Search product by name or ID..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                            <div className="max-h-96 overflow-y-auto">
                                {filteredProducts.length === 0 ? (
                                    <p className="text-gray-500">No products found or registered.</p>
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
                                                Add
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Cart and Payment */}
                        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-xl flex flex-col">
                            <h2 className={`text-2xl font-bold ${getThemeClasses('text_color_medium')} mb-4 pb-2 border-b-2 ${getThemeClasses('border_color')}`}>
                                Shopping Cart
                            </h2>
                            <div className="flex-grow max-h-80 overflow-y-auto mb-4">
                                {cart.length === 0 ? (
                                    <p className="text-gray-500">Cart is empty.</p>
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
                                                    Remove
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
                                    <label htmlFor="paymentMethod" className={`block ${getThemeClasses('text_color_medium')} text-lg font-semibold mb-2`}>Payment Method:</label>
                                    <select
                                        id="paymentMethod"
                                        value={paymentMethod}
                                        onChange={(e) => {
                                            setPaymentMethod(e.target.value);
                                            setPixQrCodeData(null); // Clear Pix data when changing method
                                        }}
                                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-lg"
                                    >
                                        <option value="Dinheiro">Cash</option>
                                        <option value="Cartao">Card</option>
                                        <option value="Pix">Pix</option>
                                    </select>
                                </div>

                                {paymentMethod === 'Dinheiro' && (
                                    <div className="mb-4">
                                        <label htmlFor="paymentAmount" className={`block ${getThemeClasses('text_color_medium')} text-lg font-semibold mb-2`}>Amount Paid:</label>
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
                                        <p className="font-semibold">Pix Functionality:</p>
                                        <p className="text-sm">
                                            To generate the Pix QR Code, the application will make a request to your Flask backend.
                                        </p>
                                        {isLoadingPix ? (
                                            <div className="flex justify-center items-center py-4">
                                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
                                                <p className="ml-3">Generating QR Code...</p>
                                            </div>
                                        ) : pixQrCodeData ? (
                                            <div className="mt-3 text-center">
                                                {/* QR Code Image (using base64 from backend) */}
                                                <img
                                                    src={pixQrCodeData.qr_code_base64 || `https://placehold.co/150x150/E0F2F7/000000?text=QR+Code+Pix`}
                                                    alt="Pix QR Code"
                                                    className="mx-auto rounded-lg shadow-md w-64 h-64"
                                                />
                                                <p className="mt-2 text-sm text-gray-700">
                                                    "Copy and paste" key:
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
                                                        Copy
                                                    </button>
                                                </div>
                                                {/* NEW: Cancel Pix Payment Button */}
                                                {pixQrCodeData.payment_id && (
                                                    <button
                                                        onClick={() => handleCancelPixPayment(pixQrCodeData.payment_id)}
                                                        className="mt-4 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm shadow-md"
                                                    >
                                                        Cancel Pix Payment
                                                    </button>
                                                )}
                                                <p className="mt-2 text-xs text-gray-600">
                                                    * In a real scenario, the sale would be finalized after Pix payment confirmation via webhook.
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="mt-3 text-center">
                                                {/* Placeholder for QR Code before generation */}
                                                <img
                                                    src="https://placehold.co/150x150/E0F2F7/000000?text=QR+Code+Pix"
                                                    alt="Placeholder QR Code Pix"
                                                    className="mx-auto rounded-lg shadow-md w-64 h-64"
                                                />
                                                <p className="mt-2 text-xs text-gray-600">
                                                    Click "Finalize Sale" to generate the QR Code.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className={`flex justify-between items-center text-xl ${getThemeClasses('text_color_medium')} mb-2`}>
                                    <span>Difference:</span>
                                    <span className="font-bold text-red-600">R$ {difference.toFixed(2)}</span>
                                </div>
                                <div className={`flex justify-between items-center text-xl ${getThemeClasses('text_color_medium')} mb-4`}>
                                    <span>Change:</span>
                                    <span className="font-bold text-green-600">R$ {change.toFixed(2)}</span>
                                </div>

                                <button
                                    onClick={finalizeSale}
                                    className={`w-full ${getThemeClasses('primary_button_bg')} ${getThemeClasses('primary_button_hover_bg')} text-white text-xl font-bold py-4 rounded-xl transition-all duration-300 shadow-lg transform hover:scale-105`}
                                >
                                    Finalize Sale
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Products Tab Content (Visible to company_admin and manager) */}
                {(activeTab === 'produtos' && (currentUser.role === 'company_admin' || currentUser.role === 'gerente')) && (
                    <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-4xl">
                        <h2 className={`text-3xl font-bold ${getThemeClasses('text_color_medium')} mb-6 pb-3 border-b-2 ${getThemeClasses('border_color')}`}>
                            {editingProduct ? 'Edit Product' : 'Add New Product'}
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            <div>
                                <label htmlFor="newProductId" className={`block ${getThemeClasses('text_color_medium')} font-semibold mb-2`}>Product ID:</label>
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
                                <label htmlFor="newProductName" className={`block ${getThemeClasses('text_color_medium')} font-semibold mb-2`}>Product Name:</label>
                                <input
                                    type="text"
                                    id="newProductName"
                                    value={newProductName}
                                    onChange={(e) => setNewProductName(e.target.value)}
                                    placeholder="Ex: Soda Can"
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                            <div>
                                <label htmlFor="newProductValue" className={`block ${getThemeClasses('text_color_medium')} font-semibold mb-2`}>Value (R$):</label>
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
                            {/* Field for Product Cost */}
                            <div>
                                <label htmlFor="newProductCost" className={`block ${getThemeClasses('text_color_medium')} font-semibold mb-2`}>Cost (R$):</label>
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
                                        Update Product
                                    </button>
                                    <button
                                        onClick={cancelEdit}
                                        className={`bg-gray-500 hover:bg-gray-600 text-white px-6 py-3 rounded-xl font-bold transition-all duration-300 shadow-md transform hover:scale-105`}
                                    >
                                        Cancel
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={handleAddProduct}
                                    className={`${getThemeClasses('primary_button_bg')} ${getThemeClasses('primary_button_hover_bg')} text-white px-6 py-3 rounded-xl font-bold transition-all duration-300 shadow-md transform hover:scale-105`}
                                >
                                    Add Product
                                </button>
                            )}
                        </div>

                        <h3 className={`text-2xl font-bold ${getThemeClasses('text_color_medium')} mt-10 mb-4 pb-2 border-b-2 ${getThemeClasses('border_color')}`}>
                            Product List
                        </h3>
                        <div className="max-h-96 overflow-y-auto">
                            {products.length === 0 ? (
                                <p className="text-gray-500">No products registered.</p>
                            ) : (
                                <ul className="space-y-3">
                                    {products.map(product => (
                                        <li key={product.id} className="flex justify-between items-center bg-gray-50 p-4 rounded-lg shadow-sm">
                                            <div>
                                                <p className={`font-semibold ${getThemeClasses('text_color_strong')} text-lg`}>Product: {product.name} (ID: {product.id})</p>
                                                <p className={`${getThemeClasses('highlight_color')} font-bold text-xl`}>R$ {product.value.toFixed(2)}</p>
                                                <p className="text-gray-600 text-sm">Cost: R$ {product.cost ? product.cost.toFixed(2) : '0.00'}</p>
                                            </div>
                                            <div className="flex space-x-3">
                                                <button
                                                    onClick={() => handleEditProduct(product)}
                                                    className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-full transition-colors duration-200 shadow-md"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteProduct(product.id)}
                                                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-full transition-colors duration-200 shadow-md"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                )}

                {/* Reports Tab Content (Visible to company_admin and manager) */}
                {(activeTab === 'relatorios' && (currentUser.role === 'company_admin' || currentUser.role === 'gerente')) && (
                    <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-4xl">
                        <h2 className={`text-3xl font-bold ${getThemeClasses('text_color_medium')} mb-6 pb-3 border-b-2 ${getThemeClasses('border_color')}`}>
                            Weekly Profit Report
                        </h2>
                        {sales.length === 0 ? (
                            <p className="text-gray-500">No sales registered yet.</p>
                        ) : (
                            <div className="max-h-96 overflow-y-auto">
                                <table className="min-w-full bg-white rounded-lg shadow-md">
                                    <thead className={`${getThemeClasses('primary_button_bg')} text-white`}>
                                        <tr>
                                            <th className="py-3 px-4 text-left text-sm font-semibold uppercase">Date</th>
                                            <th className="py-3 px-4 text-left text-sm font-semibold uppercase">Total Profit</th>
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
                                    <p className="text-gray-500 mt-4">No sales in the last week.</p>
                                )}
                            </div>
                        )}

                        <h3 className={`text-2xl font-bold ${getThemeClasses('text_color_medium')} mt-10 mb-4 pb-2 border-b-2 ${getThemeClasses('border_color')}`}>
                            All Sales
                        </h3>
                        <div className="max-h-96 overflow-y-auto">
                            {sales.length === 0 ? (
                                <p className="text-gray-500">No sales registered yet.</p>
                            ) : (
                                <table className="min-w-full bg-white rounded-lg shadow-md">
                                    <thead className={`${getThemeClasses('primary_button_bg')} text-white`}>
                                        <tr>
                                            <th className="py-3 px-4 text-left text-sm font-semibold uppercase">Date/Time</th>
                                            <th className="py-3 px-4 text-left text-sm font-semibold uppercase">Items</th>
                                            <th className="py-3 px-4 text-left text-sm font-semibold uppercase">Total</th>
                                            <th className="py-3 px-4 text-left text-sm font-semibold uppercase">Cost</th>
                                            <th className="py-3 px-4 text-left text-sm font-semibold uppercase">Profit</th>
                                            <th className="py-3 px-4 text-left text-sm font-semibold uppercase">Method</th>
                                            <th className="py-3 px-4 text-left text-sm font-semibold uppercase">Status</th>
                                            <th className="py-3 px-4 text-left text-sm font-semibold uppercase">Actions</th>
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
                                                        <span className="text-yellow-600 font-semibold">Pending</span>
                                                    ) : sale.paymentMethod === 'Pix' && sale.status === 'approved' ? (
                                                        <span className="text-green-600 font-semibold">Approved</span>
                                                    ) : sale.paymentMethod === 'Pix' && sale.status === 'cancelled' ? (
                                                        <span className="text-red-600 font-semibold">Cancelled</span>
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
                                                            Cancel Pix
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

                {/* Manage Users Tab Content (Visible ONLY to company_admin) */}
                {activeTab === 'gerenciar_usuarios' && currentUser.role === 'company_admin' && (
                    <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-4xl">
                        <h2 className={`text-3xl font-bold ${getThemeClasses('text_color_medium')} mb-6 pb-3 border-b-2 ${getThemeClasses('border_color')}`}>
                            {editingCompanyUser ? 'Edit Company User' : 'Add New Company User'}
                        </h2>
                        <form onSubmit={editingCompanyUser ? handleUpdateCompanyUser : handleAddCompanyUser} className="space-y-4 mb-8">
                            <div>
                                <label htmlFor="newCompanyUserUsername" className={`block ${getThemeClasses('text_color_medium')} font-semibold mb-2`}>Username:</label>
                                <input
                                    type="text"
                                    id="newCompanyUserUsername"
                                    value={newCompanyUserUsername}
                                    onChange={(e) => setNewCompanyUserUsername(e.target.value)}
                                    placeholder="Ex: cashier01"
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                    required
                                    disabled={!!editingCompanyUser} // Disable username editing
                                />
                            </div>
                            <div>
                                <label htmlFor="newCompanyUserPassword" className={`block ${getThemeClasses('text_color_medium')} font-semibold mb-2`}>Password:</label>
                                <input
                                    type="password"
                                    id="newCompanyUserPassword"
                                    value={newCompanyUserPassword}
                                    onChange={(e) => setNewCompanyUserPassword(e.target.value)}
                                    placeholder={editingCompanyUser ? "Leave blank to keep current password" : "********"}
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                    required={!editingCompanyUser} // Password is required only when adding
                                />
                            </div>
                            <div>
                                <label htmlFor="newCompanyUserRole" className={`block ${getThemeClasses('text_color_medium')} font-semibold mb-2`}>Role:</label>
                                <select
                                    id="newCompanyUserRole"
                                    value={newCompanyUserRole}
                                    onChange={(e) => setNewCompanyUserRole(e.target.value)}
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                    required
                                >
                                    <option value="caixa">Cashier</option>
                                    <option value="gerente">Manager</option>
                                    {/* company_admin cannot create another company_admin */}
                                </select>
                            </div>
                            <div className="flex justify-end space-x-4">
                                {editingCompanyUser ? (
                                    <>
                                        <button
                                            type="submit"
                                            className={`bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-bold transition-all duration-300 shadow-md transform hover:scale-105`}
                                        >
                                            Update User
                                        </button>
                                        <button
                                            type="button"
                                            onClick={cancelEditCompanyUser}
                                            className={`bg-gray-500 hover:bg-gray-600 text-white px-6 py-3 rounded-xl font-bold transition-all duration-300 shadow-md transform hover:scale-105`}
                                        >
                                            Cancel
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        type="submit"
                                        className={`${getThemeClasses('primary_button_bg')} ${getThemeClasses('primary_button_hover_bg')} text-white px-6 py-3 rounded-xl font-bold transition-all duration-300 shadow-md transform hover:scale-105`}
                                >
                                        Add User
                                    </button>
                                )}
                            </div>
                        </form>

                        <h3 className={`text-2xl font-bold ${getThemeClasses('text_color_medium')} mt-10 mb-4 pb-2 border-b-2 ${getThemeClasses('border_color')}`}>
                            Company Users
                        </h3>
                        <div className="max-h-96 overflow-y-auto">
                            {companyUsers.length === 0 ? (
                                <p className="text-gray-500">No users registered for this company.</p>
                            ) : (
                                <ul className="space-y-3">
                                    {companyUsers.map(user => (
                                        <li key={user.id} className="flex justify-between items-center bg-gray-50 p-4 rounded-lg shadow-sm">
                                            <div>
                                                <p className={`font-semibold ${getThemeClasses('text_color_strong')} text-lg`}>User: {user.username}</p>
                                                <p className="text-gray-600 text-sm">Role: {user.role}</p>
                                                {/* Optional: Show firebase_uid for debugging */}
                                                {/* <p className="text-gray-400 text-xs">UID: {user.firebase_uid}</p> */}
                                            </div>
                                            <div className="flex space-x-3">
                                                <button
                                                    onClick={() => handleEditCompanyUser(user)}
                                                    className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-full transition-colors duration-200 shadow-md"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteCompanyUser(user.id)}
                                                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-full transition-colors duration-200 shadow-md"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                )}

                {/* Manage Companies Tab Content (Visible ONLY to main admin) */}
                {activeTab === 'gerenciar_empresas' && currentUser.role === 'admin' && (
                    <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-4xl">
                        <h2 className={`text-3xl font-bold ${getThemeClasses('text_color_medium')} mb-6 pb-3 border-b-2 ${getThemeClasses('border_color')}`}>
                            Register New Company
                        </h2>
                        <form onSubmit={handleRegisterCompany} className="space-y-4 mb-8">
                            <div>
                                <label htmlFor="newCompanyUsername" className={`block ${getThemeClasses('text_color_medium')} font-semibold mb-2`}>Company Username (ID):</label>
                                <input
                                    type="text"
                                    id="newCompanyUsername"
                                    value={newCompanyUsername}
                                    onChange={(e) => setNewCompanyUsername(e.target.value)}
                                    placeholder="Ex: company_abc"
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                    required
                                />
                            </div>
                            <div>
                                <label htmlFor="newCompanyPassword" className={`block ${getThemeClasses('text_color_medium')} font-semibold mb-2`}>Company Password:</label>
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
                                <label htmlFor="newCompanyName" className={`block ${getThemeClasses('text_color_medium')} font-semibold mb-2`}>Full Company Name:</label>
                                <input
                                    type="text"
                                    id="newCompanyName"
                                    value={newCompanyName}
                                    onChange={(e) => setNewCompanyName(e.target.value)}
                                    placeholder="Ex: ABC Commerce and Services Ltd."
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                    required
                                />
                            </div>
                            <div>
                                <label htmlFor="newCompanyDesignTheme" className={`block ${getThemeClasses('text_color_medium')} font-semibold mb-2`}>Design Theme (Colors/Fonts):</label>
                                <select
                                    id="newCompanyDesignTheme"
                                    value={newCompanyDesignTheme}
                                    onChange={(e) => setNewCompanyDesignTheme(e.target.value)}
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                >
                                    <option value="default">Default</option>
                                    <option value="corporate">Corporate</option>
                                    <option value="vibrant">Vibrant</option>
                                </select>
                            </div>
                            <div>
                                <label htmlFor="newCompanyMercadoPagoAccessToken" className={`block ${getThemeClasses('text_color_medium')} font-semibold mb-2`}>Mercado Pago Access Token:</label>
                                <input
                                    type="text"
                                    id="newCompanyMercadoPagoAccessToken"
                                    value={newCompanyMercadoPagoAccessToken}
                                    onChange={(e) => setNewCompanyMercadoPagoAccessToken(e.target.value)}
                                    placeholder="MP Token (ex: APP_USR-xxxxxxxxxxxx)"
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                            <div className="flex justify-end">
                                <button
                                    type="submit"
                                    onClick={handleRegisterCompany}
                                    className={`bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-bold transition-all duration-300 shadow-md transform hover:scale-105`}
                                >
                                    Register Company
                                </button>
                            </div>
                        </form>

                        <h3 className={`text-2xl font-bold ${getThemeClasses('text_color_medium')} mt-10 mb-4 pb-2 border-b-2 ${getThemeClasses('border_color')}`}>
                            Registered Companies
                        </h3>
                        <div className="max-h-96 overflow-y-auto">
                            {companies.length === 0 ? (
                                <p className="text-gray-500">No companies registered yet.</p>
                            ) : (
                                <ul className="space-y-3">
                                    {companies.map(company => (
                                        <li key={company.id} className="flex justify-between items-center bg-gray-50 p-4 rounded-lg shadow-sm">
                                            <div>
                                                <p className={`font-semibold ${getThemeClasses('text_color_strong')} text-lg`}>Name: {company.company_name}</p>
                                                <p className="text-gray-600 text-sm">User (ID): {company.id}</p>
                                                <p className="text-gray-600 text-sm">Theme: {company.design_theme}</p>
                                            </div>
                                            <div className="flex space-x-3">
                                                <button
                                                    onClick={() => handleDeleteCompany(company.id)}
                                                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-full transition-colors duration-200 shadow-md"
                                                >
                                                    Delete Company
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
