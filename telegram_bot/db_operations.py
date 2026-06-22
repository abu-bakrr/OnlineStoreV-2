import psycopg2
from psycopg2.extras import RealDictCursor
from typing import Optional, List, Dict, Any, cast
import os
import json
from pathlib import Path
from dotenv import load_dotenv
import time

load_dotenv()


def get_db_connection(max_retries=3, retry_delay=2):
    """
    Creates database connection with retry logic
    
    Args:
        max_retries (int): Maximum number of connection attempts
        retry_delay (int): Delay in seconds between retries
        
    Returns:
        psycopg2.connection: Database connection
        
    Raises:
        Exception: If connection fails after all retries
    """
    database_url = os.getenv('DATABASE_URL')
    
    for attempt in range(max_retries):
        try:
            if database_url:
                if 'sslmode=' not in database_url:
                    database_url = database_url + ('&' if '?' in database_url else '?') + 'sslmode=require'
                conn = psycopg2.connect(database_url, cursor_factory=RealDictCursor)
            else:
                conn = psycopg2.connect(
                    host=os.getenv('PGHOST'),
                    port=os.getenv('PGPORT', '5432'),
                    user=os.getenv('PGUSER'),
                    password=os.getenv('PGPASSWORD'),
                    database=os.getenv('PGDATABASE'),
                    sslmode='require',
                    cursor_factory=RealDictCursor
                )
            print(f"✅ Подключение к БД успешно (попытка {attempt + 1})")
            return conn
        except (psycopg2.OperationalError, psycopg2.DatabaseError) as e:
            print(f"❌ Ошибка подключения к БД (попытка {attempt + 1}/{max_retries}): {e}")
            if attempt < max_retries - 1:
                print(f"⏳ Повторная попытка через {retry_delay} секунд...")
                time.sleep(retry_delay)
            else:
                print("❌ Не удалось подключиться к БД после всех попыток")
                raise


def get_categories_from_config():
    """
    Gets categories from settingsbot.json file
    
    Returns:
        list: Array of category dictionaries or empty array if error
    """
    try:
        config_path = os.path.join(os.path.dirname(__file__), 'settingsbot.json')
        with open(config_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return data.get('categories', [])
    except FileNotFoundError:
        print("⚠️ Файл settingsbot.json не найден.")
        return []
    except Exception as e:
        print(f"❌ Ошибка загрузки категорий: {e}")
        return []


def add_product(
    name: str, 
    description: str, 
    price: int, 
    images: List[str], 
    category_id: Optional[str] = None,
    colors: Optional[List[str]] = None,
    attributes: Optional[List[Dict[str, Any]]] = None
) -> Optional[Dict[str, Any]]:
    """
    Adds new product to database
    
    Parameters:
        name (str): Product name
        description (str): Product description
        price (int): Product price in cents
        images (list): Array of image URLs
        category_id (str, optional): Category ID (must match category ID from config)
        colors (list, optional): Array of color hex codes
        attributes (list, optional): Array of attribute dictionaries with 'name' and 'values'
    
    Returns:
        dict: Dictionary with created product data or None if error
    """
    conn = None
    try:
        conn = get_db_connection()
        if not conn:
            return None
        cur = conn.cursor()
        
        # Преобразуем attributes в JSON если есть
        attributes_json = json.dumps(attributes) if attributes else None
        
        cur.execute(
            '''INSERT INTO products 
               (name, description, price, images, category_id, colors, attributes) 
               VALUES (%s, %s, %s, %s, %s, %s, %s) 
               RETURNING *''',
            (name, description, price, images, category_id, colors, attributes_json)
        )
        product = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()
        return cast(Optional[Dict[str, Any]], product)
    except Exception as e:
        print(f"Error adding product: {e}")
        if conn:
            conn.close()
        return None


def delete_product(product_id: str) -> bool:
    """
    Deletes product from database
    
    Parameters:
        product_id (str): Product ID to delete
    
    Returns:
        bool: True if product deleted, False if error
    """
    conn = None
    try:
        conn = get_db_connection()
        if not conn:
            return False
        cur = conn.cursor()
        cur.execute('DELETE FROM products WHERE id = %s', (product_id,))
        deleted_count = cur.rowcount
        conn.commit()
        cur.close()
        conn.close()
        return deleted_count > 0
    except Exception as e:
        print(f"Error deleting product: {e}")
        if conn:
            conn.close()
        return False


def get_all_products(category_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Gets all products from database (with optional category filter)
    
    Parameters:
        category_id (str, optional): Category ID for filtering
    
    Returns:
        list: Array of product dictionaries or empty array if error
    """
    conn = None
    try:
        conn = get_db_connection()
        if not conn:
            return []
        cur = conn.cursor()
        
        if category_id:
            cur.execute('SELECT * FROM products WHERE category_id = %s', (category_id,))
        else:
            cur.execute('SELECT * FROM products')
        
        products = cur.fetchall()
        cur.close()
        conn.close()
        return cast(List[Dict[str, Any]], products)
    except Exception as e:
        print(f"Error getting products: {e}")
        if conn:
            conn.close()
        return []


def get_product_by_id(product_id: str) -> Optional[Dict[str, Any]]:
    """
    Gets product by ID
    
    Parameters:
        product_id (str): Product ID
    
    Returns:
        dict: Dictionary with product data or None if not found
    """
    conn = None
    try:
        conn = get_db_connection()
        if not conn:
            return None
        cur = conn.cursor()
        cur.execute('SELECT * FROM products WHERE id = %s', (product_id,))
        product = cur.fetchone()
        cur.close()
        conn.close()
        return cast(Optional[Dict[str, Any]], product)
    except Exception as e:
        print(f"Error getting product: {e}")
        if conn:
            conn.close()
        return None


def find_products_by_name(name: str) -> List[Dict[str, Any]]:
    """
    Searches products by name (partial match)
    
    Parameters:
        name (str): Product name or part of name
    
    Returns:
        list: Array of product dictionaries or empty array
    """
    conn = None
    try:
        conn = get_db_connection()
        if not conn:
            return []
        cur = conn.cursor()
        cur.execute('SELECT * FROM products WHERE name ILIKE %s', (f'%{name}%',))
        products = cur.fetchall()
        cur.close()
        conn.close()
        return cast(List[Dict[str, Any]], products)
    except Exception as e:
        print(f"Error searching products: {e}")
        if conn:
            conn.close()
        return []

def update_order_status(order_id: str, status: str) -> bool:
    """
    Updates the status of an order in the database.
    
    Parameters:
        order_id (str): Order ID
        status (str): New status ('pending', 'processing', 'delivering', 'delivered', 'cancelled')
        
    Returns:
        bool: True if updated successfully, False otherwise
    """
    conn = None
    try:
        conn = get_db_connection()
        if not conn:
            return False
        cur = conn.cursor()
        cur.execute('UPDATE orders SET status = %s, updated_at = NOW() WHERE id = %s', (status, order_id))
        updated_count = cur.rowcount
        conn.commit()
        cur.close()
        conn.close()
        return updated_count > 0
    except Exception as e:
        print(f"Error updating order status: {e}")
        if conn:
            conn.close()
        return False

