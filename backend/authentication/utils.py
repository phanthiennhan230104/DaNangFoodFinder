import random
import threading
import logging
from django.core.mail import get_connection, EmailMessage
from .models import EmailOTP # type: ignore



logger = logging.getLogger(__name__)

def generate_otp():
    return f"{random.randint(100000, 999999)}"


def send_email_async(subject, message, recipient_email):
    try:
        with get_connection() as connection:
            email = EmailMessage(
                subject=subject,
                body=message,
                from_email=None,
                to=[recipient_email],
                connection=connection
            )
            email.send(fail_silently=False)
        logger.info(f"Email OTP sent to {recipient_email}")
    except Exception as e:
        logger.error(f"Error sending OTP email to {recipient_email}: {e}")


def send_otp_email(user):
    otp_code = generate_otp()
    EmailOTP.objects.create(user=user, otp=otp_code)

    subject = "Xác thực tài khoản - Mã OTP"
    message = (
        f"Xin chào {user.email},\n\n"
        f"Mã OTP của bạn là: {otp_code}\n"
        "Mã này có hiệu lực trong 5 phút.\n\n"
        "Trân trọng,\nĐội ngũ DaNangFoodFinder."
    )

    threading.Thread(target=send_email_async, args=(subject, message, user.email)).start()

    return otp_code
