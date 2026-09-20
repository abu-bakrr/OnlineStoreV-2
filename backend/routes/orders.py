from flask import Blueprint, request, jsonify, session
from datetime import datetime, timedelta
import json as json_lib
import base64

from ..database import get_db_connection, get_platform_setting, get_payment_config
from ..services.tg_service import send_telegram_notification

orders_bp = Blueprint('orders', __name__)

@orders_bp.route('/orders', methods=['POST'])
def create_order():
    try:
        data = request.json
        user_id = session.get('user_id') or data.get('user_id')
        if not user_id:
            return jsonify({'error': 'User ID is required'}), 400
        cart_items = data.get('items', [])
        total = data.get('total', 0)
        
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('SELECT * FROM users WHERE id = %s', (user_id,))
        if not cur.fetchone():
            cur.close()
            conn.close()
            return jsonify({'error': 'User not found'}), 404
        
        cur.execute('INSERT INTO orders (user_id, total, status) VALUES (%s, %s, %s) RETURNING id', (user_id, total, 'reviewing'))
        order_id = cur.fetchone()['id']
        
        for item in cart_items:
            cur.execute(
                '''INSERT INTO order_items (order_id, product_id, name, price, quantity, selected_color, selected_attributes) 
                   VALUES (%s, %s, %s, %s, %s, %s, %s)''',
                (order_id, item.get('id'), item.get('name'), item.get('price'), item.get('quantity'), 
                 item.get('selected_color'), json_lib.dumps(item.get('selected_attributes')) if item.get('selected_attributes') else None)
            )
        
        cur.execute('''
            DELETE FROM orders WHERE user_id = %s AND id NOT IN (
                SELECT id FROM orders WHERE user_id = %s ORDER BY created_at DESC LIMIT 5
            )
        ''', (user_id, user_id))
        
        cur.execute('DELETE FROM cart WHERE user_id = %s', (user_id,))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'message': 'Order created', 'order_id': order_id}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@orders_bp.route('/orders/checkout', methods=['POST'])
def checkout_order():
    try:
        data = request.json
        user_id = session.get('user_id') or data.get('user_id')
        if not user_id:
            return jsonify({'error': 'Not authenticated'}), 401
        
        payment_method = data.get('payment_method')
        delivery_address = data.get('delivery_address')
        customer_name = data.get('customer_name')
        customer_phone = data.get('customer_phone')
        payment_receipt_url = data.get('payment_receipt_url')
        
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('''
            SELECT c.product_id, c.quantity, c.selected_color, c.selected_attributes, p.name, p.price
            FROM cart c JOIN products p ON c.product_id = p.id WHERE c.user_id = %s
        ''', (user_id,))
        cart_items = cur.fetchall()
        
        if not cart_items:
            cur.close()
            conn.close()
            return jsonify({'error': 'Cart is empty'}), 400
        
        total = sum(item['price'] * item['quantity'] for item in cart_items)
        
        # Promo code logic
        promo_code = data.get('promo_code')
        discount_amount = 0
        if promo_code:
            cur.execute('SELECT * FROM promo_codes WHERE code = %s AND is_active = TRUE', (promo_code.upper(),))
            promo = cur.fetchone()
            if promo:
                # Check usage limit
                if promo['usage_limit'] is None or promo['used_count'] < promo['usage_limit']:
                    # Check if once per user
                    if promo.get('once_per_user'):
                        cur.execute('SELECT COUNT(*) as count FROM orders WHERE user_id = %s AND promo_code = %s', (user_id, promo['code']))
                        if cur.fetchone()['count'] > 0:
                            promo_code = None
                    
                    if promo_code and total >= promo['min_order_amount']:
                        if promo['discount_type'] == 'percentage':
                            discount_amount = int(total * (promo['discount_value'] / 100))
                        else:
                            discount_amount = promo['discount_value']
                        
                        discount_amount = min(discount_amount, total)
                        total = max(0, total - discount_amount)
                        
                        # Increment used_count
                        cur.execute('UPDATE promo_codes SET used_count = used_count + 1 WHERE id = %s', (promo['id'],))
                        promo_code = promo['code'] # Use normalized code
                    else:
                        promo_code = None
                else:
                    promo_code = None
            else:
                promo_code = None

        order_items_with_status = []
        
        for item in cart_items:
            selected_attrs = item.get('selected_attributes')
            if isinstance(selected_attrs, str):
                selected_attrs = json_lib.loads(selected_attrs) if selected_attrs else {}
            
            vals = list(selected_attrs.values()) if selected_attrs else []
            attr1_val = vals[0] if vals else None
            attr2_val = vals[1] if len(vals) > 1 else None
            selected_color = item.get('selected_color')
            
            cur.execute('''
                SELECT id, quantity FROM product_inventory
                WHERE product_id = %s AND (color = %s OR (color IS NULL AND %s IS NULL))
                AND (attribute1_value = %s OR (attribute1_value IS NULL AND %s IS NULL))
                AND (attribute2_value = %s OR (attribute2_value IS NULL AND %s IS NULL))
                FOR UPDATE
            ''', (item['product_id'], selected_color, selected_color, attr1_val, attr1_val, attr2_val, attr2_val))
            
            inventory = cur.fetchone()
            
            if inventory and inventory['quantity'] >= item['quantity']:
                cur.execute('UPDATE product_inventory SET quantity = quantity - %s WHERE id = %s', (item['quantity'], inventory['id']))
            else:
                conn.rollback()
                cur.close()
                conn.close()
                return jsonify({'error': f"Товар {item['name']} закончился на складе."}), 400
            
            order_items_with_status.append({**dict(item), 'availability_status': 'in_stock', 'backorder_lead_time_days': None})
        
        def safe_int(val, default):
            try:
                if val is None or str(val).lower() == 'none' or str(val).strip() == '':
                    return default
                return int(float(val))
            except (ValueError, TypeError):
                return default

        # Get delivery settings
        default_in_stock_days = safe_int(get_platform_setting('delivery_days_in_stock'), 3)
        if not get_platform_setting('delivery_days_in_stock'):
            alt_in_stock = get_platform_setting('default_delivery_days')
            if alt_in_stock:
                default_in_stock_days = safe_int(alt_in_stock, 3)
                
        estimated_days = default_in_stock_days
        has_backorder = False
        backorder_date = None
        
        initial_status = 'reviewing'
        initial_pay_status = 'awaiting_verification' if payment_method == 'card_transfer' and payment_receipt_url else 'pending'
        
        cur.execute('''
            INSERT INTO orders (user_id, total, status, payment_method, payment_status, delivery_address, 
                               customer_phone, customer_name, payment_receipt_url, has_backorder, 
                               backorder_delivery_date, estimated_delivery_days, promo_code, discount_amount)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
        ''', (user_id, total, initial_status, payment_method, initial_pay_status, delivery_address, 
              customer_phone, customer_name, payment_receipt_url, has_backorder, backorder_date, estimated_days,
              promo_code, discount_amount))
        order_id = cur.fetchone()['id']
        
        for item in order_items_with_status:
            cur.execute('''
                INSERT INTO order_items (order_id, product_id, name, price, quantity, selected_color, 
                                        selected_attributes, availability_status, backorder_lead_time_days)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ''', (order_id, item['product_id'], item['name'], item['price'], item['quantity'], 
                  item.get('selected_color'), json_lib.dumps(item.get('selected_attributes')) if item.get('selected_attributes') else None,
                  item['availability_status'], item.get('backorder_lead_time_days')))
        
        conn.commit()
        
        # Payment generation logic
        payment_url = None
        if payment_method == 'click':
            cfg = get_payment_config('click')
            if cfg.get('enabled') and cfg.get('merchant_id'):
                payment_url = f"https://my.click.uz/services/pay?service_id={cfg['service_id']}&merchant_id={cfg['merchant_id']}&amount={total}&transaction_param={order_id}"
        elif payment_method == 'payme':
            cfg = get_payment_config('payme')
            if cfg.get('enabled') and cfg.get('merchant_id'):
                acc = f"m={cfg['merchant_id']};ac.order_id={order_id};a={total * 100}"
                payment_url = f"https://checkout.paycom.uz/{base64.b64encode(acc.encode()).decode()}"
        elif payment_method == 'uzum':
            cfg = get_payment_config('uzum')
            if cfg.get('enabled') and cfg.get('merchant_id'):
                payment_url = f"https://payment.apelsin.uz/merchant?merchantId={cfg['merchant_id']}&amount={total}&orderId={order_id}"
        # Always clear cart after order
        cur.execute('DELETE FROM cart WHERE user_id = %s', (user_id,))
        conn.commit()

        if payment_url:
            cur.execute('UPDATE orders SET payment_id = %s WHERE id = %s', (f"{payment_method}_{order_id}", order_id))
            conn.commit()

        cur.close()
        conn.close()
        
        # Notification
        order_data = {'id': order_id, 'total': total, 'customer_name': customer_name, 'customer_phone': customer_phone, 
                      'delivery_address': delivery_address, 'payment_method': payment_method, 'payment_receipt_url': payment_receipt_url}
        send_telegram_notification(order_data, order_items_with_status, request.url_root)
        
        return jsonify({'order_id': order_id, 'payment_url': payment_url, 'message': 'Success'}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@orders_bp.route('/orders', methods=['GET'])
def get_user_orders():
    try:
        user_id = session.get('user_id')
        if not user_id: return jsonify({'error': 'Not authenticated'}), 401
        
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('SELECT * FROM orders WHERE user_id = %s ORDER BY created_at DESC LIMIT 50', (user_id,))
        orders = cur.fetchall()
        
        for order in orders:
            cur.execute('''
                SELECT oi.*, p.images[1] as image_url FROM order_items oi
                LEFT JOIN products p ON oi.product_id = p.id WHERE oi.order_id = %s
            ''', (order['id'],))
            order['items'] = cur.fetchall()
        
        cur.close()
        conn.close()
        return jsonify(orders)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
