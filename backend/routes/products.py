from flask import Blueprint, request, jsonify
from ..database import get_db_connection, DEMO_MODE
import json as _json

products_bp = Blueprint('products', __name__)

def _normalize(product):
    """Parse JSON string fields for SQLite compatibility."""
    if not DEMO_MODE:
        return dict(product)
    d = dict(product)
    for field in ('images', 'colors', 'attributes'):
        if isinstance(d.get(field), str):
            try:
                d[field] = _json.loads(d[field])
            except Exception:
                pass
    return d


@products_bp.route('/products', methods=['GET'])
def get_products():
    try:
        category = request.args.get('category')
        conn = get_db_connection()
        cur = conn.cursor()
        if category and category != 'all':
            cur.execute('SELECT p.* FROM products p WHERE p.category_id = %s AND EXISTS (SELECT 1 FROM product_inventory pi WHERE pi.product_id = p.id AND pi.quantity > 0) ORDER BY p.created_at DESC', (category,))
        else:
            cur.execute('SELECT p.* FROM products p WHERE EXISTS (SELECT 1 FROM product_inventory pi WHERE pi.product_id = p.id AND pi.quantity > 0) ORDER BY p.created_at DESC')
        products = [_normalize(p) for p in cur.fetchall()]
        cur.close()
        conn.close()
        return jsonify(products)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@products_bp.route('/products/<product_id>', methods=['GET'])
def get_product(product_id):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('SELECT * FROM products WHERE id = %s', (product_id,))
        product = cur.fetchone()
        if not product:
            cur.close()
            conn.close()
            return jsonify({'error': 'Product not found'}), 404
        
        cur.execute('SELECT color, attribute1_value, attribute2_value, quantity, backorder_lead_time_days FROM product_inventory WHERE product_id = %s', (product_id,))
        inventory = cur.fetchall()
        cur.close()
        conn.close()
        
        product_data = _normalize(product)
        product_data['inventory'] = [dict(i) for i in inventory]
        return jsonify(product_data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@products_bp.route('/products/<product_id>/inventory', methods=['GET'])
def get_product_inventory(product_id):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('SELECT color, attribute1_value, attribute2_value, quantity, backorder_lead_time_days FROM product_inventory WHERE product_id = %s', (product_id,))
        inventory = cur.fetchall()
        cur.close()
        conn.close()
        return jsonify(inventory)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@products_bp.route('/products/availability', methods=['POST'])
def check_products_availability():
    try:
        data = request.json
        items = data.get('items', []) # Expects [{product_id, quantity, color, attribute1_value, ...}]
        
        conn = get_db_connection()
        cur = conn.cursor()
        
        results = []
        for item in items:
            pid = item.get('product_id')
            if not pid: continue
            
            # Construct query based on provided attributes
            query = "SELECT quantity FROM product_inventory WHERE product_id = %s"
            params = [pid]
            
            if item.get('color'):
                query += " AND color = %s"
                params.append(item.get('color'))
            else:
                query += " AND color IS NULL"
                
            if item.get('attribute1_value'):
                query += " AND attribute1_value = %s"
                params.append(item.get('attribute1_value'))
            else:
                query += " AND attribute1_value IS NULL"
                
            if item.get('attribute2_value'):
                query += " AND attribute2_value = %s"
                params.append(item.get('attribute2_value'))
            else:
                query += " AND attribute2_value IS NULL"
                
            cur.execute(query, tuple(params))
            row = cur.fetchone()
            
            available = row['quantity'] >= item.get('quantity', 1) if row else False
            results.append({
                'product_id': pid,
                'available': available,
                'quantity_in_stock': row['quantity'] if row else 0
            })
            
        cur.close()
        conn.close()
        return jsonify({'items': results})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@products_bp.route('/products/check', methods=['POST'])
def check_products_exist():
    try:
        data = request.json
        product_ids = data.get('product_ids', [])
        if not product_ids:
            return jsonify({'existing': [], 'missing': []})
        
        conn = get_db_connection()
        cur = conn.cursor()
        placeholders = ','.join(['%s'] * len(product_ids))
        cur.execute(f'SELECT id FROM products WHERE id IN ({placeholders})', tuple(product_ids))
        existing_ids = [p['id'] for p in cur.fetchall()]
        missing_ids = [pid for pid in product_ids if pid not in existing_ids]
        cur.close()
        conn.close()
        return jsonify({'existing': existing_ids, 'missing': missing_ids})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@products_bp.route('/categories', methods=['GET'])
def get_categories():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('SELECT * FROM categories ORDER BY sort_order, name')
        categories = cur.fetchall()
        cur.close()
        conn.close()
        return jsonify(categories)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
@products_bp.route('/favorites/<user_id>', methods=['GET'])
def get_favorites(user_id):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('''
            SELECT p.* FROM favorites f
            JOIN products p ON f.product_id = p.id
            WHERE f.user_id = %s
        ''', (user_id,))
        favorites = [_normalize(p) for p in cur.fetchall()]
        cur.close()
        conn.close()
        return jsonify(favorites)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@products_bp.route('/favorites', methods=['POST'])
def add_to_favorites():
    try:
        data = request.json
        user_id = data.get('user_id')
        product_id = data.get('product_id')
        
        if not user_id or not product_id:
            return jsonify({'error': 'User ID and Product ID are required'}), 400
            
        conn = get_db_connection()
        cur = conn.cursor()
        if DEMO_MODE:
            cur.execute(
                'INSERT OR IGNORE INTO favorites (id, user_id, product_id) VALUES (?,?,?)',
                (str(__import__('uuid').uuid4()), user_id, product_id)
            )
        else:
            cur.execute(
                'INSERT INTO favorites (user_id, product_id) VALUES (%s, %s) ON CONFLICT DO NOTHING',
                (user_id, product_id)
            )
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'message': 'Added to favorites'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@products_bp.route('/favorites/<user_id>/<product_id>', methods=['DELETE'])
def remove_from_favorites(user_id, product_id):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            'DELETE FROM favorites WHERE user_id = %s AND product_id = %s',
            (user_id, product_id)
        )
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'message': 'Removed from favorites'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
