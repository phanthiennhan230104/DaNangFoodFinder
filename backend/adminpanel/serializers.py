from api.models import CustomUser, Profile, Role, Account
from rest_framework import serializers


class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = "__all__"


class CustomUserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False)
    role_id = serializers.PrimaryKeyRelatedField(
        queryset=Role.objects.all(),
        source="role"
    )


    class Meta:
        model = CustomUser
        fields = [
            "user_id",
            "email",
            "password",
            "is_email_verified",
            "role_id",
            "is_staff",
            "is_superuser",
        ]

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        role = validated_data.pop("role")
        
        user = CustomUser(**validated_data)
        user.role = role

        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()


        if role == 1:
            user.is_staff = True
            user.is_superuser = True
        else:
            user.is_staff = False
            user.is_superuser = False


        user.is_staff = validated_data.get("is_staff", user.is_staff)
        user.is_superuser = validated_data.get("is_superuser", user.is_superuser)

        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        role_id = validated_data.pop("role_id_write", None)

        if password:
            instance.set_password(password)

        if role_id:
            try:
                role = Role.objects.get(pk=role_id)
                instance.role = role

                if role_id == 1:
                    instance.is_staff = True
                    instance.is_superuser = True
                else:
                    instance.is_staff = False
                    instance.is_superuser = False
            except Role.DoesNotExist:
                raise serializers.ValidationError({"role_id": "Invalid role ID"})

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.save()
        return instance


class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = "__all__"


class AccountSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False)
    role_id = serializers.IntegerField(write_only=True, required=True)

    class Meta:
        model = CustomUser
        fields = [
            "user_id",
            "email",
            "password",
            "is_email_verified",
            "role_id",
            "is_staff",
            "is_superuser",
        ]

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        role_id = validated_data.pop("role_id")

        try:
            role = Role.objects.get(pk=role_id)
        except Role.DoesNotExist:
            raise serializers.ValidationError({"role_id": "Invalid role ID"})

        user = CustomUser(**validated_data)
        user.role = role

        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()


        if role_id == 1:
            user.is_staff = True
            user.is_superuser = True
        else:
            user.is_staff = False
            user.is_superuser = False


        user.is_staff = validated_data.get("is_staff", user.is_staff)
        user.is_superuser = validated_data.get("is_superuser", user.is_superuser)

        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        role_id = validated_data.pop("role_id", None)

        if password:
            instance.set_password(password)

        for attr, value in validated_data.items():
            if attr not in ["is_staff", "is_superuser"]:
                setattr(instance, attr, value)

        if role_id:
            try:
                role = Role.objects.get(pk=role_id)
                instance.role = role


                if role_id == 1:
                    instance.is_staff = True
                    instance.is_superuser = True
                else:
                    instance.is_staff = False
                    instance.is_superuser = False
            except Role.DoesNotExist:
                raise serializers.ValidationError({"role_id": "Invalid role ID"})


        if "is_staff" in validated_data:
            instance.is_staff = validated_data["is_staff"]
        if "is_superuser" in validated_data:
            instance.is_superuser = validated_data["is_superuser"]

        instance.save()
        return instance
