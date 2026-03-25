from flask import Flask, Blueprint
from datetime import timedelta
import os
from .database import init_db
# from .database import init_db # This import will be moved inside create_app

def create_app():
    app = Flask(__name__, static_folder='../dist/public', static_url_path='/static')
    app.secret_key = os.getenv('SESSION_SECRET', 'dev_key')
    app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=30)
    
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

    return app
