# auth_routes.py - Rotas de Autenticação
from flask import Blueprint, request, jsonify
from auth import AuthManager, token_required
import logging
import re

logger = logging.getLogger(__name__)

auth_bp = Blueprint('auth', __name__, url_prefix='/auth')

def init_auth_routes(app, auth_manager):
    """Inicializa as rotas de autenticação"""
    
    @auth_bp.route('/register', methods=['POST'])
    def register():
        """Endpoint para cadastro de novos usuários"""
        try:
            data = request.get_json()
            
            if not data:
                return jsonify({'error': 'Dados não fornecidos'}), 400
            
            # Validar campos obrigatórios
            name = data.get('name', '').strip()
            email = data.get('email', '').strip().lower()
            password = data.get('password', '')
            
            if not name or not email or not password:
                return jsonify({'error': 'Nome, email e senha são obrigatórios'}), 400
            
            # Validar formato do email
            email_regex = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
            if not re.match(email_regex, email):
                return jsonify({'error': 'Formato de email inválido'}), 400
            
            # Validar tamanho do nome
            if len(name) < 2 or len(name) > 100:
                return jsonify({'error': 'Nome deve ter entre 2 e 100 caracteres'}), 400
            
            # Validar força da senha
            if len(password) < 6:
                return jsonify({'error': 'Senha deve ter pelo menos 6 caracteres'}), 400
            
            # Criar usuário
            result = auth_manager.create_user(name, email, password)
            
            if not result['success']:
                return jsonify({'error': result['message']}), 400
            
            logger.info(f"Novo usuário cadastrado: {email}")
            return jsonify({
                'message': result['message'],
                'success': True
            }), 201
            
        except Exception as e:
            logger.error(f"Erro no cadastro: {e}")
            return jsonify({'error': 'Erro interno do servidor'}), 500
    
    @auth_bp.route('/login', methods=['POST'])
    def login():
        """Endpoint para login com email e senha"""
        try:
            data = request.get_json()
            
            if not data:
                return jsonify({'error': 'Dados não fornecidos'}), 400
            
            email = data.get('email', '').strip().lower()
            password = data.get('password', '')
            
            if not email or not password:
                return jsonify({'error': 'Email e senha são obrigatórios'}), 400
            
            # Autenticar usuário
            result = auth_manager.authenticate_user(email, password)
            
            if not result['success']:
                return jsonify({'error': result['message']}), 401
            
            logger.info(f"Login realizado: {email}")
            return jsonify({
                'message': result['message'],
                'token': result['token'],
                'user': result['user'],
                'success': True
            }), 200
            
        except Exception as e:
            logger.error(f"Erro no login: {e}")
            return jsonify({'error': 'Erro interno do servidor'}), 500
    
    @auth_bp.route('/google', methods=['POST'])
    def google_login():
        """Endpoint para login com Google OAuth2"""
        try:
            data = request.get_json()
            
            if not data:
                return jsonify({'error': 'Dados não fornecidos'}), 400
            
            google_token = data.get('token')
            
            if not google_token:
                return jsonify({'error': 'Token do Google é obrigatório'}), 400
            
            # Autenticar com Google
            result = auth_manager.authenticate_google_user(google_token)
            
            if not result['success']:
                return jsonify({'error': result['message']}), 401
            
            logger.info(f"Login Google realizado: {result['user']['email']}")
            return jsonify({
                'message': result['message'],
                'token': result['token'],
                'user': result['user'],
                'success': True
            }), 200
            
        except Exception as e:
            logger.error(f"Erro no login Google: {e}")
            return jsonify({'error': 'Erro interno do servidor'}), 500
    
    @auth_bp.route('/verify', methods=['GET'])
    @token_required
    def verify_token(current_user):
        """Endpoint para verificar se o token é válido"""
        try:
            return jsonify({
                'valid': True,
                'user': current_user,
                'message': 'Token válido'
            }), 200
            
        except Exception as e:
            logger.error(f"Erro na verificação de token: {e}")
            return jsonify({'error': 'Erro interno do servidor'}), 500
    
    @auth_bp.route('/profile', methods=['GET'])
    @token_required
    def get_profile(current_user):
        """Endpoint para obter perfil do usuário autenticado"""
        try:
            return jsonify({
                'user': current_user,
                'success': True
            }), 200
            
        except Exception as e:
            logger.error(f"Erro ao obter perfil: {e}")
            return jsonify({'error': 'Erro interno do servidor'}), 500
    
    @auth_bp.route('/refresh', methods=['POST'])
    @token_required
    def refresh_token(current_user):
        """Endpoint para renovar token de autenticação"""
        try:
            # Gerar novo token
            new_token = auth_manager.generate_token(current_user)
            
            if not new_token:
                return jsonify({'error': 'Erro ao gerar novo token'}), 500
            
            return jsonify({
                'token': new_token,
                'user': current_user,
                'message': 'Token renovado com sucesso',
                'success': True
            }), 200
            
        except Exception as e:
            logger.error(f"Erro ao renovar token: {e}")
            return jsonify({'error': 'Erro interno do servidor'}), 500
    
    # Endpoint especial para login tradicional (compatibilidade com frontend atual)
    @auth_bp.route('/traditional', methods=['POST'])
    def traditional_login():
        """Endpoint para login tradicional - compatibilidade com frontend"""
        try:
            data = request.get_json()
            
            if not data:
                return jsonify({'error': 'Dados não fornecidos'}), 400
            
            username = data.get('username', '').strip()
            password = data.get('password', '')
            
            if not username:
                return jsonify({'error': 'Username é obrigatório'}), 400
            
            # Verificar se é login de admin
            if username.lower() in ['admin', 'admin.consepe']:
                email = auth_manager.admin_email
            else:
                # Converter username para email se não for um email
                if '@' not in username:
                    email = f"{username.lower().replace(' ', '.')}@discente.ufma.br"
                else:
                    email = username.lower()
            
            # Se for tentativa de login admin sem senha, usar senha padrão
            if email == auth_manager.admin_email and not password:
                password = 'admin123'
            
            # Se não for admin e não tiver senha, criar usuário temporário
            if email != auth_manager.admin_email and not password:
                # Criar usuário demo automaticamente
                name = username.title() if username else 'Usuário Demo'
                result = auth_manager.create_user(name, email, 'demo123')
                
                if result['success']:
                    password = 'demo123'
                else:
                    # Se usuário já existe, tentar com senha padrão
                    password = 'demo123'
            
            # Autenticar usuário
            result = auth_manager.authenticate_user(email, password)
            
            if not result['success']:
                return jsonify({'error': result['message']}), 401
            
            logger.info(f"Login tradicional realizado: {email}")
            return jsonify({
                'message': result['message'],
                'token': result['token'],
                'user': result['user'],
                'success': True
            }), 200
            
        except Exception as e:
            logger.error(f"Erro no login tradicional: {e}")
            return jsonify({'error': 'Erro interno do servidor'}), 500
    
    # Registrar blueprint
    app.register_blueprint(auth_bp)
    logger.info("Rotas de autenticação registradas com sucesso")