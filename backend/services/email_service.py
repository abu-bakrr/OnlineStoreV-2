import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from ..database import get_smtp_config

def send_email(to_email, subject, html_content, text_content=None, config=None):
    """Send email via SMTP"""
    try:
        if config is None:
            config = get_smtp_config()
        
        if not config.get('host') or not config.get('user') or not config.get('password'):
            return False, "Missing SMTP configuration (host, user, or password)"
        
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = f"{config['from_name']} <{config['from_email'] or config['user']}>"
        msg['To'] = to_email
        
        if text_content:
            msg.attach(MIMEText(text_content, 'plain', 'utf-8'))
        msg.attach(MIMEText(html_content, 'html', 'utf-8'))
        
        if config['use_tls']:
            server = smtplib.SMTP(config['host'], config['port'])
            server.starttls()
        else:
            server = smtplib.SMTP_SSL(config['host'], config['port'])
        
        server.login(config['user'], config['password'])
        server.send_message(msg)
        server.quit()
        return True, None
    except Exception as e:
        print(f"❌ Email sending failed: {e}")
        return False, str(e)

def send_password_reset_email(email, token, site_url):
    """Send password reset email"""
    reset_link = f"{site_url}/reset-password?token={token}"
    
    html_content = f"""
    <html>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333;">Сброс пароля</h2>
        <p>Вы запросили сброс пароля. Нажмите на кнопку ниже, чтобы установить новый пароль:</p>
        <p style="text-align: center; margin: 30px 0;">
            <a href="{reset_link}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Сбросить пароль
            </a>
        </p>
        <p style="color: #666; font-size: 14px;">Ссылка действительна в течение 1 часа.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #999; font-size: 12px;">Или скопируйте эту ссылку: {reset_link}</p>
    </body>
    </html>
    """
    
    text_content = f"Сброс пароля\n\nВы запросили сброс пароля. Перейдите по ссылке ниже, чтобы установить новый пароль:\n\n{reset_link}"
    
    success, error = send_email(email, "Сброс пароля", html_content, text_content)
    return success
