from flask import Blueprint, request, jsonify
from ..services.cloud_service import upload_image_to_cloud
from ..utils.auth import require_admin, admin_required_response

upload_bp = Blueprint('upload', __name__)

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp', 'gif'}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@upload_bp.route('/upload', methods=['POST'])
def upload_file():
    if not require_admin(): return admin_required_response()
    
    file = request.files.get('file') or request.files.get('image')
    if not file or file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
        
    if not allowed_file(file.filename):
        return jsonify({'error': 'Недопустимый формат файла. Разрешены только JPG, PNG, WEBP, GIF'}), 400
        
    try:
        file_content = file.read()
        if len(file_content) > MAX_FILE_SIZE:
            return jsonify({'error': 'Файл слишком большой. Максимальный размер 10 МБ'}), 400
            
        result, error = upload_image_to_cloud(file_content)
        if error:
            return jsonify({'error': f'Failed to upload image: {error}'}), 500
            
        if not result or 'secure_url' not in result:
            return jsonify({'error': 'Failed to get secure URL from cloud'}), 500
            
        return jsonify({'secure_url': result['secure_url']})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@upload_bp.route('/upload/receipt', methods=['POST'])
def upload_receipt():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
        
    if not allowed_file(file.filename):
        return jsonify({'error': 'Недопустимый формат чека. Разрешены только JPG, PNG, WEBP, PDF'}), 400
        
    try:
        file_content = file.read()
        if len(file_content) > MAX_FILE_SIZE:
            return jsonify({'error': 'Файл чека слишком большой. Максимальный размер 10 МБ'}), 400
            
        result, error = upload_image_to_cloud(file_content, folder='receipts')
        if error:
            return jsonify({'error': f'Failed to upload receipt: {error}'}), 500
            
        if not result or 'secure_url' not in result:
            return jsonify({'error': 'Failed to get secure URL from cloud'}), 500
            
        return jsonify({'secure_url': result['secure_url']})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

