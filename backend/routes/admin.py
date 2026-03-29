from flask import Blueprint, request, jsonify, session, Response
from werkzeug.security import generate_password_hash, check_password_hash
import json
import io
import csv
import requests
from datetime import datetime

from ..database import (
    get_db_connection, get_platform_setting, set_platform_setting,
    get_cloudinary_config, get_telegram_config, get_smtp_config, 
    get_payment_config, get_yandex_maps_config
)
from ..utils.auth import require_admin, require_superadmin, admin_required_response, superadmin_required_response
from ..services.cloud_service import upload_image_to_cloud, test_cloud_connection
from ..services.email_service import send_email

admin_bp = Blueprint('admin', __name__)

# --- Auth & Admins ---

@admin_bp.route('/login', methods=['POST'])
def admin_login():
    data = request.json
    email = data.get('email')
    password = data.get('password')
    
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('SELECT * FROM users WHERE email = %s', (email,))
    user = cur.fetchone()
    cur.close()
    conn.close()
    
    if not user or not user.get('password_hash') or not check_password_hash(user['password_hash'], password):
        return jsonify({'error': 'Invalid credentials'}), 401
    
    if not user.get('is_admin'):
        return jsonify({'error': 'Access denied. Admin privileges required.'}), 403
    
    session.permanent = True
    session['user_id'] = user['id']
    
    return jsonify({
        'user': {'id': user['id'], 'email': user['email'], 'first_name': user.get('first_name'), 'is_admin': True},
        'message': 'Admin login successful'
    })

@admin_bp.route('/setup', methods=['POST'])
def admin_setup():
    data = request.json
    email = data.get('email')
    password = data.get('password')
    
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('SELECT COUNT(*) as count FROM users WHERE is_admin = TRUE')
    if cur.fetchone()['count'] > 0:
        cur.close(); conn.close()
        return jsonify({'error': 'Admin already exists'}), 403
    
    cur.execute('SELECT * FROM users WHERE email = %s', (email,))
    user = cur.fetchone()
    if not user or not check_password_hash(user['password_hash'], password):
        cur.close(); conn.close()
        return jsonify({'error': 'Invalid credentials or user not registered'}), 401
    
    cur.execute('UPDATE users SET is_admin = TRUE, is_superadmin = TRUE WHERE id = %s RETURNING *', (user['id'],))
    updated_user = cur.fetchone()
    conn.commit()
    cur.close(); conn.close()
    
    session.permanent = True
    session['user_id'] = updated_user['id']
    return jsonify({'user': updated_user, 'message': 'Admin setup successful'})

@admin_bp.route('/check-setup', methods=['GET'])
def admin_check_setup():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('SELECT COUNT(*) as count FROM users WHERE is_admin = TRUE')
    admin_count = cur.fetchone()['count']
    cur.close(); conn.close()
    return jsonify({'needs_setup': admin_count == 0})

@admin_bp.route('/me', methods=['GET'])
def admin_me():
    admin_id = require_admin()
    if not admin_id: return jsonify({'error': 'Not authorized'}), 401
    
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('SELECT id, email, first_name, last_name, is_admin, is_superadmin FROM users WHERE id = %s', (admin_id,))
    user = cur.fetchone()
    cur.close(); conn.close()
    return jsonify({'user': user})

@admin_bp.route('/users', methods=['GET'])
def get_all_users():
    if not require_admin(): return admin_required_response()
    
    conn = get_db_connection()
    cur = conn.cursor()
    # Fetch users with aggregated order data
    cur.execute('''
        SELECT 
            u.id, 
            u.username, 
            u.first_name, 
            u.last_name, 
            u.email, 
            u.telegram_id, 
            u.telegram_username,
            u.phone,
            u.created_at,
            u.is_admin,
            u.is_superadmin,
            COALESCE(ARRAY_AGG(o.id) FILTER (WHERE o.id IS NOT NULL), '{}') as order_ids,
            COUNT(o.id) as total_orders,
            COALESCE(SUM(o.total), 0) as total_spent,
            MAX(o.created_at) as last_order_at
        FROM users u
        LEFT JOIN orders o ON u.id = o.user_id
        GROUP BY u.id
        ORDER BY u.created_at DESC
    ''')
    users = cur.fetchall()
    cur.close()
    conn.close()
    
    return jsonify(users)

@admin_bp.route('/admins', methods=['GET'])
def get_all_admins():
    if not require_superadmin(): return superadmin_required_response()
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('SELECT id, email, first_name, last_name, phone, is_admin, is_superadmin, created_at FROM users WHERE is_admin = TRUE ORDER BY is_superadmin DESC, created_at ASC')
    admins = cur.fetchall()
    cur.close(); conn.close()
    return jsonify(admins)

@admin_bp.route('/impersonate/<user_id>', methods=['POST'])
def impersonate_user(user_id):
    if not require_admin(): return admin_required_response()
    
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('SELECT id, email FROM users WHERE id = %s', (user_id,))
    user = cur.fetchone()
    cur.close(); conn.close()
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    # Save current user as admin before impersonating
    if 'admin_user_id' not in session:
        session['admin_user_id'] = session.get('user_id')
    
    # Update current session to be the target user
    session['user_id'] = user['id']
    
    return jsonify({
        'message': f"Now impersonating {user['email']}",
        'user': user
    })

@admin_bp.route('/admins', methods=['POST'])
def add_admin():
    if not require_superadmin(): return superadmin_required_response()
    data = request.json
    user_id = data.get('user_id')
    
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('UPDATE users SET is_admin = TRUE WHERE id = %s RETURNING id, email', (user_id,))
    user = cur.fetchone()
    conn.commit()
    cur.close(); conn.close()
    return jsonify({'message': f"User {user['email']} promoted to admin"})

@admin_bp.route('/admins/<admin_id>', methods=['DELETE'])
def remove_admin(admin_id):
    if not require_superadmin(): return superadmin_required_response()
    if admin_id == session.get('user_id'): return jsonify({'error': 'Cannot remove yourself'}), 400
    
    conn = get_db_connection()
    cur = conn.cursor()
    # Prevent removing superadmin if needed, or check if target is superadmin
    cur.execute('UPDATE users SET is_admin = FALSE WHERE id = %s', (admin_id,))
    conn.commit()
    cur.close(); conn.close()
    return jsonify({'message': 'Admin privileges removed'})

@admin_bp.route('/admins/users', methods=['GET'])
def get_potential_admins():
    if not require_superadmin(): return superadmin_required_response()
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('SELECT id, email, first_name, last_name FROM users WHERE is_admin = FALSE ORDER BY email LIMIT 50')
    users = cur.fetchall()
    cur.close(); conn.close()
    return jsonify(users)


# --- Products ---

@admin_bp.route('/products', methods=['GET'])
def admin_get_products():
    if not require_admin(): return admin_required_response()
    
    search = request.args.get('search')
    category = request.args.get('category')
    sort = request.args.get('sort', 'name') # name, name_desc, price_asc, price_desc
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    query = 'SELECT * FROM products'
    params = []
    conditions = []
    
    if search:
        conditions.append('LOWER(name) LIKE %s')
        params.append(f'%{search.lower()}%')
    
    if category and category != 'all':
        conditions.append('category_id = %s')
        params.append(category)
        
    if conditions:
        query += ' WHERE ' + ' AND '.join(conditions)
    
    # Sorting logic
    if sort == 'name_desc':
        query += ' ORDER BY name DESC'
    elif sort == 'price_asc':
        query += ' ORDER BY price ASC'
    elif sort == 'price_desc':
        query += ' ORDER BY price DESC'
    else:
        query += ' ORDER BY name ASC'
        
    cur.execute(query, tuple(params))
    products = cur.fetchall()
    cur.close(); conn.close()
    return jsonify(products)

@admin_bp.route('/products/<product_id>', methods=['GET'])
def admin_get_product(product_id):
    if not require_admin(): return admin_required_response()
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('SELECT * FROM products WHERE id = %s', (product_id,))
    product = cur.fetchone()
    cur.close(); conn.close()
    if not product: return jsonify({'error': 'Product not found'}), 404
    return jsonify(product)

@admin_bp.route('/products', methods=['POST'])
def admin_create_product():
    if not require_admin(): return admin_required_response()
    data = request.json
    
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute('''
            INSERT INTO products (name, description, price, old_price, images, category_id, colors, attributes)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        ''', (
            data['name'], 
            data.get('description'), 
            data['price'], 
            data.get('old_price'),
            data.get('images', []), 
            data.get('category_id'),
            data.get('colors', []),
            json.dumps(data.get('attributes', []))
        ))
        pid = cur.fetchone()['id']
        conn.commit()
        return jsonify({'message': 'Product created', 'id': pid}), 201
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        cur.close(); conn.close()

@admin_bp.route('/products/<product_id>', methods=['PUT'])
def admin_update_product(product_id):
    if not require_admin(): return admin_required_response()
    data = request.json
    
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute('''
            UPDATE products 
            SET name = %s, description = %s, price = %s, old_price = %s, images = %s, category_id = %s, colors = %s, attributes = %s
            WHERE id = %s
        ''', (
            data['name'], 
            data.get('description'), 
            data['price'], 
            data.get('old_price'),
            data.get('images', []), 
            data.get('category_id'),
            data.get('colors', []),
            json.dumps(data.get('attributes', [])),
            product_id
        ))
        conn.commit()
        return jsonify({'message': 'Product updated'})
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        cur.close(); conn.close()

@admin_bp.route('/products/<product_id>', methods=['DELETE'])
def admin_delete_product(product_id):
    if not require_admin(): return admin_required_response()
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute('DELETE FROM products WHERE id = %s', (product_id,))
        # Also clean up inventory
        cur.execute('DELETE FROM product_inventory WHERE product_id = %s', (product_id,))
        conn.commit()
        return jsonify({'message': 'Product deleted'})
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        cur.close(); conn.close()

# --- Inventory ---

@admin_bp.route('/inventory', methods=['GET'])
def admin_get_inventory():
    if not require_admin(): return admin_required_response()
    
    product_id = request.args.get('product_id')
    sort = request.args.get('sort', 'name') # name, quantity_asc, quantity_desc
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    query = 'SELECT i.*, p.name as product_name FROM product_inventory i JOIN products p ON i.product_id = p.id'
    params = []
    
    if product_id:
        query += ' WHERE i.product_id = %s'
        params.append(product_id)
        
    # Sorting logic
    if sort == 'quantity_asc':
        query += ' ORDER BY i.quantity ASC'
    elif sort == 'quantity_desc':
        query += ' ORDER BY i.quantity DESC'
    elif sort == 'name_desc':
        query += ' ORDER BY p.name DESC'
    else:
        query += ' ORDER BY p.name ASC'
        
    cur.execute(query, tuple(params))
    inventory = cur.fetchall()
    cur.close(); conn.close()
    return jsonify(inventory)

@admin_bp.route('/inventory', methods=['POST'])
def admin_add_inventory():
    if not require_admin(): return admin_required_response()
    data = request.json
    
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute('''
            INSERT INTO product_inventory (product_id, color, attribute1_value, attribute2_value, quantity, backorder_lead_time_days)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (product_id, color, attribute1_value, attribute2_value) 
            DO UPDATE SET quantity = product_inventory.quantity + EXCLUDED.quantity
            RETURNING id
        ''', (
            data.get('product_id'),
            data.get('color'),
            data.get('attribute1_value'),
            data.get('attribute2_value'),
            data.get('quantity', 0),
            data.get('backorder_lead_time_days')
        ))
        conn.commit()
        return jsonify({'message': 'Inventory added'})
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 400
    finally:
        cur.close(); conn.close()

@admin_bp.route('/inventory/<item_id>', methods=['PUT', 'DELETE'])
def admin_manage_inventory_item(item_id):
    if not require_admin(): return admin_required_response()
    conn = get_db_connection()
    cur = conn.cursor()
    
    if request.method == 'DELETE':
        cur.execute('DELETE FROM product_inventory WHERE id = %s', (item_id,))
        conn.commit()
        cur.close(); conn.close()
        return jsonify({'message': 'Item deleted'})
    else:
        data = request.json
        cur.execute('''
            UPDATE product_inventory 
            SET quantity = %s, backorder_lead_time_days = %s 
            WHERE id = %s
        ''', (data.get('quantity'), data.get('backorder_lead_time_days'), item_id))
        conn.commit()
        cur.close(); conn.close()
        return jsonify({'message': 'Item updated'})

@admin_bp.route('/inventory/import', methods=['POST'])
def admin_import_inventory():
    if not require_admin(): return admin_required_response()
    data = request.json
    items = data.get('items', [])
    
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        for item in items:
            cur.execute('''
                INSERT INTO product_inventory (product_id, color, attribute1_value, attribute2_value, quantity, backorder_lead_time_days)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (product_id, color, attribute1_value, attribute2_value) 
                DO UPDATE SET quantity = EXCLUDED.quantity, backorder_lead_time_days = EXCLUDED.backorder_lead_time_days
            ''', (
                item.get('product_id'),
                item.get('color'),
                item.get('attribute1_value'),
                item.get('attribute2_value'),
                item.get('quantity', 0),
                item.get('backorder_lead_time_days')
            ))
        conn.commit()
        return jsonify({'message': f'Imported {len(items)} items'})
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        cur.close(); conn.close()

@admin_bp.route('/inventory/export', methods=['GET'])
def admin_export_inventory():
    if not require_admin(): return admin_required_response()
    conn = get_db_connection(); cur = conn.cursor()
    cur.execute('SELECT i.*, p.name FROM product_inventory i JOIN products p ON i.product_id = p.id')
    items = cur.fetchall(); cur.close(); conn.close()
    
    si = io.StringIO()
    cw = csv.DictWriter(si, fieldnames=['id', 'product_id', 'name', 'color', 'attribute1_value', 'attribute2_value', 'quantity', 'backorder_lead_time_days', 'created_at', 'updated_at'])
    cw.writeheader()
    cw.writerows(items)
    return Response(si.getvalue(), mimetype='text/csv', headers={'Content-Disposition': 'attachment; filename=inventory.csv'})


# --- Categories ---

@admin_bp.route('/categories', methods=['GET'])
def admin_get_categories():
    if not require_admin(): return admin_required_response()
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('SELECT * FROM categories ORDER BY sort_order ASC, name ASC')
    categories = cur.fetchall()
    cur.close(); conn.close()
    return jsonify(categories)

@admin_bp.route('/categories', methods=['POST'])
def admin_create_category():
    if not require_admin(): return admin_required_response()
    data = request.json
    name = data.get('name')
    icon = data.get('icon')
    sort_order = data.get('sort_order', 0)
    
    if not name: return jsonify({'error': 'Name is required'}), 400
        
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('INSERT INTO categories (name, icon, sort_order) VALUES (%s, %s, %s) RETURNING id', (name, icon, sort_order))
    new_id = cur.fetchone()['id']
    conn.commit()
    cur.close(); conn.close()
    return jsonify({'id': new_id, 'message': 'Category created'})

@admin_bp.route('/categories/<category_id>', methods=['PUT'])
def admin_update_category(category_id):
    if not require_admin(): return admin_required_response()
    data = request.json
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('UPDATE categories SET name = %s, icon = %s, sort_order = %s WHERE id = %s',
        (data.get('name'), data.get('icon'), data.get('sort_order', 0), category_id))
    conn.commit()
    cur.close(); conn.close()
    return jsonify({'message': 'Category updated'})

@admin_bp.route('/categories/<category_id>', methods=['DELETE'])
def admin_delete_category(category_id):
    if not require_admin(): return admin_required_response()
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('DELETE FROM categories WHERE id = %s', (category_id,))
    conn.commit()
    cur.close(); conn.close()
    return jsonify({'message': 'Category deleted'})


# --- Orders ---

@admin_bp.route('/orders', methods=['GET'])
def admin_get_orders():
    if not require_admin(): return admin_required_response()
    status = request.args.get('status')
    conn = get_db_connection()
    cur = conn.cursor()
    query = 'SELECT o.*, u.email as user_email, u.first_name, u.last_name FROM orders o LEFT JOIN users u ON o.user_id = u.id'
    params = []
    if status and status != 'all':
        query += ' WHERE o.status = %s'
        params.append(status)
    query += ' ORDER BY o.created_at DESC LIMIT 50'
    cur.execute(query, params)
    orders = cur.fetchall()
    for order in orders:
        cur.execute('SELECT oi.*, p.images FROM order_items oi LEFT JOIN products p ON oi.product_id = p.id WHERE oi.order_id = %s', (order['id'],))
        order['items'] = cur.fetchall()
    cur.close(); conn.close()
    return jsonify(orders)

@admin_bp.route('/orders/<order_id>/status', methods=['PUT'])
def admin_update_order_status(order_id):
    if not require_admin(): return admin_required_response()
    data = request.json
    status = data.get('status')
    
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('UPDATE orders SET status = %s WHERE id = %s', (status, order_id))
    conn.commit()
    
    # Optional: Send notification if status changed
    # We could fetch user_id and invoke notification service here
    
    cur.close(); conn.close()
    return jsonify({'message': 'Status updated'})

@admin_bp.route('/orders/<order_id>', methods=['DELETE'])
def admin_delete_order(order_id):
    if not require_admin(): return admin_required_response()
    
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute('DELETE FROM orders WHERE id = %s', (order_id,))
        conn.commit()
        return jsonify({'message': 'Order deleted successfully'})
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        cur.close(); conn.close()


# --- Settings ---

@admin_bp.route('/settings/cloudinary', methods=['GET', 'PUT'])
def admin_cloudinary_settings():
    if not require_admin(): return admin_required_response()
    if request.method == 'GET':
        config = get_cloudinary_config()
        return jsonify({'cloud_name': config['cloud_name'], 'api_key': config['api_key'], 'has_api_secret': bool(config['api_secret'])})
    
    data = request.json
    set_platform_setting('cloudinary_cloud_name', data.get('cloud_name'), False)
    set_platform_setting('cloudinary_api_key', data.get('api_key'), False)
    if data.get('api_secret'):
        set_platform_setting('cloudinary_api_secret', data.get('api_secret'), True)
    return jsonify({'message': 'Settings saved'})

@admin_bp.route('/settings/cloudinary/test', methods=['POST'])
def admin_test_cloudinary():
    if not require_admin(): return admin_required_response()
    ok, res = test_cloud_connection()
    return jsonify({'success': ok, 'message': 'Cloudinary connected' if ok else res})

@admin_bp.route('/settings/telegram', methods=['GET', 'PUT'])
def admin_telegram_settings():
    if not require_admin(): return admin_required_response()
    if request.method == 'GET':
        cfg = get_telegram_config()
        return jsonify({'bot_token': cfg['bot_token'], 'admin_chat_id': cfg['admin_chat_id'], 'notifications_enabled': cfg['notifications_enabled']})
    
    data = request.json
    set_platform_setting('telegram_bot_token', data.get('bot_token'), True)
    set_platform_setting('telegram_admin_chat_id', data.get('admin_chat_id'), False)
    set_platform_setting('telegram_notifications_enabled', str(data.get('notifications_enabled')).lower(), False)
    return jsonify({'message': 'Telegram settings saved'})

@admin_bp.route('/settings/telegram/test', methods=['POST'])
def admin_test_telegram():
    if not require_admin(): return admin_required_response()
    cfg = get_telegram_config()
    if not cfg['bot_token'] or not cfg['admin_chat_id']:
        return jsonify({'success': False, 'error': 'Telegram not configured'})
    
    url = f"https://api.telegram.org/bot{cfg['bot_token']}/sendMessage"
    payload = {'chat_id': cfg['admin_chat_id'], 'text': '✅ Test message from Admin Panel'}
    try:
        resp = requests.post(url, json=payload, timeout=10)
        return jsonify({
            'success': resp.status_code == 200, 
            'error': resp.text if resp.status_code != 200 else None,
            'message': 'Message sent successfully' if resp.status_code == 200 else None
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})


# --- Payments ---

@admin_bp.route('/settings/payments', methods=['GET'])
def admin_get_payment_settings():
    if not require_admin(): return admin_required_response()
    return jsonify({
        'click': get_payment_config('click'),
        'payme': get_payment_config('payme'),
        'uzum': get_payment_config('uzum'),
        'card_transfer': get_payment_config('card_transfer')
    })

@admin_bp.route('/settings/payments/<provider>', methods=['PUT'])
def admin_update_payment_settings(provider):
    if not require_admin(): return admin_required_response()
    data = request.json
    
    if provider == 'click':
        set_platform_setting('click_enabled', str(data.get('enabled')).lower(), False)
        set_platform_setting('click_merchant_id', data.get('merchant_id'), False)
        set_platform_setting('click_service_id', data.get('service_id'), False)
        if data.get('secret_key'): set_platform_setting('click_secret_key', data.get('secret_key'), True)
    
    elif provider == 'payme':
        set_platform_setting('payme_enabled', str(data.get('enabled')).lower(), False)
        set_platform_setting('payme_merchant_id', data.get('merchant_id'), False)
        if data.get('key'): set_platform_setting('payme_key', data.get('key'), True)
        
    elif provider == 'uzum':
        set_platform_setting('uzum_enabled', str(data.get('enabled')).lower(), False)
        set_platform_setting('uzum_merchant_id', data.get('merchant_id'), False)
        set_platform_setting('uzum_service_id', data.get('service_id'), False)
        if data.get('secret_key'): set_platform_setting('uzum_secret_key', data.get('secret_key'), True)
        
    elif provider == 'card_transfer':
        set_platform_setting('card_transfer_enabled', str(data.get('enabled')).lower(), False)
        set_platform_setting('card_transfer_card_number', data.get('card_number'), False)
        set_platform_setting('card_transfer_card_holder', data.get('card_holder'), False)
        set_platform_setting('card_transfer_bank_name', data.get('bank_name'), False)
        
    return jsonify({'message': 'Payment settings saved'})

@admin_bp.route('/settings/yandex_maps', methods=['GET', 'PUT'])
def admin_yandex_maps_settings():
    if not require_admin(): return admin_required_response()
    if request.method == 'GET':
        return jsonify(get_yandex_maps_config())
    
    data = request.json
    set_platform_setting('yandex_maps_api_key', data.get('api_key'), False)
    set_platform_setting('yandex_maps_default_lat', data.get('default_lat'), False)
    set_platform_setting('yandex_maps_default_lng', data.get('default_lng'), False)
    set_platform_setting('yandex_maps_default_zoom', str(data.get('default_zoom')), False)
    return jsonify({'message': 'Maps settings saved'})

@admin_bp.route('/settings/yandex_maps/test', methods=['POST'])
def admin_test_yandex_maps():
    if not require_admin(): return admin_required_response()
    cfg = get_yandex_maps_config()
    api_key = cfg.get('api_key')
    
    if not api_key:
        return jsonify({'success': False, 'error': 'API Key is missing'})
        
    try:
        # Simple test request to Yandex Geocoder API
        url = f"https://geocode-maps.yandex.ru/1.x/?apikey={api_key}&format=json&geocode=Tashkent"
        resp = requests.get(url, timeout=5)
        
        if resp.status_code == 200:
            data = resp.json()
            # Check if we actually got results (proves key is valid and has quota)
            if 'response' in data and 'GeoObjectCollection' in data['response']:
                return jsonify({'success': True, 'message': 'Yandex Maps API key is valid'})
            else:
                return jsonify({'success': False, 'error': 'API returned success but no data (possibly invalid key)'})
        else:
            # Check for error message in body
            try:
                error_data = resp.json()
                error_msg = error_data.get('message', str(resp.status_code))
                return jsonify({'success': False, 'error': f'API Error: {error_msg}'})
            except:
                return jsonify({'success': False, 'error': f'API Error: {resp.status_code}'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@admin_bp.route('/settings/delivery', methods=['GET', 'POST'])
def admin_delivery_settings():
    if not require_admin(): return admin_required_response()
    if request.method == 'GET':
        return jsonify({
            'delivery_days_in_stock': get_platform_setting('delivery_days_in_stock') or get_platform_setting('default_delivery_days') or 3,
            'delivery_days_backorder': get_platform_setting('delivery_days_backorder') or 14,
            'enabled': get_platform_setting('delivery_enabled') == 'true'
        })
    
    data = request.json
    if 'delivery_days_in_stock' in data:
        set_platform_setting('delivery_days_in_stock', str(data.get('delivery_days_in_stock')), False)
        # Keep default_delivery_days for backward compatibility if needed
        set_platform_setting('default_delivery_days', str(data.get('delivery_days_in_stock')), False)
    
    if 'delivery_days_backorder' in data:
        set_platform_setting('delivery_days_backorder', str(data.get('delivery_days_backorder')), False)
        
    if 'enabled' in data:
        set_platform_setting('delivery_enabled', str(data.get('enabled')).lower(), False)
        
    return jsonify({'message': 'Delivery settings saved'})
    
# --- Promo Codes ---

@admin_bp.route('/promo-codes', methods=['GET'])
def admin_get_promo_codes():
    if not require_admin(): return admin_required_response()
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('SELECT * FROM promo_codes ORDER BY created_at DESC')
    promos = cur.fetchall()
    cur.close(); conn.close()
    return jsonify(promos)

@admin_bp.route('/promo-codes', methods=['POST'])
def admin_create_promo_code():
    if not require_admin(): return admin_required_response()
    data = request.json
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute('''
            INSERT INTO promo_codes (code, discount_type, discount_value, min_order_amount, usage_limit, is_active, once_per_user)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        ''', (
            data['code'].upper(),
            data['discount_type'],
            data['discount_value'],
            data.get('min_order_amount', 0),
            data.get('usage_limit'),
            data.get('is_active', True),
            data.get('once_per_user', False)
        ))
        pid = cur.fetchone()['id']
        conn.commit()
        return jsonify({'message': 'Promo code created', 'id': pid}), 201
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        cur.close(); conn.close()

@admin_bp.route('/promo-codes/<promo_id>', methods=['PUT'])
def admin_update_promo_code(promo_id):
    if not require_admin(): return admin_required_response()
    data = request.json
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute('''
            UPDATE promo_codes 
            SET discount_type = %s, discount_value = %s, min_order_amount = %s, usage_limit = %s, is_active = %s, once_per_user = %s
            WHERE id = %s
        ''', (
            data['discount_type'],
            data['discount_value'],
            data.get('min_order_amount', 0),
            data.get('usage_limit'),
            data.get('is_active', True),
            data.get('once_per_user', False),
            promo_id
        ))
        conn.commit()
        return jsonify({'message': 'Promo code updated'})
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        cur.close(); conn.close()

@admin_bp.route('/promo-codes/<promo_id>', methods=['DELETE'])
def admin_delete_promo_code(promo_id):
    if not require_admin(): return admin_required_response()
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute('DELETE FROM promo_codes WHERE id = %s', (promo_id,))
        conn.commit()
        return jsonify({'message': 'Promo code deleted'})
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        cur.close(); conn.close()

# --- Stats ---

@admin_bp.route('/statistics', methods=['GET'])
def admin_get_statistics():
    if not require_admin(): return admin_required_response()
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        # Basic counts
        cur.execute('SELECT COUNT(*) as count FROM users'); u_count = cur.fetchone()['count']
        cur.execute('SELECT COUNT(DISTINCT user_id) as count FROM orders'); u_with_orders = cur.fetchone()['count']
        cur.execute('SELECT COUNT(*) as count FROM orders'); o_count = cur.fetchone()['count']
        cur.execute("SELECT COALESCE(SUM(total), 0) as sum FROM orders WHERE status != 'cancelled'"); rev = cur.fetchone()['sum']
        
        # Product & Category counts
        cur.execute('SELECT COUNT(*) as count FROM products'); p_count = cur.fetchone()['count']
        cur.execute('SELECT COUNT(*) as count FROM categories'); c_count = cur.fetchone()['count']
        
        # Orders by status
        cur.execute('SELECT status, COUNT(*) as count FROM orders GROUP BY status')
        obs_rows = cur.fetchall()
        orders_by_status = {row['status']: row['count'] for row in obs_rows}
        
        # Recent orders (last 7 days)
        cur.execute('''
            SELECT DATE(created_at) as date, COUNT(*) as count, SUM(total) as revenue 
            FROM orders 
            WHERE created_at > NOW() - INTERVAL '7 days' 
            GROUP BY DATE(created_at) 
            ORDER BY date DESC
        ''')
        recent_rows = cur.fetchall()
        recent_orders = [{'date': str(r['date']), 'count': r['count'], 'revenue': r['revenue']} for r in recent_rows]

        # Top Products
        cur.execute('''
            SELECT p.id, p.name, SUM(oi.quantity) as total_quantity, SUM(oi.quantity * oi.price) as total_revenue
            FROM order_items oi
            JOIN products p ON oi.product_id = p.id
            JOIN orders o ON oi.order_id = o.id
            WHERE o.status != 'cancelled'
            GROUP BY p.id, p.name
            ORDER BY total_revenue DESC
            LIMIT 5
        ''')
        top_products = cur.fetchall()

        # Top Customers
        cur.execute('''
            SELECT u.id, u.email, u.first_name, u.last_name, u.telegram_username, COUNT(o.id) as order_count, SUM(o.total) as total_spent
            FROM orders o
            JOIN users u ON o.user_id = u.id
            WHERE o.status != 'cancelled'
            GROUP BY u.id, u.email, u.first_name, u.last_name, u.telegram_username
            ORDER BY total_spent DESC
            LIMIT 5
        ''')
        top_customers = cur.fetchall()

        # Revenue by Category
        cur.execute('''
            SELECT c.name as category_name, SUM(oi.quantity * oi.price) as revenue
            FROM order_items oi
            JOIN products p ON oi.product_id = p.id
            JOIN categories c ON p.category_id = c.id
            JOIN orders o ON oi.order_id = o.id
            WHERE o.status != 'cancelled'
            GROUP BY c.name
            ORDER BY revenue DESC
        ''')
        category_revenue = cur.fetchall()

        # Monthly Revenue (last 6 months)
        cur.execute('''
            SELECT TO_CHAR(created_at, 'YYYY-MM') as month, SUM(total) as revenue
            FROM orders
            WHERE status != 'cancelled' AND created_at > NOW() - INTERVAL '6 months'
            GROUP BY month
            ORDER BY month ASC
        ''')
        monthly_revenue = cur.fetchall()

        # Inventory Summary
        cur.execute('SELECT COALESCE(SUM(quantity), 0) as total_stock FROM product_inventory')
        total_stock = cur.fetchone()['total_stock']
        cur.execute('SELECT COUNT(*) as low_stock_count FROM product_inventory WHERE quantity <= 5')
        low_stock_count = cur.fetchone()['low_stock_count']
        
        cur.close(); conn.close()
        
        return jsonify({
            'total_users': u_count,
            'users_with_orders': u_with_orders,
            'total_orders': o_count,
            'total_revenue': rev,
            'orders_by_status': orders_by_status,
            'total_products': p_count,
            'total_categories': c_count,
            'recent_orders': recent_orders,
            'top_products': top_products,
            'top_customers': top_customers,
            'category_revenue': category_revenue,
            'monthly_revenue': monthly_revenue,
            'inventory_summary': {
                'total_stock': total_stock,
                'low_stock_count': low_stock_count
            }
        })
    except Exception as e:
        if not cur.closed: cur.close()
        if not conn.closed: conn.close()
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/settings/smtp', methods=['GET', 'PUT'])
def admin_smtp_settings():
    if not require_admin(): return admin_required_response()
    
    if request.method == 'GET':
        cfg = get_smtp_config()
        # Don't return the actual password, just a flag if it exists
        return jsonify({
            'host': cfg['host'], 
            'port': cfg['port'], 
            'user': cfg['user'], 
            'has_password': bool(cfg['password']),
            'from_email': cfg['from_email'],
            'from_name': cfg['from_name'],
            'use_tls': cfg['use_tls']
        })
    
    data = request.json
    set_platform_setting('smtp_host', data.get('host'), False)
    set_platform_setting('smtp_port', data.get('port'), False)
    set_platform_setting('smtp_user', data.get('user'), False)
    # Only update password if provided
    if data.get('password'):
        set_platform_setting('smtp_password', data.get('password'), True)
        
    set_platform_setting('smtp_from_email', data.get('from_email'), False)
    set_platform_setting('smtp_from_name', data.get('from_name'), False)
    set_platform_setting('smtp_use_tls', str(data.get('use_tls', 'true')).lower(), False)
    
    return jsonify({'message': 'SMTP settings saved'})

@admin_bp.route('/settings/smtp/test', methods=['POST'])
def admin_test_smtp():
    if not require_admin(): return admin_required_response()
    
    # Use the email of the current admin for testing
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('SELECT email FROM users WHERE id = %s', (session['user_id'],))
    admin_email = cur.fetchone()['email']
    cur.close(); conn.close()
    
    if not admin_email:
        return jsonify({'success': False, 'error': 'Admin email not found'})
        
    # Send test email
    success, error = send_email(
        to_email=admin_email,
        subject='SMTP Test - Admin Panel',
        html_content='<p>✅ Test email from Admin Panel. Your SMTP settings are correct.</p>'
    )
    
    if not success:
        return jsonify({'success': False, 'error': f"SMTP Error: {error}"})
        
    return jsonify({'success': True, 'message': 'Test email sent successfully'})
