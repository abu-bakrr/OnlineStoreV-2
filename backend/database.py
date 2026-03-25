import os
import psycopg2
from psycopg2.extras import RealDictCursor
import base64
import hashlib
from cryptography.fernet import Fernet
from datetime import datetime, timedelta

# Encryption for sensitive settings
def get_encryption_key():
    key = os.environ.get("SETTINGS_ENCRYPTION_KEY")
    if not key:
        key = os.environ.get("SESSION_SECRET", "default-key-change-me")
    key_bytes = hashlib.sha256(key.encode()).digest()
    return base64.urlsafe_b64encode(key_bytes)

def encrypt_value(value):
    if not value:
        return None
    f = Fernet(get_encryption_key())
    return f.encrypt(value.encode()).decode()

def decrypt_value(encrypted_value):
    if not encrypted_value:
        return None
    try:
        f = Fernet(get_encryption_key())
        return f.decrypt(encrypted_value.encode()).decode()
    except Exception:
        return None

def get_db_connection():
    database_url = os.getenv('DATABASE_URL')
    if database_url:
        if 'neon.tech' in database_url or 'amazonaws.com' in database_url:
            if 'sslmode=' not in database_url:
                database_url = database_url + ('&' if '?' in database_url else '?') + 'sslmode=require'
        conn = psycopg2.connect(database_url, cursor_factory=RealDictCursor)
    else:
        conn = psycopg2.connect(
            host=os.getenv('PGHOST', 'localhost'),
            port=os.getenv('PGPORT', '5432'),
            user=os.getenv('PGUSER'),
            password=os.getenv('PGPASSWORD'),
            database=os.getenv('PGDATABASE'),
            cursor_factory=RealDictCursor
        )
    return conn

def init_db():
    conn = get_db_connection()
    cur = conn.cursor()
    # Enable pgcrypto extension
    cur.execute('CREATE EXTENSION IF NOT EXISTS pgcrypto')
    
    # Create products table
    cur.execute('''
        CREATE TABLE IF NOT EXISTS products (
            id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
            name TEXT NOT NULL,
            description TEXT,
            price INTEGER NOT NULL,
            old_price INTEGER,
            images TEXT[] NOT NULL,
            category_id TEXT,
            colors TEXT[],
            attributes JSONB,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # ... (rest of tables from app.py) ...
    # Note: To keep this concise for now, I'll include the full logic in the implementation
    # I'll paste the full init_db logic here to ensure it's functional.
    
    # Add new columns to existing products table if they don't exist
    cur.execute('''
        DO $$ 
        BEGIN 
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                          WHERE table_name='products' AND column_name='colors') THEN
                ALTER TABLE products ADD COLUMN colors TEXT[];
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                          WHERE table_name='products' AND column_name='attributes') THEN
                ALTER TABLE products ADD COLUMN attributes JSONB;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                          WHERE table_name='products' AND column_name='old_price') THEN
                ALTER TABLE products ADD COLUMN old_price INTEGER;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                          WHERE table_name='products' AND column_name='created_at') THEN
                ALTER TABLE products ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
            END IF;
        END $$;
    ''')
    
    # Create users table
    cur.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
            username TEXT,
            password TEXT,
            telegram_id BIGINT UNIQUE,
            first_name TEXT,
            last_name TEXT,
            email TEXT UNIQUE,
            password_hash TEXT,
            phone TEXT,
            telegram_username TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_admin BOOLEAN DEFAULT FALSE,
            is_superadmin BOOLEAN DEFAULT FALSE
        )
    ''')

    # Create password_reset_tokens table
    cur.execute('''
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
            id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE,
            token VARCHAR(64) UNIQUE NOT NULL,
            expires_at TIMESTAMP NOT NULL,
            used BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Create categories table
    cur.execute('''
        CREATE TABLE IF NOT EXISTS categories (
            id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
            name TEXT NOT NULL,
            icon TEXT,
            sort_order INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Create favorites table
    cur.execute('''
        CREATE TABLE IF NOT EXISTS favorites (
            id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE,
            product_id VARCHAR REFERENCES products(id) ON DELETE CASCADE,
            UNIQUE(user_id, product_id)
        )
    ''')
    
    # Create cart table
    cur.execute('''
        CREATE TABLE IF NOT EXISTS cart (
            id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE,
            product_id VARCHAR REFERENCES products(id) ON DELETE CASCADE,
            quantity INTEGER NOT NULL DEFAULT 1,
            selected_color TEXT,
            selected_attributes JSONB
        )
    ''')
    
    # Create orders table
    cur.execute('''
        CREATE TABLE IF NOT EXISTS orders (
            id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE,
            total INTEGER NOT NULL,
            status TEXT DEFAULT 'pending',
            payment_method TEXT,
            payment_status TEXT DEFAULT 'pending',
            payment_id TEXT,
            delivery_address TEXT,
            delivery_lat DOUBLE PRECISION,
            delivery_lng DOUBLE PRECISION,
            customer_phone TEXT,
            customer_name TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            has_backorder BOOLEAN DEFAULT FALSE,
            backorder_delivery_date TIMESTAMP,
            estimated_delivery_days INTEGER,
            payment_receipt_url TEXT
        )
    ''')
    
    # Create order_items table
    cur.execute('''
        CREATE TABLE IF NOT EXISTS order_items (
            id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
            order_id VARCHAR REFERENCES orders(id) ON DELETE CASCADE,
            product_id VARCHAR REFERENCES products(id) ON DELETE SET NULL,
            name TEXT NOT NULL,
            price INTEGER NOT NULL,
            quantity INTEGER NOT NULL,
            selected_color TEXT,
            selected_attributes JSONB,
            availability_status TEXT DEFAULT 'in_stock',
            backorder_lead_time_days INTEGER
        )
    ''')
    
    # Create platform_settings table
    cur.execute('''
        CREATE TABLE IF NOT EXISTS platform_settings (
            key VARCHAR PRIMARY KEY,
            value TEXT,
            is_secret BOOLEAN DEFAULT FALSE,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Create promo_codes table
    cur.execute('''
        CREATE TABLE IF NOT EXISTS promo_codes (
            id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
            code TEXT UNIQUE NOT NULL,
            discount_type TEXT NOT NULL, -- 'percentage' or 'fixed'
            discount_value INTEGER NOT NULL,
            min_order_amount INTEGER DEFAULT 0,
            usage_limit INTEGER,
            used_count INTEGER DEFAULT 0,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Add promo columns to orders if they don't exist
    cur.execute('''
        DO $$ 
        BEGIN 
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                          WHERE table_name='orders' AND column_name='promo_code') THEN
                ALTER TABLE orders ADD COLUMN promo_code TEXT;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                          WHERE table_name='orders' AND column_name='discount_amount') THEN
                ALTER TABLE orders ADD COLUMN discount_amount INTEGER DEFAULT 0;
            END IF;
        END $$;
    ''')
    
    # Create product_inventory table
    cur.execute('''
        CREATE TABLE IF NOT EXISTS product_inventory (
            id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
            product_id VARCHAR REFERENCES products(id) ON DELETE CASCADE,
            color TEXT,
            attribute1_value TEXT,
            attribute2_value TEXT,
            quantity INTEGER NOT NULL DEFAULT 0,
            backorder_lead_time_days INTEGER,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(product_id, color, attribute1_value, attribute2_value)
        )
    ''')
    
    conn.commit()
    cur.close()
    conn.close()

def get_platform_setting(key):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('SELECT value, is_secret FROM platform_settings WHERE key = %s', (key,))
        result = cur.fetchone()
        cur.close()
        conn.close()
        if result:
            if result['is_secret']:
                return decrypt_value(result['value'])
            return result['value']
        return None
    except Exception as e:
        print(f"❌ Error getting platform setting '{key}': {e}")
        return None

def set_platform_setting(key, value, is_secret=False):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        stored_value = encrypt_value(value) if is_secret and value else value
        cur.execute('''
            INSERT INTO platform_settings (key, value, is_secret, updated_at)
            VALUES (%s, %s, %s, CURRENT_TIMESTAMP)
            ON CONFLICT (key) DO UPDATE SET 
                value = EXCLUDED.value,
                is_secret = EXCLUDED.is_secret,
                updated_at = CURRENT_TIMESTAMP
        ''', (key, stored_value, is_secret))
        conn.commit()
        cur.close()
        conn.close()
        return True
    except Exception:
        return False

def get_cloudinary_config():
    cloud_name = get_platform_setting('cloudinary_cloud_name')
    api_key = get_platform_setting('cloudinary_api_key')
    api_secret = get_platform_setting('cloudinary_api_secret')
    
    if not cloud_name:
        cloud_name = os.getenv('CLOUDINARY_CLOUD_NAME')
    if not api_key:
        api_key = os.getenv('CLOUDINARY_API_KEY')
    if not api_secret:
        api_secret = os.getenv('CLOUDINARY_API_SECRET')
    
    return {
        'cloud_name': cloud_name,
        'api_key': api_key,
        'api_secret': api_secret
    }

def get_telegram_config():
    bot_token = get_platform_setting('telegram_bot_token') or os.getenv('TELEGRAM_BOT_TOKEN')
    admin_chat_id = get_platform_setting('telegram_admin_chat_id') or os.getenv('TELEGRAM_ADMIN_CHAT_ID')
    notifications_enabled = get_platform_setting('telegram_notifications_enabled')
    
    return {
        'bot_token': bot_token,
        'admin_chat_id': admin_chat_id,
        'notifications_enabled': notifications_enabled == 'true' if notifications_enabled else False
    }

def get_payment_config(provider, include_env=True):
    if provider == 'click':
        db_enabled = get_platform_setting('click_enabled')
        env_enabled = os.getenv('CLICK_MERCHANT_ID') and os.getenv('CLICK_SERVICE_ID') if include_env else False
        return {
            'merchant_id': get_platform_setting('click_merchant_id') or (os.getenv('CLICK_MERCHANT_ID') if include_env else '') or '',
            'service_id': get_platform_setting('click_service_id') or (os.getenv('CLICK_SERVICE_ID') if include_env else '') or '',
            'secret_key': get_platform_setting('click_secret_key') or (os.getenv('CLICK_SECRET_KEY') if include_env else '') or '',
            'enabled': db_enabled == 'true' if db_enabled else bool(env_enabled)
        }
    elif provider == 'payme':
        db_enabled = get_platform_setting('payme_enabled')
        env_enabled = os.getenv('PAYME_MERCHANT_ID') if include_env else False
        return {
            'merchant_id': get_platform_setting('payme_merchant_id') or (os.getenv('PAYME_MERCHANT_ID') if include_env else '') or '',
            'key': get_platform_setting('payme_key') or (os.getenv('PAYME_KEY') if include_env else '') or '',
            'enabled': db_enabled == 'true' if db_enabled else bool(env_enabled)
        }
    elif provider == 'uzum':
        db_enabled = get_platform_setting('uzum_enabled')
        env_enabled = os.getenv('UZUM_MERCHANT_ID') if include_env else False
        return {
            'merchant_id': get_platform_setting('uzum_merchant_id') or (os.getenv('UZUM_MERCHANT_ID') if include_env else '') or '',
            'service_id': get_platform_setting('uzum_service_id') or (os.getenv('UZUM_SERVICE_ID') if include_env else '') or '',
            'secret_key': get_platform_setting('uzum_secret_key') or (os.getenv('UZUM_SECRET_KEY') if include_env else '') or '',
            'enabled': db_enabled == 'true' if db_enabled else bool(env_enabled)
        }
    elif provider == 'card_transfer':
        db_enabled = get_platform_setting('card_transfer_enabled')
        return {
            'card_number': get_platform_setting('card_transfer_card_number') or '',
            'card_holder': get_platform_setting('card_transfer_card_holder') or '',
            'bank_name': get_platform_setting('card_transfer_bank_name') or '',
            'enabled': db_enabled == 'true' if db_enabled else False
        }
    return {}

def get_yandex_maps_config():
    api_key = get_platform_setting('yandex_maps_api_key') or os.getenv('YANDEX_MAPS_API_KEY')
    default_lat = get_platform_setting('yandex_maps_default_lat') or '41.311081'
    default_lng = get_platform_setting('yandex_maps_default_lng') or '69.240562'
    default_zoom = get_platform_setting('yandex_maps_default_zoom') or '12'
    
    return {
        'api_key': api_key,
        'default_lat': default_lat,
        'default_lng': default_lng,
        'default_zoom': int(default_zoom)
    }

def get_smtp_config():
    return {
        'host': get_platform_setting('smtp_host') or os.getenv('SMTP_HOST', ''),
        'port': int(get_platform_setting('smtp_port') or os.getenv('SMTP_PORT', '587')),
        'user': get_platform_setting('smtp_user') or os.getenv('SMTP_USER', ''),
        'password': get_platform_setting('smtp_password') or os.getenv('SMTP_PASSWORD', ''),
        'from_email': get_platform_setting('smtp_from_email') or os.getenv('SMTP_FROM_EMAIL', ''),
        'from_name': get_platform_setting('smtp_from_name') or os.getenv('SMTP_FROM_NAME', 'Магазин'),
        'use_tls': (get_platform_setting('smtp_use_tls') or os.getenv('SMTP_USE_TLS', 'true')).lower() == 'true'
    }
