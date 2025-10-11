import random
import threading
from django.core.mail import get_connection, EmailMessage
from .models import EmailOTP

def generate_otp():
    return str(random.randint(100000, 999999))

email_connection = get_connection()

def async_send_mail(subject, message, recipient_email):
    email = EmailMessage(subject, message, None, [recipient_email], connection=email_connection)
    email.send(fail_silently=False)

def send_otp_email(user):
    otp_code = generate_otp()
    EmailOTP.objects.create(user=user, otp=otp_code)

    subject = "Mã OTP xác thực tài khoản"
    message = f"Xin chào {user.email},\n\nMã OTP của bạn là: {otp_code}\nCó hiệu lực trong 5 phút."

    threading.Thread(target=async_send_mail, args=(subject, message, user.email)).start()

    return otp_code
