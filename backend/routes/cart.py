from flask import Blueprint, request, jsonify, session
import json as json_lib
from ..database import get_db_connection, get_platform_setting

cart_bp = Blueprint('cart', __name__)

@cart_bp.route('/cart/<user_id>', methods=['GET'])
def get_cart(user_id):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('''
            SELECT p.*, c.id as cart_id, c.quantity, c.selected_color, c.selected_attributes 
            FROM products p
            JOIN cart c ON p.id = c.product_id
            WHERE c.user_id = %s
        ''', (user_id,))
        cart_items = cur.fetchall()
        cur.close()
        conn.close()
        return jsonify(cart_items)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@cart_bp.route('/cart/<user_id>/delivery-info', methods=['GET'])
def get_cart_delivery_info(user_id):
    try:
        try:
            delivery_days_in_stock = int(float(get_platform_setting('delivery_days_in_stock') or 3))
        except (ValueError, TypeError):
            delivery_days_in_stock = 3
            
        return jsonify({
            'has_backorder': False,
            'max_backorder_days': 0,
            'default_delivery_days': delivery_days_in_stock,
            'estimated_days': delivery_days_in_stock
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@cart_bp.route('/cart', methods=['POST'])
def add_to_cart():
    try:
        data = request.json
        user_id = data['user_id']
        product_id = data['product_id']
        quantity = data.get('quantity', 1)
        selected_color = data.get('selected_color')
        selected_attributes = data.get('selected_attributes')
        
        attrs_json = json_lib.dumps(selected_attributes) if selected_attributes else None
        
        attr1_val = list(selected_attributes.values())[0] if selected_attributes else None
        attr2_val = list(selected_attributes.values())[1] if selected_attributes and len(selected_attributes) > 1 else None
        
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute('''
            SELECT quantity FROM product_inventory
            WHERE product_id = %s AND (color = %s OR (color IS NULL AND %s IS NULL))
            AND (attribute1_value = %s OR (attribute1_value IS NULL AND %s IS NULL))
            AND (attribute2_value = %s OR (attribute2_value IS NULL AND %s IS NULL))
        ''', (product_id, selected_color, selected_color, attr1_val, attr1_val, attr2_val, attr2_val))
        inv = cur.fetchone()
        
        if not inv or inv['quantity'] < quantity:
            cur.close()
            conn.close()
            return jsonify({'error': 'Товара нет в наличии или недостаточно на складе'}), 400

        if attrs_json:
            cur.execute('SELECT id, quantity FROM cart WHERE user_id = %s AND product_id = %s AND (selected_color = %s OR (selected_color IS NULL AND %s IS NULL)) AND selected_attributes = %s::jsonb', 
                        (user_id, product_id, selected_color, selected_color, attrs_json))
        else:
            cur.execute('SELECT id, quantity FROM cart WHERE user_id = %s AND product_id = %s AND (selected_color = %s OR (selected_color IS NULL AND %s IS NULL)) AND selected_attributes IS NULL', 
                        (user_id, product_id, selected_color, selected_color))
        
        existing = cur.fetchone()
        if existing:
            cur.execute('UPDATE cart SET quantity = %s WHERE id = %s RETURNING *', (existing['quantity'] + quantity, existing['id']))
        else:
            cur.execute('INSERT INTO cart (user_id, product_id, quantity, selected_color, selected_attributes) VALUES (%s, %s, %s, %s, %s) RETURNING *', 
                        (user_id, product_id, quantity, selected_color, attrs_json))
        
        cart_item = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()
        return jsonify(cart_item), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@cart_bp.route('/cart', methods=['PUT'])
def update_cart_quantity():
    try:
        data = request.json
        cart_id = data.get('cart_id')
        quantity = data['quantity']
        conn = get_db_connection()
        cur = conn.cursor()
        if cart_id:
            cur.execute('UPDATE cart SET quantity = %s WHERE id = %s RETURNING *', (quantity, cart_id))
        else:
            cur.execute('UPDATE cart SET quantity = %s WHERE user_id = %s AND product_id = %s RETURNING *', (quantity, data['user_id'], data['product_id']))
        cart_item = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()
        return jsonify(cart_item) if cart_item else (jsonify({'error': 'Not found'}), 404)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@cart_bp.route('/cart/<cart_id>', methods=['DELETE'])
def remove_from_cart(cart_id):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('DELETE FROM cart WHERE id = %s', (cart_id,))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'message': 'Removed'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@cart_bp.route('/cart/clear/<user_id>', methods=['DELETE'])
def clear_cart(user_id):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('DELETE FROM cart WHERE user_id = %s', (user_id,))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'message': 'Cleared'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
