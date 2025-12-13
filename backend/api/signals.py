import threading
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from .models import Restaurant
from .services.geocode_service import geocode_address


def async_geocode_and_update(instance: Restaurant):
    """
    Chạy geocode ở THREAD RIÊNG để không chậm request.
    """
    address = instance.address
    name = instance.name

    result = geocode_address(address, name)

    if not result:
        print(f"[GEOCODE] ❌ Không tìm được toạ độ cho: {name} - {address}")
        return

    lat = result.get("lat")
    lng = result.get("lng")

    if lat and lng:
        Restaurant.objects.filter(id=instance.id).update(
            latitude=lat,
            longitude=lng
        )
        print(f"[GEOCODE] ✅ Cập nhật thành công toạ độ cho '{name}': {lat}, {lng}")
    else:
        print(f"[GEOCODE] ⚠️ Không có giá trị lat/lng hợp lệ.")


@receiver(post_save, sender=Restaurant)
def auto_geocode_on_create(sender, instance: Restaurant, created, **kwargs):
    """
    Chạy khi tạo nhà hàng mới.
    """
    if created:
        if not instance.latitude or not instance.longitude:
            print(f"[SIGNALS] ➕ Nhà hàng mới → Tự động geocode: {instance.name}")
            threading.Thread(target=async_geocode_and_update, args=(instance,)).start()


@receiver(pre_save, sender=Restaurant)
def auto_geocode_on_address_change(sender, instance: Restaurant, **kwargs):
    """
    Chạy khi cập nhật địa chỉ nhà hàng.
    """
    if not instance.id:
        return  # đang create => để post_save handle

    try:
        old = Restaurant.objects.get(id=instance.id)
    except Restaurant.DoesNotExist:
        return

    # Nếu địa chỉ thay đổi → phải geocode lại
    if old.address != instance.address:
        print(f"[SIGNALS] 🔄 Địa chỉ thay đổi → geocode lại: {instance.name}")
        instance.latitude = None
        instance.longitude = None
