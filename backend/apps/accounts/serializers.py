from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from apps.accounts.email_norm import normalise_email
from apps.accounts.models import User


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)


class RegisterSerializer(serializers.Serializer):
    """Public signup for the challenge demo — judges pick a role."""

    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False, min_length=12)
    role = serializers.ChoiceField(choices=User.Role.choices)

    def validate_email(self, value):
        return normalise_email(value)

    def validate_password(self, value):
        try:
            validate_password(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages)) from exc
        return value


class MeSerializer(serializers.ModelSerializer):
    # role is read-only on /me — set only at register or by admin PATCH.
    role = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = ("id", "email", "role")
        read_only_fields = ("id", "email", "role")
