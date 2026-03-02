"""
AI Database Helper - модуль для работы с базой данных товаров
Используется AI ботом для получения информации о товарах
"""

import psycopg2
from psycopg2.extras import RealDictCursor
import os
import json
import re
from datetime import datetime, timedelta

# Кеш для ускорения работы
_product_search_cache = {}
_cache_ttl = timedelta(minutes=5)


def hex_to_color_name(hex_color):
    """
    Конвертирует HEX-код цвета в название на русском языке
    
    Args:
        hex_color (str): HEX-код цвета (например, #000000 или 000000)
        
    Returns:
        str: Название цвета на русском
    """
    # Убираем # если есть
    hex_color = hex_color.strip().lstrip('#').upper()
    
    # Словарь основных цветов
    color_map = {
        # Черные и серые
        '000000': 'черный',
        'FFFFFF': 'белый',
        '808080': 'серый',
        'C0C0C0': 'серебристый',
        '696969': 'темно-серый',
        'A9A9A9': 'светло-серый',
        '2F2F2F': 'темно-серый',
        'D3D3D3': 'светло-серый',
        
        # Красные
        'FF0000': 'красный',
        'DC143C': 'малиновый',
        'B22222': 'кирпично-красный',
        '8B0000': 'темно-красный',
        'FF6347': 'томатный',
        'FF4500': 'оранжево-красный',
        'FF1493': 'розовый',
        'FF69B4': 'ярко-розовый',
        'FFC0CB': 'светло-розовый',
        
        # Оранжевые
        'FFA500': 'оранжевый',
        'FF8C00': 'темно-оранжевый',
        'FF7F50': 'коралловый',
        
        # Желтые
        'FFFF00': 'желтый',
        'FFD700': 'золотой',
        'FFD700': 'золотистый',
        'FFFFE0': 'светло-желтый',
        'FFF8DC': 'кремовый',
        
        # Зеленые
        '008000': 'зеленый',
        '00FF00': 'лайм',
        '228B22': 'лесной зеленый',
        '32CD32': 'салатовый',
        '00FF7F': 'весенний зеленый',
        '2E8B57': 'морской зеленый',
        '006400': 'темно-зеленый',
        '00FF00': 'ярко-зеленый',
        'ADFF2F': 'желто-зеленый',
        
        # Синие
        '0000FF': 'синий',
        '000080': 'темно-синий',
        '00008B': 'навигационный синий',
        '191970': 'полночный синий',
        '4169E1': 'королевский синий',
        '1E90FF': 'ярко-синий',
        '00BFFF': 'небесно-голубой',
        '87CEEB': 'небесно-голубой',
        '4682B4': 'стальной синий',
        '708090': 'сланцево-серый',
        
        # Голубые и бирюзовые
        '00FFFF': 'голубой',
        '40E0D0': 'бирюзовый',
        '00CED1': 'темно-бирюзовый',
        '48D1CC': 'средне-бирюзовый',
        '20B2AA': 'светло-морской',
        
        # Фиолетовые
        '800080': 'фиолетовый',
        '4B0082': 'индиго',
        '9400D3': 'фиолетовый',
        '9932CC': 'темно-фиолетовый',
        'BA55D3': 'средне-фиолетовый',
        'DA70D6': 'орхидея',
        'EE82EE': 'фиолетовый',
        'DDA0DD': 'сливовый',
        'D8BFD8': 'чертополох',
        
        # Коричневые
        'A52A2A': 'коричневый',
        '8B4513': 'седло-коричневый',
        'CD853F': 'персиковый',
        'DEB887': 'беж',
        'F5DEB3': 'пшеничный',
        'D2B48C': 'загар',
        'BC8F8F': 'розово-коричневый',
        '800000': 'темно-коричневый',
        '654321': 'темно-коричневый',
    }
    
    # Проверяем точное совпадение
    if hex_color in color_map:
        return color_map[hex_color]
    
    # Если нет точного совпадения, пытаемся определить приблизительно
    if len(hex_color) == 6:
        r = int(hex_color[0:2], 16)
        g = int(hex_color[2:4], 16)
        b = int(hex_color[4:6], 16)
        
        # Определяем по RGB значениям
        max_val = max(r, g, b)
        min_val = min(r, g, b)
        diff = max_val - min_val
        
        # Черный/серый
        if max_val < 50:
            return 'черный'
        if max_val < 128:
            return 'темно-серый'
        if diff < 30:
            if max_val > 200:
                return 'светло-серый'
            return 'серый'
        
        # Определяем основной цвет
        if r > g and r > b:
            if r > 200 and g < 100 and b < 100:
                return 'красный'
            elif r > 150:
                return 'оранжево-красный'
            return 'красно-коричневый'
        elif g > r and g > b:
            if g > 200 and r < 100 and b < 100:
                return 'зеленый'
            elif g > 150:
                return 'зелено-желтый'
            return 'темно-зеленый'
        elif b > r and b > g:
            if b > 200 and r < 100 and g < 100:
                return 'синий'
            elif b > 150:
                return 'голубой'
            return 'темно-синий'
        elif r > 150 and g > 150 and b < 100:
            return 'желтый'
        elif r > 150 and b > 150 and g < 100:
            return 'фиолетовый'
    
    # Если не удалось определить, возвращаем как есть (может быть уже название)
    return hex_color


def format_colors(colors):
    """
    Форматирует список цветов, конвертируя HEX-коды в названия
    
    Args:
        colors (list): Список цветов (могут быть HEX-коды или названия)
        
    Returns:
        str: Отформатированная строка с названиями цветов
    """
    if not colors:
        return ''
    
    color_names = []
    for color in colors:
        # Проверяем, является ли это HEX-кодом
        if isinstance(color, str) and re.match(r'^#?[0-9A-Fa-f]{6}$', color):
            color_names.append(hex_to_color_name(color))
        else:
            # Если это уже название, используем как есть
            color_names.append(str(color))
    
    return ', '.join(color_names)


def get_db_connection():
    """Подключение к PostgreSQL базе данных"""
    database_url = os.getenv('DATABASE_URL')
    
    if database_url:
        # Проверка на удаленную БД (Neon, AWS)
        if 'neon.tech' in database_url or 'amazonaws.com' in database_url:
            if 'sslmode=' not in database_url:
                database_url = database_url + ('&' if '?' in database_url else '?') + 'sslmode=require'
        conn = psycopg2.connect(database_url, cursor_factory=RealDictCursor)
    else:
        # Локальное подключение
        conn = psycopg2.connect(
            host=os.getenv('PGHOST', 'localhost'),
            port=os.getenv('PGPORT', '5432'),
            user=os.getenv('PGUSER', 'postgres'),
            password=os.getenv('PGPASSWORD', ''),
            database=os.getenv('PGDATABASE', 'shop_db'),
            cursor_factory=RealDictCursor
        )
    return conn


def get_all_products_info():
    """Получить информацию о всех товарах в наличии (Raw Data)"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('''
            SELECT p.id, p.name, p.description, p.price, p.colors, p.category_id, c.name as category_name
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE EXISTS (SELECT 1 FROM product_inventory pi WHERE pi.product_id = p.id AND pi.quantity > 0)
            ORDER BY c.name, p.name
        ''')
        products = cur.fetchall()
        for p in products:
            cur.execute('SELECT color, attribute1_value, attribute2_value, quantity FROM product_inventory WHERE product_id = %s AND quantity > 0', (p['id'],))
            p['inventory'] = cur.fetchall()
        cur.close()
        conn.close()
        return products
    except Exception as e:
        print(f"Error fetching products: {e}")
        return []


def get_catalog_titles():
    """
    Получить только названия и ID всех товаров для анализа AI
    """
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT id, name FROM products ORDER BY name")
        titles = cur.fetchall()
        cur.close()
        conn.close()
        return titles
    except Exception as e:
        print(f"❌ Ошибка получения каталога: {e}")
        return []


def search_products(query, include_out_of_stock=False):
    """Поиск товаров по ключевым словам (Clean Logic)"""
    try:
        norm_query = query.lower().strip()
        if norm_query in _product_search_cache:
            cache_data = _product_search_cache[norm_query]
            if datetime.now() < cache_data['expires']:
                return cache_data['products']

        conn = get_db_connection()
        cur = conn.cursor()

        # Очистка запроса
        clean_query = re.sub(r'[!?.,;:]', '', norm_query)
        stop_words = {'есть', 'ли', 'у', 'вас', 'цена', 'сколько', 'стоит', 'покажи', 'найди', 'хочу', 'купить', 'в наличии'}
        words = [w for w in clean_query.split() if w not in stop_words and len(w) > 2]
        
        if not words: words = [norm_query]

        inventory_clause = "EXISTS (SELECT 1 FROM product_inventory pi WHERE pi.product_id = p.id AND pi.quantity > 0)" if not include_out_of_stock else "1=1"
        
        conditions = []
        params = []
        for word in words:
            conditions.append("(LOWER(p.name) LIKE %s OR LOWER(p.description) LIKE %s OR LOWER(c.name) LIKE %s)")
            p = f'%{word}%'
            params.extend([p, p, p])

        sql = f'''
            SELECT p.id, p.name, p.price, p.description, c.name as category_name,
                   (CASE WHEN LOWER(p.name) LIKE %s THEN 2 ELSE 1 END) as rank
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE {inventory_clause} AND ({" OR ".join(conditions)})
            ORDER BY rank DESC, p.name ASC
            LIMIT 10
        '''
        # Добавляем первый параметр для ранжирования (по первому слову)
        first_word = f'%{words[0]}%'
        cur.execute(sql, (first_word,) + tuple(params))
        products = cur.fetchall()

        for p in products:
            cur.execute('SELECT color, attribute1_value, attribute2_value, quantity FROM product_inventory WHERE product_id = %s', (p['id'],))
            p['inventory'] = cur.fetchall()

        _product_search_cache[norm_query] = {'products': products, 'expires': datetime.now() + _cache_ttl}
        cur.close()
        conn.close()
        return products
    except Exception:
        return []


def get_product_details(product_id):
    """
    Получить детальную информацию о товаре
    
    Args:
        product_id (str): ID товара
        
    Returns:
        dict: Информация о товаре или None
    """
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        cur.execute('''
            SELECT 
                p.id,
                p.name,
                p.description,
                p.price,
                p.colors,
                p.attributes,
                p.category_id,
                c.name as category_name
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE p.id = %s
        ''', (product_id,))
        
        product = cur.fetchone()
        
        if product:
            # Получаем наличие
            cur.execute('''
                SELECT color, attribute1_value, attribute2_value, quantity
                FROM product_inventory
                WHERE product_id = %s
            ''', (product_id,))
            product['inventory'] = cur.fetchall()
        
        cur.close()
        conn.close()
        
        return product
    except Exception as e:
        print(f"❌ Ошибка получения товара: {e}")
        return None


def format_products_for_ai(products):
    """Компактный формат данных для AI (Pure Data)"""
    if not products: return "DATA_EMPTY: No items found."
    out = []
    for p in products:
        item = {
            "id": p['id'],
            "name": p['name'],
            "price": p['price'],
            "cat": p.get('category_name'),
            "stock": []
        }
        for inv in p.get('inventory', []):
            if inv['quantity'] > 0:
                color = hex_to_color_name(inv['color']) if '#' in str(inv['color']) or len(str(inv['color'])) == 6 else inv['color']
                # Скрываем точное количество от ИИ
                item["stock"].append(f"{color}/{inv['attribute1_value']}:✅")
        out.append(item)
    return json.dumps(out, ensure_ascii=False)



def get_categories():
    """Получить список всех категорий"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute('SELECT id, name FROM categories ORDER BY sort_order, name')
        categories = cur.fetchall()
        
        cur.close()
        conn.close()
        
        return categories
    except Exception as e:
        print(f"❌ Ошибка получения категорий: {e}")
        return []


def get_order_status(order_id, internal_raw=True, detailed=False):
    """Получение данных заказа (Raw Data Priority or Pretty UI)"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT id, status, total, created_at, customer_name FROM orders WHERE id::text ILIKE %s", (f'{order_id}%',))
        order_data = cur.fetchone()
        if not order_data: return "Заказ не найден."
        
        cur.execute("SELECT name, quantity, price, selected_color, selected_attributes FROM order_items WHERE order_id = %s", (order_data['id'],))
        order_data['items'] = cur.fetchall()
        cur.close()
        conn.close()
        
        if internal_raw:
            return json.dumps(order_data, default=str, ensure_ascii=False)
        
        if detailed:
            # Формируем красивый текст для пользователя
            date_str = order_data['created_at'].strftime("%d.%m.%Y %H:%M") if order_data['created_at'] else "Неизвестно"
            res = f"📦 <b>Заказ #{str(order_data['id'])[:8]}</b>\n"
            res += f"📅 <b>Дата:</b> {date_str}\n"
            res += f"📊 <b>Статус:</b> {order_data['status']}\n"
            res += f"💰 <b>Сумма:</b> {order_data['total']} сум\n\n"
            res += "<b>Товары:</b>\n"
            for item in order_data['items']:
                color = f" ({item['selected_color']})" if item['selected_color'] else ""
                res += f"• {item['name']}{color} x{item['quantity']} — {item['price']} сум\n"
            return res
            
        return order_data
    except Exception as e:
        return f"Ошибка при получении заказа: {e}"
def get_pretty_product_info(product_id):
    """
    Формирует красивый HTML-текст о товаре для пользователя.
    Используется ботом для автоматической замены тега [ИНФО:id].
    """
    product = get_product_details(product_id)
    if not product:
        return "<i>Товар не найден.</i>"
    
    # Формируем текст
    price_text = f"{product['price']} сум"
    description = product.get('description')
    if not description or description == 'NULL_DATA':
        description = "<i>Описание этой модели сейчас готовится нашей командой Monvoir.</i>"
    
    res = f"🏷 <b>{product['name']}</b>\n"
    res += f"💰 <b>Цена:</b> {price_text}\n\n"
    res += f"📝 <b>Описание:</b>\n{description}\n\n"
    
    # Формируем матрицу размеров/цветов
    inventory = product.get('inventory', [])
    if inventory:
        res += "📏 <b>Доступные размеры:</b>\n"
        # Группируем по цветам для красоты
        color_groups = {}
        for item in inventory:
            color_raw = item.get('color')
            color = format_colors([color_raw]) if color_raw else "Стандарт"
            if color not in color_groups:
                color_groups[color] = []
            
            size = item.get('attribute1_value') or "Универсальный"
            qty = item.get('quantity', 0)
            if qty > 0:
                color_groups[color].append(f"<code>{size}</code>")
        
        for color, sizes in color_groups.items():
            if sizes:
                res += f"• {color}: {', '.join(sizes)}\n"
            else:
                res += f"• {color}: <i>ожидается поступление</i>\n"
    else:
        res += "📍 <i>Информации о наличии размеров пока нет.</i>"
    
    return res

# --- CORE AI FUNCTIONS (Requested) ---

def search(keywords):
    """Поиск всех подходящих товаров (включая под заказ). Возвращает JSON."""
    results = search_products(keywords, include_out_of_stock=True)
    clean_res = []
    for p in results:
        # Скрываем количество от ИИ
        inv_data = []
        for inv in p.get('inventory', []):
            if inv['quantity'] > 0:
                inv_data.append({
                    "color": hex_to_color_name(inv['color']) if '#' in str(inv['color']) else inv['color'],
                    "size": inv['attribute1_value'],
                    "available": True
                })
        
        clean_res.append({
            "id": p['id'],
            "name": p['name'].strip(), # Удаляем лишние пробелы сразу
            "price": p['price'],
            "inventory": inv_data
        })
    return json.dumps(clean_res, ensure_ascii=False)

def catalog():
    """Список всех товаров в формате JSON list"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT name, id FROM products ORDER BY name")
        products = cur.fetchall()
        cur.close()
        conn.close()
        
        return json.dumps([{"name": p['name'], "id": p['id']} for p in products], ensure_ascii=False)
    except Exception as e:
        return json.dumps({"error": str(e)})

def order(order_id):
    """Информация о заказе по ID"""
    data = get_order_status(order_id, internal_raw=True)
    return data if data else "Заказ не найден."

def info(product_id):
    """Детальная информация о товаре по ID"""
    product = get_product_details(product_id)
    if product:
        # Удаляем точное количество, оставляем только флаг наличия
        for inv in product.get('inventory', []):
            # Конвертируем HEX в название
            color_raw = inv.get('color')
            inv['color'] = hex_to_color_name(color_raw) if color_raw and '#' in str(color_raw) else color_raw
            inv['available'] = inv['quantity'] > 0
            del inv['quantity']
    return json.dumps(product, ensure_ascii=False, default=str)

def in_stock(start=0, stop=5):
    """Список товаров в наличии. Возвращает JSON."""
    try:
        # Принудительно приводим к int, если AI прислал строки
        start = int(start)
        stop = int(stop)
        
        conn = get_db_connection()
        cur = conn.cursor()
        
        limit = max(0, stop - start)
        offset = start
        
        cur.execute('''
            SELECT p.name, p.id, p.price, pi.color, pi.attribute1_value as size, pi.quantity
            FROM products p
            JOIN product_inventory pi ON p.id = pi.product_id
            WHERE pi.quantity > 0
            ORDER BY p.name
            LIMIT %s OFFSET %s
        ''', (limit, offset))
        
        items = cur.fetchall()
        cur.close()
        conn.close()
        
        if not items:
            return "[]"
            
        # Группируем по ID для компактности
        products = {}
        for item in items:
            pid = item['id']
            if pid not in products:
                products[pid] = {
                    "id": pid,
                    "name": item['name'],
                    "price": item['price'],
                    "inventory": [] # Используем 'inventory' везде
                }
            color_name = hex_to_color_name(item['color']) if '#' in str(item['color']) else item['color']
            products[pid]["inventory"].append({
                "color": color_name,
                "attribute1_value": item['size'],
                "available": True # Не даем цифры
            })
            
        return json.dumps(list(products.values()), ensure_ascii=False)
    except Exception as e:
        return json.dumps({"error": str(e)})
