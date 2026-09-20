from flask import Blueprint, request, jsonify
import hashlib
import hmac
import os
import base64
from datetime import datetime

from ..database import get_db_connection, get_payment_config

payments_bp = Blueprint('payments', __name__)

def verify_click_signature(data, secret_key):
    if not secret_key:
        return False
    click_trans_id = str(data.get('click_trans_id', ''))
    service_id = str(data.get('service_id', ''))
    merchant_trans_id = str(data.get('merchant_trans_id', ''))
    amount = str(data.get('amount', ''))
    action = str(data.get('action', ''))
    sign_time = str(data.get('sign_time', ''))
    received_sign = data.get('sign_string', '')
    
    sign_string = f"{click_trans_id}{service_id}{secret_key}{merchant_trans_id}{amount}{action}{sign_time}"
    return hashlib.md5(sign_string.encode()).hexdigest() == received_sign

@payments_bp.route('/webhooks/click/prepare', methods=['POST'])
def click_prepare():
    try:
        data = request.json or request.form.to_dict()
        cfg = get_payment_config('click')
        secret_key = cfg.get('secret_key') or os.getenv('CLICK_SECRET_KEY')
        
        if not cfg.get('enabled') and not secret_key:
            return jsonify({'error': -1, 'error_note': 'Click payment is not configured'}), 403
            
        if not verify_click_signature(data, secret_key):
            return jsonify({'error': -1, 'error_note': 'Invalid signature'}), 401
        
        order_id = data.get('merchant_trans_id')
        amount = data.get('amount')
        
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('SELECT * FROM orders WHERE id = %s', (order_id,))
        order = cur.fetchone()
        
        if not order:
            cur.close()
            conn.close()
            return jsonify({'error': -5, 'error_note': 'Not found'})
        
        if int(float(amount)) != order['total']:
            cur.close()
            conn.close()
            return jsonify({'error': -2, 'error_note': 'Amount mismatch'})
        
        if order['payment_status'] == 'paid':
            cur.close()
            conn.close()
            return jsonify({'error': -4, 'error_note': 'Already paid'})
        
        cur.execute('UPDATE orders SET payment_id = %s WHERE id = %s', (data.get('click_trans_id'), order_id))
        conn.commit()
        cur.close()
        conn.close()
        
        return jsonify({
            'error': 0, 'error_note': 'Success', 
            'click_trans_id': data.get('click_trans_id'),
            'merchant_trans_id': order_id, 'merchant_prepare_id': order_id
        })
    except Exception as e:
        return jsonify({'error': -1, 'error_note': str(e)})

@payments_bp.route('/webhooks/click/complete', methods=['POST'])
def click_complete():
    try:
        data = request.json or request.form.to_dict()
        cfg = get_payment_config('click')
        secret_key = cfg.get('secret_key') or os.getenv('CLICK_SECRET_KEY')
        
        if not cfg.get('enabled') and not secret_key:
            return jsonify({'error': -1, 'error_note': 'Click payment is not configured'}), 403
            
        if not verify_click_signature(data, secret_key):
            return jsonify({'error': -1, 'error_note': 'Invalid signature'}), 401
        
        order_id = data.get('merchant_trans_id')
        error = data.get('error')
        
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('SELECT * FROM orders WHERE id = %s', (order_id,))
        order = cur.fetchone()
        
        if not order:
            cur.close()
            conn.close()
            return jsonify({'error': -5, 'error_note': 'Not found'})
        
        if order['payment_status'] == 'paid':
            cur.close()
            conn.close()
            return jsonify({'error': 0, 'error_note': 'Already paid', 'click_trans_id': data.get('click_trans_id'), 'merchant_trans_id': order_id, 'merchant_confirm_id': order_id})
        
        status = 'paid' if (error == '0' or error == 0) else 'failed'
        cur.execute("UPDATE orders SET payment_status = %s, status = %s WHERE id = %s", (status, status, order_id))
        conn.commit()
        cur.close()
        conn.close()
        
        return jsonify({'error': 0, 'error_note': 'Success', 'click_trans_id': data.get('click_trans_id'), 'merchant_trans_id': order_id, 'merchant_confirm_id': order_id})
    except Exception as e:
        return jsonify({'error': -1, 'error_note': str(e)})

def verify_payme_auth():
    auth = request.headers.get('Authorization', '')
    if not auth.startswith('Basic '):
        return False
    cfg = get_payment_config('payme')
    key = cfg.get('key') or os.getenv('PAYME_KEY')
    if not key:
        return False
    try:
        decoded = base64.b64decode(auth[6:]).decode('utf-8')
        return decoded.split(':')[1] == key if ':' in decoded else False
    except Exception:
        return False

@payments_bp.route('/webhooks/payme', methods=['POST'])
def payme_webhook():
    if not verify_payme_auth():
        return jsonify({'error': {'code': -32504, 'message': 'Invalid auth'}}), 401
    
    data = request.json or {}
    method = data.get('method')
    params = data.get('params', {})
    conn = get_db_connection()
    cur = conn.cursor()
    
    if method == 'CheckPerformTransaction':
        order_id = params.get('account', {}).get('order_id')
        amount = params.get('amount', 0) // 100
        cur.execute('SELECT * FROM orders WHERE id = %s', (order_id,))
        order = cur.fetchone()
        if not order or order['total'] != amount:
            cur.close()
            conn.close()
            return jsonify({'error': {'code': -31050, 'message': 'Invalid'}})
        cur.close()
        conn.close()
        return jsonify({'result': {'allow': True}})
        
    elif method == 'CreateTransaction':
        order_id = params.get('account', {}).get('order_id')
        cur.execute('UPDATE orders SET payment_id = %s WHERE id = %s', (params.get('id'), order_id))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'result': {'create_time': int(datetime.now().timestamp() * 1000), 'transaction': order_id, 'state': 1}})
        
    elif method == 'PerformTransaction':
        cur.execute("UPDATE orders SET payment_status = 'paid', status = 'paid' WHERE payment_id = %s", (params.get('id'),))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'result': {'perform_time': int(datetime.now().timestamp() * 1000), 'transaction': params.get('id'), 'state': 2}})
        
    elif method == 'CancelTransaction':
        cur.execute("UPDATE orders SET payment_status = 'cancelled' WHERE payment_id = %s", (params.get('id'),))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'result': {'cancel_time': int(datetime.now().timestamp() * 1000), 'transaction': params.get('id'), 'state': -1}})
    
    cur.close()
    conn.close()
    return jsonify({'error': {'code': -32601, 'message': 'Not found'}})

def verify_uzum_signature():
    cfg = get_payment_config('uzum')
    secret = cfg.get('secret_key') or os.getenv('UZUM_SECRET_KEY')
    if not secret:
        return False
    received = request.headers.get('X-Signature', '')
    expected = hmac.new(secret.encode(), request.get_data(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, received)

@payments_bp.route('/webhooks/uzum/confirm', methods=['POST'])
def uzum_confirm():
    if not verify_uzum_signature():
        return jsonify({'status': 'ERROR', 'message': 'Invalid auth'}), 401
    
    tx_id = (request.json or {}).get('transactionId')
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("UPDATE orders SET payment_status = 'paid', status = 'paid' WHERE payment_id = %s", (tx_id,))
    conn.commit()
    cur.close()
    conn.close()
    return jsonify({'status': 'OK'})
