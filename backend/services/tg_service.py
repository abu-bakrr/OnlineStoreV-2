import requests
import os
from datetime import datetime
from ..database import get_telegram_config
import json

def send_telegram_notification(order_data, order_items, site_url=None):
    """Send order notification to Telegram admin"""
    try:
        # Check tier
        try:
            current_dir = os.path.dirname(os.path.abspath(__file__))
            project_root = os.path.dirname(os.path.dirname(current_dir))
            config_path = os.path.join(project_root, 'config', 'settings.json')
            with open(config_path, 'r', encoding='utf-8') as f:
                config = json.load(f)
                if config.get('subscriptionTier', 'starter') == 'starter':
                    print("⚠️ Telegram notifications disabled on starter tier")
                    return False
        except Exception as e:
            print(f"Error checking tier: {e}")

        order_id = str(order_data.get('id', 'unknown'))
        order_id_short = order_id[:6]
        
        tg_config = get_telegram_config()
        if not tg_config.get('notifications_enabled'):
            return False
        
        bot_token = tg_config.get('bot_token')
        admin_chat_id = tg_config.get('admin_chat_id')
        
        if not bot_token or not admin_chat_id:
            return False
        
        total_items = sum(item['quantity'] for item in order_items)
        items_text = ""
        for item in order_items:
            item_total = item['price'] * item['quantity']
            items_text += f"• {item['name']}"
            
            details = []
            if item.get('selected_color'):
                details.append(item['selected_color'])
            
            # Format attributes like sizes
            attrs = item.get('selected_attributes')
            if attrs and isinstance(attrs, dict):
                for k, v in attrs.items():
                    details.append(f"{k}: {v}")
                    
            if details:
                items_text += f" ({', '.join(details)})"
                
            items_text += f"\n  {item['quantity']} шт × {item['price']:,} = <b>{item_total:,}</b> сум\n"
        
        payment_labels = {
            'click': '💳 Click',
            'payme': '💳 Payme',
            'uzum': '💳 Uzum Bank',
            'card_transfer': '💵 Перевод на карту'
        }
        payment_method = payment_labels.get(order_data.get('payment_method'), order_data.get('payment_method', 'Не указан'))
        
        created_at = order_data.get('created_at')
        if created_at:
            try:
                if isinstance(created_at, str):
                    dt = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                else:
                    dt = created_at
                date_str = dt.strftime('%d.%m.%Y %H:%M')
            except:
                date_str = 'Только что'
        else:
            date_str = 'Только что'
        
        customer_name = order_data.get('customer_name') or order_data.get('first_name') or 'Не указано'
        user_email = order_data.get('user_email')
        email_text = f"\n📧 <code>{user_email}</code>" if user_email else ""
        
        status_labels = {
            'new': 'Новый', 'confirmed': 'Подтверждён', 'pending': 'В ожидании',
            'reviewing': 'Рассматривается', 'awaiting_payment': 'Ожидает оплаты',
            'paid': 'Оплачен', 'processing': 'Собирается', 'shipped': 'В пути',
            'delivered': 'Доставлен', 'cancelled': 'Отменён'
        }
        order_status = status_labels.get(order_data.get('status', 'new'), order_data.get('status', 'Новый'))
        
        message = f"""🔔 <b>НОВЫЙ ЗАКАЗ #{order_id_short}</b>\n\n⏰ {date_str}\n📊 Статус: <b>{order_status}</b>\n\n━━━━━━━━━━━━━━━━━━\n\n👤 <b>{customer_name}</b>\n📞 <code>{order_data.get('customer_phone', 'Не указан')}</code>{email_text}\n📍 {order_data.get('delivery_address', 'Адрес не указан')}\n\n━━━━━━━━━━━━━━━━━━\n\n🛍 <b>Товары ({total_items} шт):</b>\n\n{items_text}━━━━━━━━━━━━━━━━━━\n\n{payment_method}\n\n💰 <b>ИТОГО: {order_data['total']:,} сум</b>\n"""
        
        if order_data.get('payment_receipt_url'):
            message += f"\n📸 <a href=\"{order_data['payment_receipt_url']}\">Чек оплаты прикреплен</a>"
        elif order_data.get('payment_method') == 'card_transfer':
            message += f"\n⏳ <b>Ожидает чека оплаты</b>"
        
        if site_url:
            admin_url = f"{site_url.rstrip('/')}/admin/orders"
            message += f"\n\n🔗 <a href=\"{admin_url}\">Открыть в админ-панели</a>"
        
        url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        payload = {
            'chat_id': admin_chat_id,
            'text': message,
            'parse_mode': 'HTML',
            'disable_web_page_preview': True
        }
        
        response = requests.post(url, json=payload, timeout=10)
        return response.status_code == 200
            
    except Exception as e:
        print(f"❌ Error sending Telegram notification: {str(e)}")
        return False
