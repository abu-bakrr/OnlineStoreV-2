from flask import Flask, Blueprint
from datetime import timedelta
import os
from .database import init_db
# from .database import init_db # This import will be moved inside create_app

def get_secure_secret_key():
    env_secret = os.getenv('SESSION_SECRET')
    if env_secret and env_secret != 'dev_key':
        return env_secret
    
    # Persistent random secret key stored securely on disk
    secret_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.secret_key')
    try:
        if os.path.exists(secret_file):
            with open(secret_file, 'r') as f:
                key = f.read().strip()
                if key:
                    return key
        
        import secrets
        new_key = secrets.token_hex(32)
        with open(secret_file, 'w') as f:
            f.write(new_key)
        try:
            os.chmod(secret_file, 0o600)
        except Exception:
            pass
        return new_key
    except Exception:
        import secrets
        return secrets.token_hex(32)

def create_app():
    app = Flask(__name__, static_folder='../dist/public', static_url_path='/static')
    app.secret_key = get_secure_secret_key()
    app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=30)
    app.config['SESSION_COOKIE_HTTPONLY'] = True
    app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
    
    from .database import init_db
    with app.app_context():
        init_db()
    
    from .routes.auth import auth_bp
    from .routes.products import products_bp
    from .routes.cart import cart_bp
    from .routes.orders import orders_bp
    from .routes.payments import payments_bp
    from .routes.admin import admin_bp
    
    from .routes.config import config_bp
    from .routes.upload import upload_bp
    from .routes.promo import promo_bp
    
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(products_bp, url_prefix='/api')
    app.register_blueprint(cart_bp, url_prefix='/api')
    app.register_blueprint(orders_bp, url_prefix='/api')
    app.register_blueprint(payments_bp, url_prefix='/api')
    app.register_blueprint(admin_bp, url_prefix='/api/admin')
    app.register_blueprint(config_bp, url_prefix='/api')
    app.register_blueprint(upload_bp, url_prefix='/api')
    app.register_blueprint(promo_bp, url_prefix='/api')
    
    # Serve config assets (logo, etc.)
    @app.route('/config/<path:filename>')
    def serve_config(filename):
        config_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'config')
        from flask import send_from_directory
        return send_from_directory(config_dir, filename)

    @app.after_request
    def set_security_headers(response):
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'SAMEORIGIN'
        response.headers['X-XSS-Protection'] = '1; mode=block'
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        response.headers['Permissions-Policy'] = 'geolocation=(), microphone=(), camera=()'
        return response

    return app

