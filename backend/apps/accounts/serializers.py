from rest_framework import serializers

from apps.accounts.models import User


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)


class MeSerializer(serializers.ModelSerializer):
    # role is read-only everywhere — never accept it from a request body.
    role = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = ("id", "email", "role")
        read_only_fields = ("id", "email", "role")
