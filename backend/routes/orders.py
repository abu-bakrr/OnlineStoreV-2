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
        user_id = data.get('user_id')
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
                    # Check min order amount
                    if total >= promo['min_order_amount']:
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

        has_backorder = False
        max_backorder_days = 0
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
                SELECT id, quantity, backorder_lead_time_days FROM product_inventory
                WHERE product_id = %s AND (color = %s OR (color IS NULL AND %s IS NULL))
                AND (attribute1_value = %s OR (attribute1_value IS NULL AND %s IS NULL))
                AND (attribute2_value = %s OR (attribute2_value IS NULL AND %s IS NULL))
                FOR UPDATE
            ''', (item['product_id'], selected_color, selected_color, attr1_val, attr1_val, attr2_val, attr2_val))
            
            inventory = cur.fetchone()
            status = 'in_stock'
            lead_time = None
            
            if inventory:
                if inventory['quantity'] >= item['quantity']:
                    cur.execute('UPDATE product_inventory SET quantity = quantity - %s WHERE id = %s', (item['quantity'], inventory['id']))
                else:
                    status = 'backorder'
                    lead_time = inventory.get('backorder_lead_time_days')
                    has_backorder = True
                    max_backorder_days = max(max_backorder_days, lead_time or 0)
                    cur.execute('UPDATE product_inventory SET quantity = 0 WHERE id = %s', (inventory['id'],))
            else:
                status = 'backorder'
                has_backorder = True
            
            order_items_with_status.append({**dict(item), 'availability_status': status, 'backorder_lead_time_days': lead_time})
        
        def safe_int(val, default):
            try:
                if val is None or str(val).lower() == 'none' or str(val).strip() == '':
                    return default
                return int(float(val))
            except (ValueError, TypeError):
                return default

        # Get delivery settings
        default_in_stock_days = safe_int(get_platform_setting('delivery_days_in_stock'), 3)
        # Check backward compatibility for the setting name
        if not get_platform_setting('delivery_days_in_stock'):
            alt_in_stock = get_platform_setting('default_delivery_days')
            if alt_in_stock:
                default_in_stock_days = safe_int(alt_in_stock, 3)
                
        default_backorder_days = safe_int(get_platform_setting('delivery_days_backorder'), 14)
        
        # Calculate maximum delivery days across all items
        max_days = 0
        for item in order_items_with_status:
            if item['availability_status'] == 'backorder':
                # For backordered items, take the max of the default backorder days 
                # and the specific lead time set for this product variant
                lead_time = item.get('backorder_lead_time_days') or 0
                max_days = max(max_days, default_backorder_days, lead_time)
            else:
                # For in-stock items, use the default in-stock delivery days
                max_days = max(max_days, default_in_stock_days)
        
        estimated_days = max_days
        backorder_date = datetime.now() + timedelta(days=estimated_days) if has_backorder else None
        
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
