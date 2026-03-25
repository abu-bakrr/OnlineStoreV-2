from flask import Blueprint, request, jsonify
from ..database import get_db_connection

promo_bp = Blueprint('promo', __name__)

@promo_bp.route('/promo/validate', methods=['POST'])
def validate_promo():
    data = request.json
    code = data.get('code', '').strip().upper()
    order_total = data.get('order_total', 0)
    
    if not code:
        return jsonify({'error': 'Код не введен'}), 400
        
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('''
        SELECT id, code, discount_type, discount_value, min_order_amount, usage_limit, used_count, is_active 
        FROM promo_codes 
        WHERE code = %s
    ''', (code,))
    promo = cur.fetchone()
    cur.close(); conn.close()
    
    if not promo:
        return jsonify({'error': 'Промокод не найден'}), 404
        
    if not promo['is_active']:
        return jsonify({'error': 'Промокод не активен'}), 400
        
    if promo['usage_limit'] is not None and promo['used_count'] >= promo['usage_limit']:
        return jsonify({'error': 'Промокод больше не действителен (закончились использования)'}), 400
        
    if order_total < promo['min_order_amount']:
        return jsonify({
            'error': f"Минимальная сумма заказа для этого промокода: {promo['min_order_amount']} сумов"
        }), 400
        
    # Calculate discount
    discount_amount = 0
    if promo['discount_type'] == 'percentage':
        discount_amount = int(order_total * (promo['discount_value'] / 100))
    else: # fixed
        discount_amount = promo['discount_value']
        
    # Ensure discount doesn't exceed total
    discount_amount = min(discount_amount, order_total)
    
    return jsonify({
        'valid': True,
        'code': promo['code'],
        'discount_type': promo['discount_type'],
        'discount_value': promo['discount_value'],
        'discount_amount': discount_amount,
        'new_total': max(0, order_total - discount_amount)
    })
