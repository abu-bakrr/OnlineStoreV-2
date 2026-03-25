from flask import Blueprint, request, jsonify, session
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta
import secrets

from ..database import get_db_connection
from ..utils.validation import validate_email, validate_phone
from ..services.email_service import send_password_reset_email

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/register', methods=['POST'])
def register():
    try:
        data = request.json
        email = data.get('email', '').strip().lower()
        password = data.get('password')
        first_name = data.get('first_name', '')
        last_name = data.get('last_name', '')
        phone = data.get('phone', '')
        telegram_username = data.get('telegram_username', '')
        
        is_valid, error_msg = validate_email(email)
        if not is_valid:
            return jsonify({'error': error_msg}), 400
        
        is_valid, error_msg = validate_phone(phone)
        if not is_valid:
            return jsonify({'error': error_msg}), 400
        
        if not password or len(password) < 6:
            return jsonify({'error': 'Пароль должен быть не менее 6 символов'}), 400
        
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('SELECT id FROM users WHERE email = %s', (email,))
        if cur.fetchone():
            cur.close()
            conn.close()
            return jsonify({'error': 'Пользователь с таким email уже существует'}), 400
        
        password_hash = generate_password_hash(password)
        cur.execute(
            '''INSERT INTO users (email, password_hash, first_name, last_name, phone, telegram_username) 
               VALUES (%s, %s, %s, %s, %s, %s) RETURNING id, email, first_name, last_name, phone, telegram_username, created_at''',
            (email, password_hash, first_name, last_name, phone, telegram_username)
        )
        new_user = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()
        
        session.permanent = True
        session['user_id'] = new_user['id']
        return jsonify({'user': new_user, 'message': 'Регистрация успешна'}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/login', methods=['POST'])
def login():
    try:
        data = request.json
        email = data.get('email')
        password = data.get('password')
        
        if not email or not password:
            return jsonify({'error': 'Email and password are required'}), 400
        
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('SELECT * FROM users WHERE email = %s', (email,))
        user = cur.fetchone()
        cur.close()
        conn.close()
        
        if not user or not user.get('password_hash') or not check_password_hash(user['password_hash'], password):
            return jsonify({'error': 'Invalid email or password'}), 401
        
        session.permanent = True
        session['user_id'] = user['id']
        
        user_data = {
            'id': user['id'],
            'email': user['email'],
            'first_name': user.get('first_name'),
            'last_name': user.get('last_name'),
            'phone': user.get('phone'),
            'telegram_username': user.get('telegram_username'),
            'username': user.get('username'),
        }
        return jsonify({'user': user_data, 'message': 'Login successful'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'message': 'Logged out successfully'}), 200

@auth_bp.route('/stop-impersonating', methods=['POST'])
def stop_impersonating():
    if 'admin_user_id' in session:
        session['user_id'] = session.pop('admin_user_id')
        return jsonify({'message': 'Stopped impersonating'}), 200
    return jsonify({'error': 'Not impersonating'}), 400

@auth_bp.route('/forgot-password', methods=['POST'])
def forgot_password():
    try:
        data = request.json
        email = data.get('email', '').strip().lower()
        if not email:
            return jsonify({'error': 'Email обязателен'}), 400
        
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('SELECT id, email FROM users WHERE email = %s', (email,))
        user = cur.fetchone()
        
        if not user:
            cur.close()
            conn.close()
            return jsonify({'message': 'Если аккаунт существует, на email будет отправлена ссылка для сброса пароля'}), 200
        
        token = secrets.token_urlsafe(32)
        expires_at = datetime.now() + timedelta(hours=1)
        cur.execute('DELETE FROM password_reset_tokens WHERE user_id = %s', (user['id'],))
        cur.execute(
            'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (%s, %s, %s)',
            (user['id'], token, expires_at)
        )
        conn.commit()
        cur.close()
        conn.close()
        
        site_url = request.headers.get('Origin') or request.host_url.rstrip('/')
        if send_password_reset_email(email, token, site_url):
            return jsonify({'message': 'Ссылка для сброса пароля отправлена на email'}), 200
        return jsonify({'error': 'Не удалось отправить email'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/reset-password', methods=['POST'])
def reset_password():
    try:
        data = request.json
        token = data.get('token')
        new_password = data.get('password')
        
        if not token or not new_password or len(new_password) < 6:
            return jsonify({'error': 'Некорректные данные'}), 400
        
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('''
            SELECT t.* FROM password_reset_tokens t
            WHERE t.token = %s AND t.used = FALSE AND t.expires_at > NOW()
        ''', (token,))
        token_data = cur.fetchone()
        
        if not token_data:
            cur.close()
            conn.close()
            return jsonify({'error': 'Недействительная или просроченная ссылка'}), 400
        
        password_hash = generate_password_hash(new_password)
        cur.execute('UPDATE users SET password_hash = %s WHERE id = %s', (password_hash, token_data['user_id']))
        cur.execute('UPDATE password_reset_tokens SET used = TRUE WHERE id = %s', (token_data['id'],))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'message': 'Пароль успешно изменён'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/me', methods=['GET'])
def get_current_user():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Not authenticated'}), 401
    
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('SELECT id, email, first_name, last_name, phone, telegram_username, username, telegram_id FROM users WHERE id = %s', (user_id,))
    user = cur.fetchone()
    cur.close()
    conn.close()
    
    if not user:
        session.clear()
        return jsonify({'error': 'User not found'}), 404
    
    # Include impersonation info
    is_impersonating = 'admin_user_id' in session
    user['is_impersonating'] = is_impersonating
    
    return jsonify({'user': user}), 200

@auth_bp.route('/profile', methods=['PATCH'])
def update_profile():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Not authenticated'}), 401
    
    data = request.json
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        '''UPDATE users SET first_name = %s, last_name = %s, phone = %s, telegram_username = %s 
           WHERE id = %s RETURNING id, email, first_name, last_name, phone, telegram_username''',
        (data.get('first_name'), data.get('last_name'), data.get('phone'), data.get('telegram_username'), user_id)
    )
    updated_user = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()
    return jsonify({'user': updated_user, 'message': 'Profile updated successfully'}), 200
