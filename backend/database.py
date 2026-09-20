import os
import base64
import hashlib
import json
import uuid

DEMO_MODE = os.getenv('DEMO_MODE', 'false').lower() == 'true'

def get_encryption_key():
    key = os.getenv('SETTINGS_ENCRYPTION_KEY') or os.getenv('SECRET_KEY') or 'fallback-key'
    key_bytes = hashlib.sha256(key.encode()).digest()
    return base64.urlsafe_b64encode(key_bytes)

def encrypt_value(value):
    if not value: return None
    try:
        from cryptography.fernet import Fernet
        return Fernet(get_encryption_key()).encrypt(value.encode()).decode()
    except Exception: return value

def decrypt_value(encrypted_value):
    if not encrypted_value: return None
    try:
        from cryptography.fernet import Fernet
        return Fernet(get_encryption_key()).decrypt(encrypted_value.encode()).decode()
    except Exception: return None

if DEMO_MODE:
    import sqlite3
    DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'demo.sqlite3')

    class DictRow(dict): pass

    class SqliteCursor:
        def __init__(self, raw): self._raw = raw
        def execute(self, sql, params=None):
            sqlite_sql = sql.replace('%s', '?')
            self._raw.execute(sqlite_sql, params) if params else self._raw.execute(sqlite_sql)
        def fetchall(self):
            cols = [d[0] for d in self._raw.description or []]
            return [DictRow(zip(cols, row)) for row in self._raw.fetchall()]
        def fetchone(self):
            cols = [d[0] for d in self._raw.description or []]
            row = self._raw.fetchone()
            return DictRow(zip(cols, row)) if row else None
        def close(self): self._raw.close()

    class SqliteConn:
        def __init__(self, path):
            self._conn = sqlite3.connect(path, check_same_thread=False)
            self._conn.execute('PRAGMA journal_mode=WAL')
        def cursor(self): return SqliteCursor(self._conn.cursor())
        def commit(self): self._conn.commit()
        def close(self): self._conn.close()

    def get_db_connection(): return SqliteConn(DB_PATH)
else:
    import psycopg2
    from psycopg2.extras import RealDictCursor
    def get_db_connection():
        database_url = os.getenv('DATABASE_URL')
        if database_url:
            if 'neon.tech' in database_url or 'amazonaws.com' in database_url:
                if 'sslmode=' not in database_url:
                    database_url += ('&' if '?' in database_url else '?') + 'sslmode=require'
            return psycopg2.connect(database_url, cursor_factory=RealDictCursor)
        return psycopg2.connect(
            host=os.getenv('PGHOST', 'localhost'), port=os.getenv('PGPORT', '5432'),
            user=os.getenv('PGUSER'), password=os.getenv('PGPASSWORD'),
            database=os.getenv('PGDATABASE'), cursor_factory=RealDictCursor)

def init_db():
    conn = get_db_connection()
    cur = conn.cursor()
    if DEMO_MODE:
        stmts = [
            'CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, price INTEGER NOT NULL, old_price INTEGER, images TEXT NOT NULL DEFAULT "[]", category_id TEXT, colors TEXT, attributes TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)',
            'CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY, name TEXT NOT NULL, icon TEXT, sort_order INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP)',
            'CREATE TABLE IF NOT EXISTS product_inventory (id TEXT PRIMARY KEY, product_id TEXT, color TEXT, attribute1_value TEXT, attribute2_value TEXT, quantity INTEGER NOT NULL DEFAULT 0, backorder_lead_time_days INTEGER, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)',
            'CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT, password TEXT, telegram_id INTEGER UNIQUE, first_name TEXT, last_name TEXT, email TEXT UNIQUE, password_hash TEXT, phone TEXT, telegram_username TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, is_admin INTEGER DEFAULT 0, is_superadmin INTEGER DEFAULT 0)',
            'CREATE TABLE IF NOT EXISTS cart (id TEXT PRIMARY KEY, user_id TEXT, product_id TEXT, quantity INTEGER NOT NULL DEFAULT 1, selected_color TEXT, selected_attributes TEXT)',
            'CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, user_id TEXT, total INTEGER NOT NULL, status TEXT DEFAULT "pending", payment_method TEXT, payment_status TEXT DEFAULT "pending", delivery_address TEXT, customer_phone TEXT, customer_name TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)',
            'CREATE TABLE IF NOT EXISTS order_items (id TEXT PRIMARY KEY, order_id TEXT, product_id TEXT, name TEXT NOT NULL, price INTEGER NOT NULL, quantity INTEGER NOT NULL, selected_color TEXT, selected_attributes TEXT)',
            'CREATE TABLE IF NOT EXISTS platform_settings (key TEXT PRIMARY KEY, value TEXT, is_secret INTEGER DEFAULT 0, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)',
            'CREATE TABLE IF NOT EXISTS favorites (id TEXT PRIMARY KEY, user_id TEXT, product_id TEXT)',
            'CREATE TABLE IF NOT EXISTS promo_codes (id TEXT PRIMARY KEY, code TEXT UNIQUE NOT NULL, discount_type TEXT NOT NULL, discount_value INTEGER NOT NULL, min_order_amount INTEGER DEFAULT 0, usage_limit INTEGER, used_count INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1, once_per_user INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP)',
            'CREATE TABLE IF NOT EXISTS password_reset_tokens (id TEXT PRIMARY KEY, user_id TEXT, token TEXT UNIQUE NOT NULL, expires_at TEXT NOT NULL, used INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP)',
        ]
        for s in stmts:
            cur.execute(s)
        conn.commit()
        _seed_demo_data(conn)
    else:
        cur.execute('CREATE EXTENSION IF NOT EXISTS pgcrypto')
        cur.execute('CREATE TABLE IF NOT EXISTS products (id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, description TEXT, price INTEGER NOT NULL, old_price INTEGER, images TEXT[] NOT NULL, category_id TEXT, colors TEXT[], attributes JSONB, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)')
        cur.execute("""DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='colors') THEN ALTER TABLE products ADD COLUMN colors TEXT[]; END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='attributes') THEN ALTER TABLE products ADD COLUMN attributes JSONB; END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='old_price') THEN ALTER TABLE products ADD COLUMN old_price INTEGER; END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='created_at') THEN ALTER TABLE products ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP; END IF;
        END $$;""")
        cur.execute('CREATE TABLE IF NOT EXISTS users (id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(), username TEXT, password TEXT, telegram_id BIGINT UNIQUE, first_name TEXT, last_name TEXT, email TEXT UNIQUE, password_hash TEXT, phone TEXT, telegram_username TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, is_admin BOOLEAN DEFAULT FALSE, is_superadmin BOOLEAN DEFAULT FALSE)')
        cur.execute('CREATE TABLE IF NOT EXISTS password_reset_tokens (id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(), user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE, token VARCHAR(64) UNIQUE NOT NULL, expires_at TIMESTAMP NOT NULL, used BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)')
        cur.execute('CREATE TABLE IF NOT EXISTS categories (id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, icon TEXT, sort_order INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)')
        cur.execute('CREATE TABLE IF NOT EXISTS favorites (id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(), user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE, product_id VARCHAR REFERENCES products(id) ON DELETE CASCADE, UNIQUE(user_id, product_id))')
        cur.execute('CREATE TABLE IF NOT EXISTS cart (id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(), user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE, product_id VARCHAR REFERENCES products(id) ON DELETE CASCADE, quantity INTEGER NOT NULL DEFAULT 1, selected_color TEXT, selected_attributes JSONB)')
        cur.execute('CREATE TABLE IF NOT EXISTS orders (id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(), user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE, total INTEGER NOT NULL, status TEXT DEFAULT \'pending\', payment_method TEXT, payment_status TEXT DEFAULT \'pending\', payment_id TEXT, delivery_address TEXT, delivery_lat DOUBLE PRECISION, delivery_lng DOUBLE PRECISION, customer_phone TEXT, customer_name TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, has_backorder BOOLEAN DEFAULT FALSE, backorder_delivery_date TIMESTAMP, estimated_delivery_days INTEGER, payment_receipt_url TEXT)')
        cur.execute('CREATE TABLE IF NOT EXISTS order_items (id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(), order_id VARCHAR REFERENCES orders(id) ON DELETE CASCADE, product_id VARCHAR REFERENCES products(id) ON DELETE SET NULL, name TEXT NOT NULL, price INTEGER NOT NULL, quantity INTEGER NOT NULL, selected_color TEXT, selected_attributes JSONB, availability_status TEXT DEFAULT \'in_stock\', backorder_lead_time_days INTEGER)')
        cur.execute('CREATE TABLE IF NOT EXISTS platform_settings (key VARCHAR PRIMARY KEY, value TEXT, is_secret BOOLEAN DEFAULT FALSE, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)')
        cur.execute("""DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='platform_settings' AND column_name='is_secret') THEN ALTER TABLE platform_settings ADD COLUMN is_secret BOOLEAN DEFAULT FALSE; END IF; END $$;""")
        cur.execute('CREATE TABLE IF NOT EXISTS promo_codes (id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(), code TEXT UNIQUE NOT NULL, discount_type TEXT NOT NULL, discount_value INTEGER NOT NULL, min_order_amount INTEGER DEFAULT 0, usage_limit INTEGER, used_count INTEGER DEFAULT 0, is_active BOOLEAN DEFAULT TRUE, once_per_user BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)')
        cur.execute("""DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='promo_code') THEN ALTER TABLE orders ADD COLUMN promo_code TEXT; END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='discount_amount') THEN ALTER TABLE orders ADD COLUMN discount_amount INTEGER DEFAULT 0; END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='promo_codes' AND column_name='once_per_user') THEN ALTER TABLE promo_codes ADD COLUMN once_per_user BOOLEAN DEFAULT FALSE; END IF;
        END $$;""")
        cur.execute('CREATE TABLE IF NOT EXISTS product_inventory (id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(), product_id VARCHAR REFERENCES products(id) ON DELETE CASCADE, color TEXT, attribute1_value TEXT, attribute2_value TEXT, quantity INTEGER NOT NULL DEFAULT 0, backorder_lead_time_days INTEGER, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE(product_id, color, attribute1_value, attribute2_value))')
        conn.commit()
    cur.close()
    conn.close()

def _seed_demo_data(conn):
    cur = conn.cursor()
    cur.execute('SELECT COUNT(*) as cnt FROM products')
    row = cur.fetchone()
    if row and row['cnt'] > 0:
        cur.close()
        return
    cats = [('cat-1','Hoodies','🧥',1),('cat-2','T-Shirts','👕',2),('cat-3','Pants','👖',3),('cat-4','Accessories','🧢',4)]
    for c in cats:
        cur.execute('INSERT OR IGNORE INTO categories (id,name,icon,sort_order) VALUES (?,?,?,?)', c)
    products = [
        {'id':'prod-1','name':'DRIP OVERSIZED HOODIE','price':359000,'old_price':450000,'category_id':'cat-1','description':'Широкий оверсайз-худи в стиле streetwear. Плотный флис, вышитый логотип DRIP UZ.','images':'["https://images.unsplash.com/photo-1556821840-3a63f15732ce?w=800&q=80","https://images.unsplash.com/photo-1578768079052-aa76e52ff62e?w=800&q=80"]','colors':'["Black","White","Grey"]'},
        {'id':'prod-2','name':'CHROME LOGO TEE','price':189000,'old_price':None,'category_id':'cat-2','description':'Футболка из плотного хлопка 100% с хромированным принтом DRIP UZ.','images':'["https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=800&q=80","https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=800&q=80"]','colors':'["Black","White"]'},
        {'id':'prod-3','name':'CARGO BAGGY PANTS','price':429000,'old_price':520000,'category_id':'cat-3','description':'Карго-брюки в широком крое с множеством карманов. Y2K-эстетика.','images':'["https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=800&q=80","https://images.unsplash.com/photo-1598554747436-c9293d6a588f?w=800&q=80"]','colors':'["Black","Beige","Olive"]'},
        {'id':'prod-4','name':'DRIP SNAPBACK CAP','price':149000,'old_price':None,'category_id':'cat-4','description':'Кепка-снэпбэк с металлической пряжкой и вышивкой DRIP UZ.','images':'["https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=800&q=80","https://images.unsplash.com/photo-1521369909029-2afed882baee?w=800&q=80"]','colors':'["Black","White"]'},
        {'id':'prod-5','name':'STREETWEAR ZIP HOODIE','price':389000,'old_price':None,'category_id':'cat-1','description':'Худи на молнии с массивными карманами. Весенне-осенняя коллекция.','images':'["https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=800&q=80","https://images.unsplash.com/photo-1611312449408-fcece27cdbb7?w=800&q=80"]','colors':'["Black","Navy"]'},
        {'id':'prod-6','name':'REFLECTIVE LOGO TEE','price':219000,'old_price':260000,'category_id':'cat-2','description':'Футболка с рефлективным принтом — светится в темноте.','images':'["https://images.unsplash.com/photo-1586790170083-2f9ceadc732d?w=800&q=80","https://images.unsplash.com/photo-1503341504253-dff4815485f1?w=800&q=80"]','colors':'["Black","Grey"]'},
        {'id':'prod-7','name':'WIDE LEG TROUSERS','price':379000,'old_price':None,'category_id':'cat-3','description':'Широкие прямые брюки с высокой посадкой.','images':'["https://images.unsplash.com/photo-1594938298603-c8148c4b4471?w=800&q=80","https://images.unsplash.com/photo-1506629082955-511b1aa562c8?w=800&q=80"]','colors':'["Black","Cream"]'},
        {'id':'prod-8','name':'CHROME CHAIN BELT','price':99000,'old_price':None,'category_id':'cat-4','description':'Хромированная цепочка-пояс. Y2K-эссенция для любого аутфита.','images':'["https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=800&q=80","https://images.unsplash.com/photo-1622560480605-d83c853bc5c3?w=800&q=80"]','colors':'["Silver","Gold"]'},
    ]
    for p in products:
        cur.execute('INSERT OR IGNORE INTO products (id,name,price,old_price,images,category_id,description,colors) VALUES (?,?,?,?,?,?,?,?)',
            (p['id'],p['name'],p['price'],p.get('old_price'),p['images'],p['category_id'],p['description'],p['colors']))
        for color in json.loads(p['colors']):
            cur.execute('INSERT OR IGNORE INTO product_inventory (id,product_id,color,quantity) VALUES (?,?,?,?)',(str(uuid.uuid4()),p['id'],color,10))
    conn.commit()
    cur.close()
    print('✅ Demo data seeded!')

def get_platform_setting(key):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('SELECT value, is_secret FROM platform_settings WHERE key = %s', (key,))
        result = cur.fetchone()
        cur.close(); conn.close()
        if result:
            return decrypt_value(result['value']) if result['is_secret'] else result['value']
        return None
    except Exception as e:
        print(f"❌ Error getting platform setting '{key}': {e}")
        return None

def set_platform_setting(key, value, is_secret=False):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        stored_value = encrypt_value(value) if is_secret and value else value
        if DEMO_MODE:
            cur.execute('INSERT OR REPLACE INTO platform_settings (key,value,is_secret,updated_at) VALUES (?,?,?,CURRENT_TIMESTAMP)',(key,stored_value,1 if is_secret else 0))
        else:
            cur.execute('INSERT INTO platform_settings (key,value,is_secret,updated_at) VALUES (%s,%s,%s,CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value,is_secret=EXCLUDED.is_secret,updated_at=CURRENT_TIMESTAMP',(key,stored_value,is_secret))
        conn.commit(); cur.close(); conn.close()
        return True
    except Exception as e:
        print(f"❌ Error setting platform setting '{key}': {e}")
        return False

def get_cloudinary_config():
    return {'cloud_name': get_platform_setting('cloudinary_cloud_name') or os.getenv('CLOUDINARY_CLOUD_NAME'), 'api_key': get_platform_setting('cloudinary_api_key') or os.getenv('CLOUDINARY_API_KEY'), 'api_secret': get_platform_setting('cloudinary_api_secret') or os.getenv('CLOUDINARY_API_SECRET')}

def get_telegram_config():
    ne = get_platform_setting('telegram_notifications_enabled')
    return {'bot_token': get_platform_setting('telegram_bot_token') or os.getenv('TELEGRAM_BOT_TOKEN'), 'admin_chat_id': get_platform_setting('telegram_admin_chat_id') or os.getenv('TELEGRAM_ADMIN_CHAT_ID'), 'notifications_enabled': ne == 'true' if ne else False}

def get_payment_config(provider, include_env=True):
    if provider == 'click':
        db_e = get_platform_setting('click_enabled'); sk = get_platform_setting('click_secret_key') or ''
        return {'merchant_id': get_platform_setting('click_merchant_id') or '', 'service_id': get_platform_setting('click_service_id') or '', 'secret_key': sk, 'has_secret_key': bool(sk), 'enabled': db_e == 'true' if db_e else False}
    elif provider == 'payme':
        db_e = get_platform_setting('payme_enabled'); k = get_platform_setting('payme_key') or ''
        return {'merchant_id': get_platform_setting('payme_merchant_id') or '', 'key': k, 'has_key': bool(k), 'enabled': db_e == 'true' if db_e else False}
    elif provider == 'uzum':
        db_e = get_platform_setting('uzum_enabled'); sk = get_platform_setting('uzum_secret_key') or ''
        return {'merchant_id': get_platform_setting('uzum_merchant_id') or '', 'service_id': get_platform_setting('uzum_service_id') or '', 'secret_key': sk, 'has_secret_key': bool(sk), 'enabled': db_e == 'true' if db_e else False}
    elif provider == 'card_transfer':
        db_e = get_platform_setting('card_transfer_enabled')
        return {'card_number': get_platform_setting('card_transfer_card_number') or '', 'card_holder': get_platform_setting('card_transfer_card_holder') or '', 'bank_name': get_platform_setting('card_transfer_bank_name') or '', 'enabled': db_e == 'true' if db_e else False}
    return {}

def get_yandex_maps_config():
    return {'api_key': get_platform_setting('yandex_maps_api_key') or os.getenv('YANDEX_MAPS_API_KEY'), 'default_lat': get_platform_setting('yandex_maps_default_lat') or '41.311081', 'default_lng': get_platform_setting('yandex_maps_default_lng') or '69.240562', 'default_zoom': int(get_platform_setting('yandex_maps_default_zoom') or '12')}

def get_smtp_config():
    return {'host': get_platform_setting('smtp_host') or os.getenv('SMTP_HOST',''), 'port': int(get_platform_setting('smtp_port') or os.getenv('SMTP_PORT','587')), 'user': get_platform_setting('smtp_user') or os.getenv('SMTP_USER',''), 'password': get_platform_setting('smtp_password') or os.getenv('SMTP_PASSWORD',''), 'from_email': get_platform_setting('smtp_from_email') or os.getenv('SMTP_FROM_EMAIL',''), 'from_name': get_platform_setting('smtp_from_name') or os.getenv('SMTP_FROM_NAME','Магазин'), 'use_tls': (get_platform_setting('smtp_use_tls') or os.getenv('SMTP_USE_TLS','true')).lower() == 'true'}
