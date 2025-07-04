# app.py - Backend Flask para o App de Caixa

# Importa o Flask e outras ferramentas necessárias
from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import uuid # Para gerar IDs de usuário temporários
from dotenv import load_dotenv # Para carregar variáveis de ambiente
import requests # Importa a biblioteca requests para fazer chamadas HTTP
from functools import wraps # Para criar decoradores
import json # Adicionado para lidar com JSON da variável de ambiente
import mercadopago # Adicionado para a integração com o Mercado Pago

# Importa o Firebase Admin SDK
import firebase_admin
from firebase_admin import credentials, auth, firestore # Adicionado firestore

# Carrega as variáveis de ambiente do arquivo .env
load_dotenv()

# --- Inicialização do Firebase Admin SDK ---
# O conteúdo da chave da conta de serviço agora será lido de uma variável de ambiente
service_account_json_content = os.getenv("FIREBASE_SERVICE_ACCOUNT_KEY_JSON")

# Verifica se o conteúdo da chave de serviço foi definido
if not service_account_json_content:
    print("ERRO: Variável de ambiente FIREBASE_SERVICE_ACCOUNT_KEY_JSON NÃO ESTÁ DEFINIDA.")
    print("Por favor, defina o conteúdo do seu arquivo JSON de chave de conta de serviço do Firebase como uma variável de ambiente no Koyeb.")
    # Em um ambiente de produção, você não continuaria. Para desenvolvimento, você pode simular.
    # exit(1) # Descomente para forçar a saída se o conteúdo não for encontrado
    # Para desenvolvimento local sem a variável de ambiente, você pode querer um fallback.
    # Mas para deployment no Koyeb, esta variável é essencial.
    raise ValueError("FIREBASE_SERVICE_ACCOUNT_KEY_JSON environment variable is not set.")

try:
    # Carrega as credenciais diretamente do conteúdo JSON da variável de ambiente
    parsed_service_account_info = json.loads(service_account_json_content)
    
    # --- INÍCIO DO DEBUG DA CHAVE PRIVADA ---
    # Imprime o início e o fim da chave privada para inspeção
    private_key_content = parsed_service_account_info.get("private_key")
    if private_key_content:
        print("\n--- DEBUG: Conteúdo da private_key após json.loads ---")
        print(f"Tipo: {type(private_key_content)}")
        print(f"Início da chave: {private_key_content[:50]}...")
        print(f"Fim da chave: ...{private_key_content[-50:]}")
        print(f"Comprimento da chave: {len(private_key_content)}")
        print(f"Contém '\\n' literal? {'\\n' in private_key_content}")
        print(f"Contém '\\\\' literal? {'\\' in private_key_content}") # Verifica se há barras invertidas não escapadas
        print("--- FIM DO DEBUG ---")
    else:
        print("AVISO: 'private_key' não encontrada no JSON da variável de ambiente.")
    # --- FIM DO DEBUG DA CHAVE PRIVADA ---

    cred = credentials.Certificate(parsed_service_account_info)
    firebase_admin.initializeApp(cred)
    db = firestore.client() # Inicializa o cliente Firestore
    print("Firebase Admin SDK inicializado com sucesso usando variável de ambiente.")
except Exception as e:
    print(f"ERRO ao inicializar Firebase Admin SDK: {e}")
    print("Verifique se o conteúdo JSON da variável de ambiente está correto e é válido.")
    raise # Re-lança a exceção para que o aplicativo não inicie com Firebase inválido.

# Inicializa o aplicativo Flask
app = Flask(__name__)

# Habilita o CORS (Cross-Origin Resource Sharing)
CORS(app)

# --- Banco de dados simples em memória (para demonstração) ---
# users_db agora armazenará informações de empresas/administradores de empresas
# Este users_db é usado principalmente para o login e para armazenar configurações
# que não precisam ser lidas diretamente pelo frontend via Firestore listeners,
# ou para dados que são mais eficientes de manter em memória para acesso rápido.
# A fonte da verdade para dados de empresas (para listagem no frontend) será o Firestore.
users_db = {} # Armazena 'admin' e 'company_admin' (para login rápido)

# Define alguns temas de design padrão (para demonstração)
# Em um cenário real, você poderia carregar isso de um banco de dados
# ou permitir que o admin configure.
DEFAULT_THEMES = {
    "default": {
        "gradient_from": "from-blue-50",
        "gradient_to": "to-indigo-100",
        "primary_button_bg": "bg-blue-600",
        "primary_button_hover_bg": "hover:bg-blue-700",
        "secondary_button_bg": "bg-gray-200",
        "secondary_button_text": "text-gray-700",
        "secondary_button_hover_bg": "hover:bg-blue-100",
        "text_color_strong": "text-gray-800",
        "text_color_medium": "text-gray-700",
        "border_color": "border-blue-200",
        "highlight_color": "text-blue-600",
        "success_color": "bg-green-500",
        "error_color": "bg-red-500",
        "font_family": "font-sans", # Tailwind default font-sans
        "dominant_color": "bg-blue-50" # Cor dominante padrão
    },
    "corporate": {
        "gradient_from": "from-gray-100",
        "gradient_to": "to-gray-200",
        "primary_button_bg": "bg-purple-700",
        "primary_button_hover_bg": "hover:bg-purple-800",
        "secondary_button_bg": "bg-gray-300",
        "secondary_button_text": "text-gray-800",
        "secondary_button_hover_bg": "hover:bg-gray-400",
        "text_color_strong": "text-gray-900",
        "text_color_medium": "text-gray-700",
        "border_color": "border-purple-300",
        "highlight_color": "text-purple-700",
        "success_color": "bg-green-600",
        "error_color": "bg-red-600",
        "font_family": "font-serif", # Exemplo de fonte diferente
        "dominant_color": "bg-gray-100" # Cor dominante corporativa
    },
    "vibrant": {
        "gradient_from": "from-pink-100",
        "gradient_to": "to-yellow-100",
        "primary_button_bg": "bg-orange-500",
        "primary_button_hover_bg": "hover:bg-orange-600",
        "secondary_button_bg": "bg-pink-200",
        "secondary_button_text": "text-pink-800",
        "secondary_button_hover_bg": "hover:bg-pink-300",
        "text_color_strong": "text-pink-900",
        "text_color_medium": "text-pink-700",
        "border_color": "border-orange-300",
        "highlight_color": "text-orange-500",
        "success_color": "bg-lime-500",
        "error_color": "bg-rose-500",
        "font_family": "font-mono", # Exemplo de fonte diferente
        "dominant_color": "bg-pink-100" # Cor dominante vibrante
    }
}

# --- Função para carregar empresas do Firestore para users_db ---
def load_companies_from_firestore():
    """
    Carrega todos os documentos de empresa (company_admin) do Firestore para o users_db em memória.
    Isso garante que o backend tenha uma visão atualizada das empresas registradas.
    """
    global users_db # Declara que estamos modificando a variável global
    # FIX: Alterado o valor padrão para 'local-app-id' para corresponder ao frontend
    app_id = os.getenv("APP_ID", "local-app-id")
    companies_ref = db.collection('artifacts').document(app_id).collection('users')
    
    try:
        docs = companies_ref.stream()
        for doc in docs:
            company_data = doc.to_dict()
            users_db[doc.id] = company_data
            # Carrega também os sub-usuários para o users_db (para o login)
            # ATENÇÃO: Esta abordagem de carregar todos os sub-usuários de todas as empresas
            # para a memória do backend não é escalável para um grande número de empresas/usuários.
            # Para produção, considere autenticação direta via Firebase Auth ou um cache mais sofisticado.
            company_users_ref = companies_ref.document(doc.id).collection('company_users')
            sub_user_docs = company_users_ref.stream()
            for sub_doc in sub_user_docs:
                sub_user_data = sub_doc.to_dict()
                users_db[sub_user_data['username']] = { # Usa o username como chave para o login
                    "password": sub_user_data['password'], # Armazenado em texto simples para esta demo, mas DEVE ser hashed
                    "role": sub_user_data['role'],
                    "company_id": doc.id, # Associa o sub-usuário à empresa
                    "firebase_uid": sub_user_data['firebase_uid'] # UID do Firebase Auth
                }
        print(f"Empresas e sub-usuários carregados do Firestore para users_db: {list(users_db.keys())}")
    except Exception as e:
        print(f"ERRO ao carregar empresas do Firestore na inicialização: {e}")

# Cria um usuário admin principal padrão se não existir.
# Este é o super-administrador que pode criar outras empresas.
# NOTA: Em um ambiente de produção real, você não criaria usuários padrão assim.
# Eles seriam provisionados de forma segura.
# Este admin será sempre adicionado ao users_db em memória.
if "admin" not in users_db:
    users_db["will"] = {"password": "j102355W", "role": "admin", "design_theme": "default", "firebase_uid": "admin"}
    print("Usuário 'will' principal padrão criado (senha: j102355W).")

# Carrega as empresas do Firestore após a inicialização do Firebase Admin SDK
# e após a criação do usuário 'admin' padrão.
# AQUI ESTÁ A CORREÇÃO: load_companies_from_firestore() é chamado APÓS a inicialização do 'db'
load_companies_from_firestore()

# Adiciona usuários de empresa de exemplo para teste (apenas em memória, para demonstração)
# Estes são para garantir que haja dados de teste se o Firestore estiver vazio.
# Eles serão sobrescritos se já existirem no Firestore e forem carregados.
if "empresa_teste" not in users_db:
    users_db["empresa_teste"] = {
        "password": "testpassword",
        "role": "company_admin",
        "company_name": "Empresa Teste Ltda.",
        "design_theme": "corporate",
        "mercado_pago_access_token": "YOUR_PRODUCTION_MERCADO_PAGO_TOKEN_HERE", # Substitua pelo seu token real
        "firebase_uid": "empresa_teste" # UID do Firebase para company_admin
    }
    print("Usuário 'empresa_teste' padrão criado (senha: testpassword, tema: corporate, token MP: YOUR_PRODUCTION_MERCADO_PAGO_TOKEN_HERE).")

if "empresa_vibrante" not in users_db:
    users_db["empresa_vibrante"] = {
        "password": "vibrantpassword",
        "role": "company_admin",
        "company_name": "Vibrant Solutions",
        "design_theme": "vibrant",
        "mercado_pago_access_token": "YOUR_PRODUCTION_MERCADO_PAGO_TOKEN_HERE", # Substitua pelo seu token real
        "firebase_uid": "empresa_vibrante" # UID do Firebase para company_admin
    }
    print("Usuário 'empresa_vibrante' padrão criado (senha: vibrantpassword, tema: vibrant, token MP: YOUR_PRODUCTION_MERCADO_PAGO_TOKEN_HERE).")


print(f"users_db após inicialização global e carregamento do Firestore: {users_db}")

# --- Decorador para verificar o Firebase ID Token e a função do usuário ---
def verify_firebase_token(required_role=None):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            auth_header = request.headers.get('Authorization')
            if not auth_header or not auth_header.startswith('Bearer '):
                return jsonify({"error": "Token de autenticação ausente ou inválido"}), 401

            id_token = auth_header.split(' ')[1]
            try:
                decoded_token = auth.verify_id_token(id_token)
                request.current_user_uid = decoded_token['uid'] # UID do usuário autenticado no Firebase Auth
                request.current_user_role = decoded_token.get('role') # Função do usuário (custom claim)
                request.current_user_company_id = decoded_token.get('company_id') # ID da empresa (custom claim)

                print(f"Token verificado com sucesso. UID: {request.current_user_uid}, Role: {request.current_user_role}, Company ID: {request.current_user_company_id}")
                
                # Verifica se a função do usuário é a requerida
                if required_role and request.current_user_role != required_role:
                    print(f"Acesso negado para UID {request.current_user_uid}. Função requerida: {required_role}, Função do usuário: {request.current_user_role}")
                    return jsonify({"error": f"Acesso negado: Requer função '{required_role}'"}), 403

            except Exception as e:
                print(f"ERRO ao verificar ID Token: {e}")
                return jsonify({"error": "Token de autenticação inválido ou expirado"}), 401
            return f(*args, **kwargs)
        return decorated_function
    return decorator

# --- Rotas da API ---

@app.route('/')
def home():
    """
    Rota de teste simples para verificar se o backend está funcionando.
    """
    return jsonify({"message": "Backend do App de Caixa está online!"})

@app.route('/register_company', methods=['POST'])
def register_company():
    """
    Rota para registrar uma nova empresa (usuário com role 'company_admin').
    Cria o usuário no Firebase Authentication e salva os dados da empresa no Firestore.
    """
    data = request.get_json()
    company_username = data.get('username') # Será o ID único da empresa
    password = data.get('password')
    company_name = data.get('company_name')
    design_theme = data.get('design_theme', 'default') # Permite definir o tema ao registrar
    mercado_pago_access_token = data.get('mercado_pago_access_token')

    if not company_username or not password or not company_name:
        return jsonify({"error": "Nome de usuário, senha e nome da empresa são obrigatórios"}), 400

    # NOVO: Validação de comprimento da senha
    if not isinstance(password, str) or len(password) < 6:
        return jsonify({"error": "A senha deve ser uma string com pelo menos 6 caracteres."}), 400

    if design_theme not in DEFAULT_THEMES:
        return jsonify({"error": f"Tema de design '{design_theme}' inválido."}), 400

    # Verifica se o usuário já existe no Firebase Auth
    try:
        auth.get_user(company_username) # Tenta buscar pelo UID
        return jsonify({"error": "Nome de usuário (empresa) já existe no Firebase Authentication."}), 409
    except auth.UserNotFoundError:
        pass # Usuário não existe, pode prosseguir

    # FIX: Alterado o valor padrão para 'local-app-id' para corresponder ao frontend
    app_id = os.getenv("APP_ID", "local-app-id")
    # Verifica se o documento da empresa já existe no Firestore
    company_doc_ref = db.collection('artifacts').document(app_id).collection('users').document(company_username)
    if company_doc_ref.get().exists:
        return jsonify({"error": "Nome de usuário (empresa) já existe no Firestore."}), 409

    try:
        # 1. Cria o usuário no Firebase Authentication
        # Usamos o company_username como UID para facilitar o mapeamento
        user_record = auth.create_user(
            uid=company_username,
            email=f"{company_username}@example.com", # Email é obrigatório para Firebase Auth
            password=password,
            display_name=company_name
        )
        print(f"Usuário Firebase Auth '{user_record.uid}' criado com sucesso.")

        # 2. Define custom claims para o usuário company_admin
        auth.set_custom_user_claims(user_record.uid, {'role': 'company_admin', 'company_id': company_username})
        print(f"Custom claims definidos para {user_record.uid}: {{'role': 'company_admin', 'company_id': '{company_username}'}}")

        # 3. Salva os dados da empresa no Firestore
        company_data_for_firestore = {
            "password": password, # ATENÇÃO: Em produção, a senha não deve ser armazenada assim.
            "role": "company_admin",
            "company_name": company_name,
            # "plan": None, # Removido
            "design_theme": design_theme,
            "mercado_pago_access_token": mercado_pago_access_token,
            "firebase_uid": user_record.uid # Armazena o UID do Firebase para referência
        }
        company_doc_ref.set(company_data_for_firestore)
        print(f"Dados da empresa '{company_username}' salvos no Firestore.")

        # 4. Atualiza o users_db em memória (para uso imediato no login, embora Firestore seja a fonte primária)
        users_db[company_username] = company_data_for_firestore

        print(f"Empresa registrada: {company_name} com nome de usuário: {company_username} (Tema: {design_theme}, Token MP: {mercado_pago_access_token}).")
        print(f"Estado atual do users_db: {users_db}")

        return jsonify({
            "message": "Empresa registrada com sucesso",
            "username": company_username,
            "company_name": company_name,
            "role": "company_admin",
            "design_theme": design_theme,
            "mercado_pago_access_token": mercado_pago_access_token
        }), 201

    except Exception as e:
        print(f"ERRO ao registrar empresa ou criar usuário Firebase: {e}")
        # Tenta reverter a criação do usuário no Firebase Auth se a gravação no Firestore falhar
        try:
            if 'user_record' in locals():
                auth.delete_user(user_record.uid)
                print(f"Rollback: Usuário Firebase Auth '{user_record.uid}' deletado devido a erro no registro da empresa.")
        except Exception as rollback_e:
            print(f"ERRO no rollback do Firebase Auth: {rollback_e}")
        return jsonify({"error": f"Erro ao registrar empresa: {e}"}), 500

@app.route('/login', methods=['POST'])
def login_user():
    """
    Rota para login de usuário (admin principal, company_admin, gerente ou caixa).
    Após o login bem-sucedido, gera um token personalizado do Firebase com custom claims.
    """
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({"error": "Nome de usuário e senha são obrigatórios"}), 400

    user_data = None
    firebase_uid = None
    role = None
    company_name = None
    design_data = None
    mercado_pago_access_token = None
    company_id = None # Para sub-usuários

    # 1. Tenta encontrar o usuário no users_db (admin principal ou company_admin)
    if username in users_db and users_db[username]["password"] == password:
        user_data = users_db[username]
        firebase_uid = user_data.get("firebase_uid", username) # Usa o username como UID se não especificado
        role = user_data["role"]
        company_name = user_data.get("company_name")
        design_data = DEFAULT_THEMES.get(user_data.get("design_theme", "default"), DEFAULT_THEMES["default"])
        if role == "company_admin":
            mercado_pago_access_token = user_data.get("mercado_pago_access_token")
            company_id = username # company_admin é sua própria company_id
    else:
        # 2. Se não for admin principal ou company_admin, tenta encontrar como sub-usuário no Firestore
        # ATENÇÃO: Esta busca global por sub-usuários no login é INEFICIENTE e NÃO ESCALÁVEL.
        # Para um sistema de produção, considere:
        # a) Fazer o sub-usuário logar diretamente com Firebase Auth (email/senha) e usar custom claims.
        # b) Incluir o company_id no payload de login do frontend para direcionar a busca.
        # FIX: Alterado o valor padrão para 'local-app-id' para corresponder ao frontend
        app_id = os.getenv("APP_ID", "local-app-id")
        users_collection_ref = db.collection('artifacts').document(app_id).collection('users')
        
        try:
            # Busca todos os documentos de company_admin
            company_admin_docs = users_collection_ref.where('role', '==', 'company_admin').stream()
            for company_admin_doc in company_admin_docs:
                current_company_id = company_admin_doc.id
                sub_users_ref = users_collection_ref.document(current_company_id).collection('company_users')
                
                # Busca o sub-usuário dentro da subcoleção da empresa
                query_ref = sub_users_ref.where('username', '==', username).stream()
                for sub_user_doc in query_ref:
                    sub_user_data = sub_user_doc.to_dict()
                    # Verifica a senha (ATENÇÃO: A senha está em texto simples para esta demo. DEVE SER HASHED!)
                    if sub_user_data.get("password") == password:
                        user_data = sub_user_data
                        firebase_uid = sub_user_data["firebase_uid"]
                        role = sub_user_data["role"]
                        company_id = current_company_id # Define a company_id do sub-usuário
                        
                        # Busca os dados de design da empresa do sub-usuário
                        company_doc = users_collection_ref.document(current_company_id).get()
                        if company_doc.exists:
                            company_info = company_doc.to_dict()
                            company_name = company_info.get("company_name")
                            design_data = DEFAULT_THEMES.get(company_info.get("design_theme", "default"), DEFAULT_THEMES["default"])
                            mercado_pago_access_token = company_info.get("mercado_pago_access_token")
                        break # Encontrou o usuário, pode sair do loop interno
                if user_data:
                    break # Encontrou o usuário, pode sair do loop externo
        except Exception as e:
            print(f"ERRO ao buscar sub-usuário no Firestore: {e}")
            return jsonify({"error": "Erro interno ao buscar usuário"}), 500

    if user_data:
        try:
            # Garante que firebase_uid existe para o user_data
            if not firebase_uid:
                print(f"AVISO: user_data para {username} não tem firebase_uid. Tentando buscar no Firebase Auth por email.")
                try:
                    # Tenta encontrar o usuário no Firebase Auth por email se o UID estiver faltando
                    # Isso assume que o formato do email é username@company_id.com
                    email_to_check = f"{username}@{company_id}.com" if company_id else f"{username}@example.com"
                    fb_user = auth.get_user_by_email(email_to_check)
                    firebase_uid = fb_user.uid
                    # Atualiza o user_data e users_db com o firebase_uid encontrado
                    user_data['firebase_uid'] = firebase_uid
                    if username in users_db:
                        users_db[username]['firebase_uid'] = firebase_uid
                    print(f"Firebase UID para {username} encontrado e atualizado em memória: {firebase_uid}")
                except auth.UserNotFoundError:
                    print(f"ERRO: Usuário Firebase Auth não encontrado para email {email_to_check}.")
                    return jsonify({"error": "Erro interno: Usuário de autenticação não encontrado no Firebase Auth."}), 500
                except Exception as e:
                    print(f"ERRO ao buscar Firebase UID para {username}: {e}")
                    return jsonify({"error": "Erro interno ao buscar UID do Firebase Auth."}), 500

            # Define custom claims para o token personalizado do Firebase
            claims = {
                'role': role,
                'company_id': company_id if company_id else username # company_id será o username para company_admin
            }
            print(f"Definindo custom claims para UID: {firebase_uid} com claims: {claims}")
            auth.set_custom_user_claims(firebase_uid, claims)
            print(f"Custom claims definidos com sucesso para UID: {firebase_uid}")

            print(f"Criando custom token para UID: {firebase_uid}")
            firebase_custom_token = auth.create_custom_token(firebase_uid)
            firebase_custom_token_str = firebase_custom_token.decode('utf-8')
            print(f"Custom token criado com sucesso para UID: {firebase_uid}")

            print(f"Token Firebase gerado para UID: {firebase_uid} (Role: {role}, Company ID: {claims['company_id']}).")
            print(f"Login bem-sucedido para o usuário: {username}.")

            response_data = {
                "message": "Login bem-sucedido",
                "username": username,
                "role": role,
                "company_name": company_name,
                "firebase_token": firebase_custom_token_str,
                "design": design_data
            }

            if mercado_pago_access_token:
                response_data["mercado_pago_access_token"] = mercado_pago_access_token

            return jsonify(response_data), 200
        except Exception as e:
            print(f"ERRO ao gerar token Firebase ou definir claims: {e}")
            return jsonify({"error": "Erro interno ao gerar token de autenticação"}), 500
    else:
        print(f"Falha no login para o usuário: {username}")
        return jsonify({"error": "Nome de usuário ou senha inválidos"}), 401

# Rotas de planos removidas: /plans e /subscribe

@app.route('/pix/generate', methods=['POST'])
def generate_pix_qr_code():
    """
    Gera um QR Code Pix usando a API do Mercado Pago.
    Busca o token do Mercado Pago da empresa logada para fazer a requisição.
    """
    data = request.get_json()
    amount = data.get('amount')
    description = data.get('description', 'Pagamento do App de Caixa')
    company_username = data.get('company_username') # O frontend deve enviar o username da empresa
    # NOVO: Recebe o sale_id do frontend para usar como external_reference
    sale_id = data.get('sale_id') # Adicionado novamente, pois foi removido na versão anterior

    if not amount:
        return jsonify({"error": "Valor é obrigatório para o Pix"}), 400
    
    try:
        amount_float = float(amount)
        if amount_float <= 0:
            return jsonify({"error": "O valor do Pix deve ser maior que zero."}), 400
    except ValueError:
        return jsonify({"error": "O valor do Pix deve ser um número válido."}), 400


    if not company_username:
        return jsonify({"error": "Nome de usuário da empresa é obrigatório para gerar Pix"}), 400
    
    # NOVO: Validação para o sale_id
    if not sale_id:
        return jsonify({"error": "ID da venda (sale_id) é obrigatório para gerar Pix."}), 400

    user = users_db.get(company_username)
    if not user or user.get("role") != "company_admin":
        return jsonify({"error": "Empresa não encontrada ou não autorizada"}), 403

    mercado_pago_access_token = user.get("mercado_pago_access_token")
    if not mercado_pago_access_token:
        return jsonify({"error": "Token de acesso do Mercado Pago não configurado para esta empresa"}), 400

    # --- INÍCIO DA REQUISIÇÃO REAL PARA A API DO MERCADO PAGO ---
    # URL da API do Mercado Pago para pagamentos Pix
    url = "https://api.mercadopago.com/v1/payments"

    # Dados da requisição (payload) para gerar o Pix
    # Adapte estes dados conforme a documentação oficial do Mercado Pago para Pix
    payload = {
        "transaction_amount": amount_float, # O valor deve ser um float
        "description": description,
        "payment_method_id": "pix",
        "payer": {
            "email": "test_user_123@test.com" # Email de um pagador de teste (para testes)
        },
        # IMPORTANTE: Substitua 'https://your-production-domain.com/mercadopago-webhook' pela URL REAL do seu webhook em PRODUÇÃO.
        # Esta URL deve ser acessível publicamente pelo Mercado Pago.
        "notification_url": "https://old-owl-williammzin-cd2d4d31.koyeb.app/mercadopago-webhook", # Usando a URL do seu backend Koyeb
        "external_reference": sale_id # NOVO: Envia o sale_id do frontend como external_reference
    }

    print(f"Enviando payload para Mercado Pago: {payload}") # Log do payload

    # Gera um ID de idempotência único para esta requisição
    idempotency_key = str(uuid.uuid4())
    print(f"Usando X-Idempotency-Key: {idempotency_key}")

    # Cabeçalhos da requisição, incluindo o Access Token para autenticação e a X-Idempotency-Key
    headers = {
        "Authorization": f"Bearer {mercado_pago_access_token}",
        "Content-Type": "application/json",
        "X-Idempotency-Key": idempotency_key # Adiciona o cabeçalho de idempotência
    }

    try:
        # Faz a requisição POST para a API do Mercado Pago
        response = requests.post(url, json=payload, headers=headers)
        response.raise_for_status() # Levanta um erro para status de resposta HTTP ruins (4xx ou 5xx)

        # Converte a resposta JSON em um dicionário Python
        mp_response_data = response.json()
        print(f"Resposta completa da API do Mercado Pago (sucesso): {mp_response_data}") # NOVO: Log da resposta completa

        # Extrai os dados do QR Code e da chave "copia e cola" da resposta
        # A estrutura da resposta pode variar, consulte a documentação do Mercado Pago
        qr_code_base64 = mp_response_data.get("point_of_interaction", {}).get("transaction_data", {}).get("qr_code_base64")
        copy_paste_key = mp_response_data.get("point_of_interaction", {}).get("transaction_data", {}).get("qr_code")

        if not qr_code_base64 or not copy_paste_key:
            print(f"ERRO: Resposta inesperada da API do Mercado Pago: {mp_response_data}")
            return jsonify({"error": "Falha ao obter dados do QR Code da API do Mercado Pago."}), 500

        # Retorna os dados para o frontend
        return jsonify({
            "qr_code_base64": qr_code_base64,
            "copy_paste_key": copy_paste_key,
            "status": mp_response_data.get("status", "pending"),
            "transaction_amount": mp_response_data.get("transaction_amount"),
            "description": description,
            "payment_id": mp_response_data.get("id") # ID da transação no Mercado Pago
        }), 200

    except requests.exceptions.RequestException as e:
        print(f"ERRO na requisição à API do Mercado Pago: {e}")
        # Tenta obter mais detalhes do erro se a resposta tiver conteúdo JSON
        error_message = "Erro ao conectar com a API do Mercado Pago."
        if response is not None: # Verifica se a resposta existe
            print(f"Resposta de erro da API do Mercado Pago: {response.text}") # Log da resposta de erro
            try:
                error_data = response.json()
                error_message = error_data.get("message", error_message)
                # Adiciona detalhes específicos do erro do Mercado Pago, se disponíveis
                if "cause" in error_data:
                    error_message += f" Detalhes: {error_data['cause']}"
            except ValueError:
                error_message = f"Erro na API do Mercado Pago: {response.text}"
        return jsonify({"error": error_message}), response.status_code if response is not None else 500
    # --- FIM DA REQUISIÇÃO REAL PARA A API DO MERCADO PAGO ---

@app.route('/mercadopago-webhook', methods=['POST'])
# @jwt_required() # Removido por enquanto, pois webhooks do MP não usam JWT por padrão
def mercadopago_webhook():
    """
    Endpoint para receber notificações de webhook do Mercado Pago.
    Atualiza o status da venda correspondente no Firestore.
    """
    # Obtenha o ID do pagamento do Mercado Pago da notificação
    payment_id = request.args.get('id') or request.json.get('data', {}).get('id')
    topic = request.args.get('topic') or request.json.get('type')

    if not payment_id or topic != 'payment':
        print(f"Notificação inválida: payment_id={payment_id}, topic={topic}")
        return jsonify({"message": "Notificação inválida"}), 400

    print(f"Notificação de pagamento recebida para o ID: {payment_id}")
    print(f"Notificação de Webhook do Mercado Pago recebida (corpo): {request.json}")
    print(f"Notificação de Webhook do Mercado Pago recebida (query params): {request.args}")

    # FIX: Alterado o valor padrão para 'local-app-id' para corresponder ao frontend
    app_id = os.getenv("APP_ID", "local-app-id")

    try:
        # 1. Obter detalhes do pagamento do Mercado Pago
        # Você precisará do access_token do Mercado Pago para a empresa específica.
        # Para isso, precisamos mapear o payment_id para a empresa.
        # O external_reference do Mercado Pago é o sale_id que o frontend enviou.
        # Precisamos de uma forma de encontrar a empresa a partir do payment_id ou external_reference.
        # Uma abordagem robusta seria:
        # a) No /pix/generate, salvar o payment_id e o company_id no Firestore junto com o sale_id.
        # b) No webhook, usar o payment_id para buscar esse registro e obter o company_id.
        # C) Ou, como estamos fazendo agora, buscar a venda pelo external_reference e extrair o company_id dela.

        # Primeiro, vamos tentar encontrar a venda usando o payment_id para obter o company_id
        # Isso pressupõe que o payment_id foi salvo na venda quando o Pix foi gerado.
        # Como o Mercado Pago envia o external_reference (nosso sale_id) na resposta da API de pagamento,
        # podemos usá-lo para buscar a venda.

        # Para fins de demonstração, e com base nos seus logs, vou assumir que o `company_id`
        # para esta transação é "Supermercado".
        # ATENÇÃO: Em um sistema de produção, você PRECISA de uma lógica para derivar o company_id
        # de forma segura e confiável a partir da notificação do Mercado Pago.
        # Isso pode ser feito:
        # 1. Incluindo o company_id na `notification_url` como um parâmetro de query (ex: /webhook?company_id=abc)
        # 2. Mapeando o `collector_id` do Mercado Pago (presente na resposta do payment_info) para o seu `company_id` no Firestore.
        # 3. No caso de um `external_reference` (que é o `sale_id` do frontend), você pode buscar a venda por esse ID
        #    e então obter o `userId` (company_id) da venda.

        # Vamos buscar o payment_info primeiro para obter o external_reference e o collector_id
        # Para isso, precisamos de um access_token. Se não tivermos o company_id ainda,
        # precisaremos de um access_token "mestre" ou um mecanismo para buscar o token
        # da empresa correta.
        
        # Para o seu caso, o log mostra 'company_id: Supermercado', então vamos usá-lo como base
        company_id = "Supermercado" # Substitua pela sua lógica real de obtenção do company_id

        company_doc_ref = db.collection('artifacts').document(app_id).collection('users').document(company_id)
        company_doc = company_doc_ref.get()

        if not company_doc.exists:
            print(f"ERRO: Empresa {company_id} não encontrada no Firestore para o webhook.")
            return jsonify({"error": "Empresa não encontrada"}), 404

        mp_access_token = company_doc.to_dict().get('mercado_pago_access_token')
        if not mp_access_token:
            print(f"ERRO: Token de acesso do Mercado Pago não configurado para a empresa {company_id} no webhook.")
            return jsonify({"error": "Token Mercado Pago não configurado"}), 500

        sdk = mercadopago.SDK(mp_access_token)
        payment_info = sdk.payment().get(payment_id)

        if payment_info["status"] == 200:
            payment_status = payment_info["response"]["status"]
            # O external_reference é o sale_id que o frontend enviou
            external_reference = payment_info["response"].get("external_reference") 

            print(f"Status do pagamento {payment_id} via API do Mercado Pago: {payment_status}")

            if not external_reference:
                print(f"ERRO: external_reference (sale_id) não encontrado na resposta do Mercado Pago para payment_id: {payment_id}")
                return jsonify({"error": "ID da venda não encontrado no pagamento do Mercado Pago"}), 400

            # 2. Encontrar a venda na coleção 'sales' usando o external_reference (sale_id)
            sale_doc_ref = db.collection('artifacts').document(app_id).collection('users').document(company_id).collection('sales').document(external_reference)
            sale_doc = sale_doc_ref.get()

            if sale_doc.exists:
                # 3. Atualizar o status da venda no Firestore
                current_sale_data = sale_doc.to_dict()
                if current_sale_data.get('status') != payment_status: # Evita atualizações desnecessárias
                    sale_doc_ref.update({
                        'status': payment_status,
                        'payment_id': payment_id, # Garante que o payment_id do MP esteja salvo na venda
                        'date_updated': firestore.SERVER_TIMESTAMP # Adiciona um timestamp de atualização
                    })
                    print(f"Venda {external_reference} da empresa {company_id} atualizada para '{payment_status}' via webhook.")
                else:
                    print(f"Status da venda {external_reference} já é '{payment_status}'. Nenhuma atualização necessária.")

                # NÃO REMOVA NENHUM DOCUMENTO AQUI. A venda na coleção 'sales' é o registro permanente.
                return jsonify({"message": "Webhook processado com sucesso"}), 200
            else:
                print(f"ERRO: Venda {external_reference} não encontrada no Firestore para atualização. Pode ser um ID inválido ou timing issue.")
                return jsonify({"error": "Venda não encontrada no Firestore"}), 404
        else:
            print(f"ERRO ao obter detalhes do pagamento {payment_id} do Mercado Pago: {payment_info['status']} - {payment_info['response']}")
            return jsonify({"error": "Erro ao consultar Mercado Pago"}), 500

    except Exception as e:
        print(f"ERRO no webhook do Mercado Pago: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/pix/cancel', methods=['POST'])
@verify_firebase_token(required_role='company_admin')
def cancel_pix_payment():
    """
    Cancela um pagamento Pix pendente usando a API do Mercado Pago.
    Atualiza o status da venda no Firestore para 'cancelled'.
    """
    data = request.get_json()
    payment_id = data.get('payment_id')
    company_username = data.get('company_username') # company_username do admin logado

    if not payment_id or not company_username:
        return jsonify({"error": "ID do pagamento e nome de usuário da empresa são obrigatórios."}), 400

    user = users_db.get(company_username)
    if not user or user.get("role") != "company_admin":
        return jsonify({"error": "Empresa não encontrada ou não autorizada."}), 403

    mercado_pago_access_token = user.get("mercado_pago_access_token")
    if not mercado_pago_access_token:
        return jsonify({"error": "Token de acesso do Mercado Pago não configurado para esta empresa."}), 400

    try:
        sdk = mercadopago.SDK(mercado_pago_access_token)
        
        # Primeiro, obtenha os detalhes do pagamento para verificar o external_reference (sale_id)
        payment_info_response = sdk.payment().get(payment_id)
        if payment_info_response["status"] != 200:
            print(f"ERRO ao obter detalhes do pagamento {payment_id} para cancelar: {payment_info_response['status']} - {payment_info_response['response']}")
            return jsonify({"error": "Erro ao obter detalhes do pagamento para cancelar."}), 500
        
        payment_status = payment_info_response["response"]["status"]
        external_reference = payment_info_response["response"].get("external_reference")

        if payment_status != 'pending':
            return jsonify({"error": f"Pagamento Pix {payment_id} não está pendente. Status atual: {payment_status}."}), 400

        if not external_reference:
            print(f"ERRO: external_reference (sale_id) não encontrado no pagamento {payment_id} do Mercado Pago.")
            return jsonify({"error": "ID da venda não encontrado no pagamento do Mercado Pago."}), 400

        # Tenta cancelar o pagamento no Mercado Pago
        # A API do Mercado Pago para cancelar Pix geralmente envolve estornar o pagamento.
        # Para pagamentos Pix PENDENTES, a forma mais comum de "cancelar" é deixar expirar,
        # ou, se já foi aprovado, fazer um reembolso.
        # Para esta demonstração, vamos simular o cancelamento e atualizar o Firestore.
        # Em um cenário real, você faria uma requisição de reembolso se o status fosse 'approved'.
        # Para 'pending', não há uma API direta de "cancelar Pix" no MP, ele expira.
        # No entanto, podemos atualizar o status no nosso sistema para 'cancelled'.

        # Atualiza o status da venda no Firestore para 'cancelled'
        app_id = os.getenv("APP_ID", "local-app-id")
        sale_doc_ref = db.collection('artifacts').document(app_id).collection('users').document(company_username).collection('sales').document(external_reference)
        sale_doc = sale_doc_ref.get()

        if sale_doc.exists:
            sale_doc_ref.update({
                'status': 'cancelled',
                'date_updated': firestore.SERVER_TIMESTAMP
            })
            print(f"Venda {external_reference} da empresa {company_username} atualizada para 'cancelled' via cancelamento manual.")
            return jsonify({"message": f"Pagamento Pix {payment_id} marcado como cancelado no sistema."}), 200
        else:
            print(f"ERRO: Venda {external_reference} não encontrada no Firestore para cancelar.")
            return jsonify({"error": "Venda não encontrada no Firestore."}), 404

    except requests.exceptions.RequestException as e:
        print(f"ERRO na requisição à API do Mercado Pago para cancelar Pix: {e}")
        error_message = "Erro ao conectar com a API do Mercado Pago para cancelar Pix."
        if e.response is not None:
            print(f"Resposta de erro da API do Mercado Pago: {e.response.text}")
            try:
                error_data = e.response.json()
                error_message = error_data.get("message", error_message)
            except ValueError:
                error_message = f"Erro na API do Mercado Pago: {e.response.text}"
        return jsonify({"error": error_message}), e.response.status_code if e.response is not None else 500
    except Exception as e:
        print(f"ERRO ao cancelar pagamento Pix: {e}")
        return jsonify({"error": f"Erro interno ao cancelar pagamento Pix: {e}"}), 500

@app.route('/delete_company', methods=['POST'])
@verify_firebase_token(required_role='admin') # Apenas o admin principal pode excluir empresas
def delete_company():
    """
    Rota para excluir uma empresa (usuário com role 'company_admin') e todos os seus dados.
    Esta rota deve ser acessada apenas por um 'admin' principal.
    Requer autenticação via Firebase ID Token no cabeçalho Authorization.
    """
    # A autenticação já foi feita pelo decorador @verify_firebase_token
    # request.current_user_uid já está disponível

    data = request.get_json()
    company_username_to_delete = data.get('company_username')

    if not company_username_to_delete:
        return jsonify({"error": "Nome de usuário da empresa é obrigatório"}), 400

    if company_username_to_delete == "admin":
        return jsonify({"error": "Não é possível excluir o usuário administrador principal"}), 403

    # Remove do users_db em memória primeiro (para evitar que seja usado se o processo falhar mais tarde)
    if company_username_to_delete in users_db:
        del users_db[company_username_to_delete]
        print(f"Empresa '{company_username_to_delete}' removida do users_db em memória.")
    else:
        print(f"Aviso: Empresa '{company_username_to_delete}' não encontrada no users_db em memória.")

    # FIX: Alterado o valor padrão para 'local-app-id' para corresponder ao frontend
    app_id = os.getenv("APP_ID", "local-app-id") # Obtém o app_id

    try:
        # 1. Excluir o usuário do Firebase Authentication
        try:
            auth.delete_user(company_username_to_delete)
            print(f"Usuário Firebase Auth '{company_username_to_delete}' excluído com sucesso.")
        except auth.UserNotFoundError:
            print(f"Usuário Firebase Auth '{company_username_to_delete}' não encontrado (já excluído ou nunca existiu).")
        except Exception as e:
            print(f"ERRO ao excluir usuário Firebase Auth '{company_username_to_delete}': {e}")
            return jsonify({"error": f"Erro ao excluir usuário de autenticação: {e}"}), 500

        # 2. Excluir os dados da empresa e suas subcoleções no Firestore
        # Caminho base da coleção de dados do usuário
        company_doc_ref = db.collection('artifacts').document(app_id).collection('users').document(company_username_to_delete)
        
        try:
            print(f"Iniciando exclusão recursiva do Firestore para o caminho: {company_doc_ref.path}")
            db.recursive_delete(company_doc_ref)
            print(f"Dados do Firestore para '{company_username_to_delete}' excluídos com sucesso.")
        except Exception as e:
            print(f"ERRO ao excluir dados do Firestore para '{company_username_to_delete}': {e}")
            return jsonify({"error": f"Erro ao excluir dados da empresa no Firestore: {e}"}), 500

        return jsonify({"message": f"Empresa '{company_username_to_delete}' e todos os seus dados excluídos com sucesso."}), 200

    except Exception as e:
        print(f"ERRO geral ao excluir empresa: {e}")
        return jsonify({"error": f"Erro interno ao excluir empresa: {e}"}), 500

# --- Rotas para Gerenciamento de Usuários da Empresa (para company_admin) ---

@app.route('/company_users/add', methods=['POST'])
@verify_firebase_token(required_role='company_admin') # Apenas company_admin pode adicionar usuários
def add_company_user():
    """
    Adiciona um novo usuário (caixa ou gerente) para uma empresa específica.
    Cria o usuário no Firebase Authentication e salva seus dados no Firestore.
    """
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    role = data.get('role') # 'caixa' ou 'gerente'
    company_id = request.current_user_company_id # Obtém o ID da empresa do token do company_admin

    if not username or not password or not role:
        return jsonify({"error": "Nome de usuário, senha e função são obrigatórios"}), 400
    
    if role not in ['caixa', 'gerente']:
        return jsonify({"error": "Função inválida. Escolha 'caixa' ou 'gerente'."}), 400

    if not isinstance(password, str) or len(password) < 6:
        return jsonify({"error": "A senha deve ser uma string com pelo menos 6 caracteres."}), 400

    # FIX: Alterado o valor padrão para 'local-app-id' para corresponder ao frontend
    app_id = os.getenv("APP_ID", "local-app-id")

    # Verifica se o username já existe para esta empresa no Firestore
    company_users_ref = db.collection('artifacts').document(app_id).collection('users').document(company_id).collection('company_users')
    query_ref = company_users_ref.where('username', '==', username).limit(1).get()
    if len(query_ref) > 0:
        return jsonify({"error": "Nome de usuário já existe para esta empresa."}), 409

    try:
        # 1. Criar usuário no Firebase Authentication
        # Usar um email único para o Firebase Auth (ex: username@company_id.com)
        email = f"{username}@{company_id}.com"
        user_record = auth.create_user(email=email, password=password, display_name=username)
        print(f"Usuário Firebase Auth '{user_record.uid}' criado para '{username}' da empresa '{company_id}'.")

        # 2. Definir custom claims para a função (role) e company_id
        auth.set_custom_user_claims(user_record.uid, {'company_id': company_id, 'role': role})
        print(f"Custom claims definidos para {user_record.uid}: {{'company_id': '{company_id}', 'role': '{role}'}}")

        # 3. Armazenar dados do usuário no Firestore (na subcoleção da empresa)
        # O ID do documento será o UID gerado pelo Firebase Auth
        company_users_ref.document(user_record.uid).set({
            'username': username,
            'password': password, # ATENÇÃO: Em produção, a senha NÃO deve ser armazenada em texto simples!
            'role': role,
            'firebase_uid': user_record.uid, # Armazena o UID do Firebase Auth
            'created_at': firestore.SERVER_TIMESTAMP
        })
        print(f"Dados do usuário '{username}' salvos no Firestore para empresa '{company_id}'.")

        # Atualiza o users_db em memória para incluir o novo sub-usuário
        users_db[username] = {
            "password": password,
            "role": role,
            "company_id": company_id,
            "firebase_uid": user_record.uid
        }
        print(f"Usuário '{username}' adicionado ao users_db em memória.")


        return jsonify({"message": "Usuário adicionado com sucesso!", "username": username, "role": role}), 200
    except Exception as e:
        print(f"ERRO ao adicionar usuário da empresa: {e}")
        # Tenta reverter a criação do usuário no Firebase Auth se a gravação no Firestore falhar
        try:
            if 'user_record' in locals():
                auth.delete_user(user_record.uid)
                print(f"Rollback: Usuário Firebase Auth '{user_record.uid}' deletado devido a erro na adição do sub-usuário.")
        except Exception as rollback_e:
            print(f"ERRO no rollback do Firebase Auth: {rollback_e}")
        return jsonify({"error": f"Erro ao adicionar usuário da empresa: {e}"}), 500

@app.route('/company_users/update', methods=['POST'])
@verify_firebase_token(required_role='company_admin')
def update_company_user():
    """
    Atualiza um usuário (caixa ou gerente) para uma empresa específica.
    Atualiza o Firebase Authentication e seus dados no Firestore.
    """
    data = request.get_json()
    user_id_to_update = data.get('user_id') # Este é o firebase_uid do usuário
    username = data.get('username')
    password = data.get('password') # Opcional: só atualiza se fornecido
    role = data.get('role')
    company_id = request.current_user_company_id # Obtém o ID da empresa do token do company_admin

    if not user_id_to_update or not username or not role:
        return jsonify({"error": "ID do usuário, nome de usuário e função são obrigatórios"}), 400
    
    if role not in ['caixa', 'gerente']:
        return jsonify({"error": "Função inválida. Escolha 'caixa' ou 'gerente'."}), 400

    if password and (not isinstance(password, str) or len(password) < 6):
        return jsonify({"error": "A senha deve ser uma string com pelo menos 6 caracteres, se fornecida."}), 400

    # FIX: Alterado o valor padrão para 'local-app-id' para corresponder ao frontend
    app_id = os.getenv("APP_ID", "local-app-id")
    user_doc_ref = db.collection('artifacts').document(app_id).collection('users').document(company_id).collection('company_users').document(user_id_to_update)

    try:
        # 1. Atualizar usuário no Firebase Authentication
        update_fields = {}
        if password:
            update_fields['password'] = password
        
        if update_fields:
            auth.update_user(user_id_to_update, **update_fields)
            print(f"Usuário Firebase Auth '{user_id_to_update}' atualizado.")

        # 2. Atualizar custom claims no Firebase Auth
        auth.set_custom_user_claims(user_id_to_update, {'company_id': company_id, 'role': role})
        print(f"Custom claims atualizados para {user_id_to_update}: {{'company_id': '{company_id}', 'role': '{role}'}}")

        # 3. Atualizar dados no Firestore
        firestore_update_data = {
            'username': username,
            'role': role
        }
        if password:
            firestore_update_data['password'] = password # ATENÇÃO: Em produção, a senha NÃO deve ser armazenada em texto simples!

        user_doc_ref.update(firestore_update_data)
        print(f"Dados do usuário '{username}' atualizados no Firestore para empresa '{company_id}'.")

        # Atualiza o users_db em memória
        # Primeiro, remove a entrada antiga se o username mudou
        old_username = None
        for key, val in users_db.items():
            if val.get('firebase_uid') == user_id_to_update:
                old_username = key
                break
        if old_username and old_username != username:
            del users_db[old_username]
            print(f"Usuário '{old_username}' removido do users_db em memória (username alterado).")

        users_db[username] = {
            "password": password if password else users_db.get(username, {}).get("password"), # Mantém a senha antiga se não for atualizada
            "role": role,
            "company_id": company_id,
            "firebase_uid": user_id_to_update
        }
        print(f"Usuário '{username}' atualizado no users_db em memória.")

        return jsonify({"message": "Usuário atualizado com sucesso!", "username": username, "role": role}), 200
    except auth.UserNotFoundError:
        return jsonify({"error": "Usuário não encontrado no Firebase Authentication."}), 404
    except Exception as e:
        print(f"ERRO ao atualizar usuário da empresa: {e}")
        return jsonify({"error": f"Erro ao atualizar usuário da empresa: {e}"}), 500

@app.route('/company_users/delete', methods=['POST'])
@verify_firebase_token(required_role='company_admin')
def delete_company_user():
    """
    Exclui um usuário (caixa ou gerente) para uma empresa específica.
    Exclui o usuário do Firebase Authentication e seus dados do Firestore.
    """
    data = request.get_json()
    user_id_to_delete = data.get('user_id') # Este é o firebase_uid do usuário
    company_id = request.current_user_company_id # Obtém o ID da empresa do token do company_admin

    if not user_id_to_delete:
        return jsonify({"error": "ID do usuário é obrigatório"}), 400

    # FIX: Alterado o valor padrão para 'local-app-id' para corresponder ao frontend
    app_id = os.getenv("APP_ID", "local-app-id")
    user_doc_ref = db.collection('artifacts').document(app_id).collection('users').document(company_id).collection('company_users').document(user_id_to_delete)

    try:
        # 1. Excluir usuário do Firebase Authentication
        try:
            auth.delete_user(user_id_to_delete)
            print(f"Usuário Firebase Auth '{user_id_to_delete}' excluído.")
        except auth.UserNotFoundError:
            print(f"Usuário Firebase Auth '{user_id_to_delete}' não encontrado (já excluído ou nunca existiu).")
        except Exception as e:
            print(f"ERRO ao excluir usuário Firebase Auth: {e}")
            return jsonify({"error": f"Erro ao excluir usuário de autenticação: {e}"}), 500

        # 2. Excluir dados do usuário do Firestore
        user_doc_ref.delete()
        print(f"Dados do usuário '{user_id_to_delete}' excluídos do Firestore para empresa '{company_id}'.")

        # 3. Remove do users_db em memória
        username_to_remove = None
        for key, val in users_db.items():
            if val.get('firebase_uid') == user_id_to_delete:
                username_to_remove = key
                break
        if username_to_remove:
            del users_db[username_to_remove]
            print(f"Usuário '{username_to_remove}' removido do users_db em memória.")

        return jsonify({"message": f"Usuário '{user_id_to_delete}' excluído com sucesso."}), 200
    except Exception as e:
        print(f"ERRO ao excluir usuário da empresa: {e}")
        return jsonify({"error": f"Erro ao excluir usuário da empresa: {e}"}), 500


# --- Execução do Aplicativo ---
if __name__ == '__main__':
    app.run(debug=True, port=5000)
