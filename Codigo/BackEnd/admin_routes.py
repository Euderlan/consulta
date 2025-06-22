# admin_routes.py - Rotas Administrativas Extras
from flask import Blueprint, request, jsonify
from auth import admin_required
from database_utils import DatabaseManager
import logging
import sqlite3
import os

logger = logging.getLogger(__name__)

admin_bp = Blueprint('admin', __name__, url_prefix='/admin')

def init_admin_routes(app, auth_manager, db_manager):
    """Inicializa as rotas administrativas extras"""
    
    @admin_bp.route('/users/<int:user_id>/toggle', methods=['PUT'])
    @admin_required
    def toggle_user_status(current_user, user_id):
        """Ativar/Desativar usuário específico"""
        try:
            if user_id == current_user['id']:
                return jsonify({'error': 'Não é possível desativar sua própria conta'}), 400
            
            conn = sqlite3.connect('users.db')
            cursor = conn.cursor()
            
            # Verificar se usuário existe
            cursor.execute('SELECT id, is_active, name, email FROM users WHERE id = ?', (user_id,))
            user = cursor.fetchone()
            
            if not user:
                conn.close()
                return jsonify({'error': 'Usuário não encontrado'}), 404
            
            # Alternar status
            new_status = not bool(user[1])
            cursor.execute('UPDATE users SET is_active = ? WHERE id = ?', (new_status, user_id))
            
            conn.commit()
            conn.close()
            
            action = 'ativado' if new_status else 'desativado'
            logger.info(f"Usuário {user[3]} {action} por {current_user['email']}")
            
            return jsonify({
                'message': f'Usuário {user[2]} foi {action} com sucesso',
                'user_id': user_id,
                'new_status': new_status,
                'success': True
            }), 200
            
        except Exception as e:
            logger.error(f"Erro ao alterar status do usuário: {e}")
            return jsonify({'error': 'Erro interno do servidor'}), 500
    
    @admin_bp.route('/users/<int:user_id>/make-admin', methods=['PUT'])
    @admin_required
    def toggle_admin_status(current_user, user_id):
        """Promover/Remover privilégios de administrador"""
        try:
            conn = sqlite3.connect('users.db')
            cursor = conn.cursor()
            
            # Verificar se usuário existe
            cursor.execute('SELECT id, is_admin, name, email FROM users WHERE id = ?', (user_id,))
            user = cursor.fetchone()
            
            if not user:
                conn.close()
                return jsonify({'error': 'Usuário não encontrado'}), 404
            
            # Alternar status de admin
            new_admin_status = not bool(user[1])
            cursor.execute('UPDATE users SET is_admin = ? WHERE id = ?', (new_admin_status, user_id))
            
            conn.commit()
            conn.close()
            
            action = 'promovido a administrador' if new_admin_status else 'removido da administração'
            logger.info(f"Usuário {user[3]} {action} por {current_user['email']}")
            
            return jsonify({
                'message': f'Usuário {user[2]} foi {action} com sucesso',
                'user_id': user_id,
                'new_admin_status': new_admin_status,
                'success': True
            }), 200
            
        except Exception as e:
            logger.error(f"Erro ao alterar status de admin: {e}")
            return jsonify({'error': 'Erro interno do servidor'}), 500
    
    @admin_bp.route('/users/<int:user_id>/stats', methods=['GET'])
    @admin_required
    def get_user_stats(current_user, user_id):
        """Obter estatísticas detalhadas de um usuário"""
        try:
            stats = db_manager.get_user_stats(user_id)
            
            if not stats:
                return jsonify({'error': 'Usuário não encontrado'}), 404
            
            return jsonify({
                'stats': stats,
                'success': True
            }), 200
            
        except Exception as e:
            logger.error(f"Erro ao obter estatísticas do usuário: {e}")
            return jsonify({'error': 'Erro interno do servidor'}), 500
    
    @admin_bp.route('/users/<int:user_id>/reset-password', methods=['PUT'])
    @admin_required
    def reset_user_password(current_user, user_id):
        """Resetar senha de um usuário"""
        try:
            data = request.get_json()
            new_password = data.get('new_password')
            
            if not new_password or len(new_password) < 6:
                return jsonify({'error': 'Nova senha deve ter pelo menos 6 caracteres'}), 400
            
            from werkzeug.security import generate_password_hash
            
            conn = sqlite3.connect('users.db')
            cursor = conn.cursor()
            
            # Verificar se usuário existe
            cursor.execute('SELECT id, name, email FROM users WHERE id = ?', (user_id,))
            user = cursor.fetchone()
            
            if not user:
                conn.close()
                return jsonify({'error': 'Usuário não encontrado'}), 404
            
            # Atualizar senha
            password_hash = generate_password_hash(new_password)
            cursor.execute('UPDATE users SET password_hash = ? WHERE id = ?', (password_hash, user_id))
            
            conn.commit()
            conn.close()
            
            logger.info(f"Senha do usuário {user[2]} resetada por {current_user['email']}")
            
            # Log da ação
            db_manager.log_auth_attempt(
                user[2], 'password_reset_by_admin', True, 
                user_id=user[0], error_message=f"Reset por {current_user['email']}"
            )
            
            return jsonify({
                'message': f'Senha do usuário {user[1]} foi resetada com sucesso',
                'success': True
            }), 200
            
        except Exception as e:
            logger.error(f"Erro ao resetar senha: {e}")
            return jsonify({'error': 'Erro interno do servidor'}), 500
    
    @admin_bp.route('/sessions', methods=['GET'])
    @admin_required
    def list_active_sessions(current_user):
        """Listar todas as sessões ativas do sistema"""
        try:
            conn = sqlite3.connect('users.db')
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT s.id, s.user_id, u.name, u.email, s.created_at, 
                       s.expires_at, s.ip_address, s.user_agent
                FROM user_sessions s
                JOIN users u ON s.user_id = u.id
                WHERE s.is_active = TRUE AND s.expires_at > CURRENT_TIMESTAMP
                ORDER BY s.created_at DESC
            ''')
            
            sessions = []
            for row in cursor.fetchall():
                sessions.append({
                    'session_id': row[0],
                    'user_id': row[1],
                    'user_name': row[2],
                    'user_email': row[3],
                    'created_at': row[4],
                    'expires_at': row[5],
                    'ip_address': row[6],
                    'user_agent': row[7]
                })
            
            conn.close()
            
            return jsonify({
                'sessions': sessions,
                'total': len(sessions),
                'success': True
            }), 200
            
        except Exception as e:
            logger.error(f"Erro ao listar sessões: {e}")
            return jsonify({'error': 'Erro interno do servidor'}), 500
    
    @admin_bp.route('/sessions/<int:session_id>/revoke', methods=['DELETE'])
    @admin_required
    def revoke_session(current_user, session_id):
        """Revogar uma sessão específica"""
        try:
            conn = sqlite3.connect('users.db')
            cursor = conn.cursor()
            
            # Verificar se sessão existe e obter detalhes
            cursor.execute('''
                SELECT s.id, s.user_id, u.name, u.email, s.token_hash
                FROM user_sessions s
                JOIN users u ON s.user_id = u.id
                WHERE s.id = ? AND s.is_active = TRUE
            ''', (session_id,))
            
            session = cursor.fetchone()
            
            if not session:
                conn.close()
                return jsonify({'error': 'Sessão não encontrada ou já inativa'}), 404
            
            # Revogar sessão
            cursor.execute('UPDATE user_sessions SET is_active = FALSE WHERE id = ?', (session_id,))
            conn.commit()
            conn.close()
            
            logger.info(f"Sessão {session_id} do usuário {session[3]} revogada por {current_user['email']}")
            
            return jsonify({
                'message': f'Sessão do usuário {session[2]} foi revogada com sucesso',
                'session_id': session_id,
                'success': True
            }), 200
            
        except Exception as e:
            logger.error(f"Erro ao revogar sessão: {e}")
            return jsonify({'error': 'Erro interno do servidor'}), 500
    
    @admin_bp.route('/logs', methods=['GET'])
    @admin_required
    def get_auth_logs(current_user):
        """Obter logs de autenticação do sistema"""
        try:
            page = request.args.get('page', 1, type=int)
            per_page = request.args.get('per_page', 50, type=int)
            offset = (page - 1) * per_page
            
            conn = sqlite3.connect('users.db')
            cursor = conn.cursor()
            
            # Obter logs com paginação
            cursor.execute('''
                SELECT id, user_id, email, action, success, ip_address, 
                       user_agent, error_message, created_at
                FROM auth_logs
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
            ''', (per_page, offset))
            
            logs = []
            for row in cursor.fetchall():
                logs.append({
                    'id': row[0],
                    'user_id': row[1],
                    'email': row[2],
                    'action': row[3],
                    'success': bool(row[4]),
                    'ip_address': row[5],
                    'user_agent': row[6],
                    'error_message': row[7],
                    'created_at': row[8]
                })
            
            # Contar total de logs
            cursor.execute('SELECT COUNT(*) FROM auth_logs')
            total_logs = cursor.fetchone()[0]
            
            conn.close()
            
            return jsonify({
                'logs': logs,
                'page': page,
                'per_page': per_page,
                'total': total_logs,
                'total_pages': (total_logs + per_page - 1) // per_page,
                'success': True
            }), 200
            
        except Exception as e:
            logger.error(f"Erro ao obter logs: {e}")
            return jsonify({'error': 'Erro interno do servidor'}), 500
    
    @admin_bp.route('/backup', methods=['POST'])
    @admin_required
    def create_backup(current_user):
        """Criar backup do banco de dados"""
        try:
            backup_path = db_manager.backup_database()
            
            if not backup_path:
                return jsonify({'error': 'Falha ao criar backup'}), 500
            
            logger.info(f"Backup criado por {current_user['email']}: {backup_path}")
            
            return jsonify({
                'message': 'Backup criado com sucesso',
                'backup_path': backup_path,
                'created_by': current_user['name'],
                'success': True
            }), 200
            
        except Exception as e:
            logger.error(f"Erro ao criar backup: {e}")
            return jsonify({'error': 'Erro interno do servidor'}), 500
    
    @admin_bp.route('/cleanup', methods=['POST'])
    @admin_required
    def cleanup_system(current_user):
        """Limpeza geral do sistema"""
        try:
            # Limpar sessões expiradas
            expired_sessions = db_manager.cleanup_expired_sessions()
            
            # Aqui você pode adicionar outras rotinas de limpeza
            
            logger.info(f"Limpeza do sistema executada por {current_user['email']}")
            
            return jsonify({
                'message': 'Limpeza do sistema concluída',
                'expired_sessions_removed': expired_sessions,
                'executed_by': current_user['name'],
                'success': True
            }), 200
            
        except Exception as e:
            logger.error(f"Erro na limpeza do sistema: {e}")
            return jsonify({'error': 'Erro interno do servidor'}), 500
    
    # Registrar blueprint
    app.register_blueprint(admin_bp)
    logger.info("Rotas administrativas extras registradas com sucesso")