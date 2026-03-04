import os
import json
from flask import send_from_directory, jsonify, request
from backend import create_app
from backend.database import get_db_connection

app = create_app()

@app.route('/assets/<path:filename>')
def serve_assets(filename):
    return send_from_directory(os.path.join(app.static_folder, 'assets'), filename)

@app.route('/sitemap.xml')
def sitemap():
    # Load site URL from config
    current_dir = os.path.dirname(os.path.abspath(__file__))
    config_path = os.path.join(current_dir, 'config', 'settings.json')
    site_url = "https://milhive.shop" # Default fallback
    
    try:
        if os.path.exists(config_path):
            with open(config_path, 'r', encoding='utf-8') as f:
                config = json.load(f)
                site_url = config.get('seo', {}).get('siteUrl', site_url)
    except Exception as e:
        print(f"⚠️ Error loading siteUrl for sitemap: {e}")

    # Start XML structure with proper namespace
    xml = ['<?xml version="1.0" encoding="UTF-8"?>']
    xml.append('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    
    # Add home page
    xml.append('  <url>')
    xml.append(f'    <loc>{site_url}/</loc>')
    xml.append('    <changefreq>daily</changefreq>')
    xml.append('    <priority>1.0</priority>')
    xml.append('  </url>')
    
    # Fetch all products from database
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('SELECT id FROM products')
        rows = cur.fetchall()
        cur.close()
        conn.close()
        
        for row in rows:
            product_url = f"{site_url}/product/{row['id']}"
            xml.append('  <url>')
            xml.append(f'    <loc>{product_url}</loc>')
            xml.append('    <changefreq>weekly</changefreq>')
            xml.append('    <priority>0.8</priority>')
            xml.append('  </url>')
    except Exception as e:
        print(f"⚠️ Error fetching products for sitemap: {e}")
        
    xml.append('</urlset>')
    
    return "\n".join(xml), 200, {'Content-Type': 'application/xml'}

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_react(path):
    if path.startswith('api/'):
        return jsonify({'error': 'Not found'}), 404
    
    # Check if the requested file exists in static folder (like favicon.ico, etc.)
    full_path = os.path.join(app.static_folder, path)
    if path and os.path.exists(full_path) and os.path.isfile(full_path):
        return send_from_directory(app.static_folder, path)

    # Dynamic SEO placeholder replacement for index.html
    try:
        index_path = os.path.join(app.static_folder, 'index.html')
        if not os.path.exists(index_path):
            return send_from_directory(app.static_folder, 'index.html') # Let Flask handle error if not exists

        with open(index_path, 'r', encoding='utf-8') as f:
            html = f.read()

        # Load SEO data from config
        current_dir = os.path.dirname(os.path.abspath(__file__))
        config_path = os.path.join(current_dir, 'config', 'settings.json')
        
        seo_data = {
            'shopName': 'Milhive',
            'title': 'Milhive — Стильная одежда | Интернет-магазин',
            'description': 'Milhive — интернет-магазин стильной одежды в Узбекистане.',
            'keywords': 'одежда, Узбекистан, интернет-магазин, стиль',
            'siteUrl': 'https://milhive.shop',
            'language': 'ru'
        }

        if os.path.exists(config_path):
            try:
                with open(config_path, 'r', encoding='utf-8') as f:
                    config = json.load(f)
                    seo = config.get('seo', {})
                    seo_data['shopName'] = config.get('shopName', seo_data['shopName'])
                    seo_data['title'] = seo.get('title', seo_data['title'])
                    seo_data['description'] = seo.get('description', seo_data['description'])
                    seo_data['keywords'] = seo.get('keywords', seo_data['keywords'])
                    seo_data['siteUrl'] = seo.get('siteUrl', seo_data['siteUrl'])
                    seo_data['language'] = seo.get('language', seo_data['language'])
            except Exception as e:
                print(f"⚠️ Error parsing settings.json for SEO: {e}")

        # Derive locale values
        lang = seo_data['language']
        lang_upper = lang.upper()

        # Perform replacements
        replacements = {
            '{{SEO_TITLE}}': seo_data['title'],
            '{{SEO_DESCRIPTION}}': seo_data['description'],
            '{{SEO_KEYWORDS}}': seo_data['keywords'],
            '{{SEO_SITE_URL}}': seo_data['siteUrl'],
            '{{SHOP_NAME}}': seo_data['shopName'],
            '{{SEO_LANGUAGE}}': lang,
            '{{SEO_LANGUAGE_UPPER}}': lang_upper
        }

        for placeholder, value in replacements.items():
            html = html.replace(placeholder, str(value or ""))

        from flask import Response
        return Response(html, mimetype='text/html')

    except Exception as e:
        print(f"❌ Error during server-side SEO replacement: {e}")
        return send_from_directory(app.static_folder, 'index.html')

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
