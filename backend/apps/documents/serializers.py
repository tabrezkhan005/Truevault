from rest_framework import serializers

from apps.documents.models import Document, Grant


class DocumentSerializer(serializers.ModelSerializer):
    owner_id = serializers.UUIDField(source="owner.id", read_only=True)
    effective_level = serializers.SerializerMethodField()

    class Meta:
        model = Document
        fields = (
            "id",
            "name",
            "category",
            "content_type_detected",
            "size_bytes",
            "sha256",
            "created_at",
            "updated_at",
            "owner_id",
            "effective_level",
        )
        read_only_fields = fields

    def get_effective_level(self, obj):
        request = self.context.get("request")
        if request is None:
            return None
        from apps.documents.permissions import effective_level

        return effective_level(request.user, obj)


class DocumentListSerializer(serializers.ModelSerializer):
    owner_id = serializers.UUIDField(source="owner.id", read_only=True)

    class Meta:
        model = Document
        fields = (
            "id",
            "name",
            "category",
            "content_type_detected",
            "size_bytes",
            "sha256",
            "created_at",
            "updated_at",
            "owner_id",
        )
        read_only_fields = fields


class DocumentUploadSerializer(serializers.Serializer):
    file = serializers.FileField()
    name = serializers.CharField(required=False, allow_blank=True, max_length=120)
    category = serializers.CharField(required=False, allow_blank=True, max_length=64)
    # Intentionally not accepted: owner/role must never come from the client.


class DocumentMetadataPatchSerializer(serializers.Serializer):
    name = serializers.CharField(required=False, allow_blank=False, max_length=120)
    category = serializers.CharField(required=False, allow_blank=True, max_length=64)

    def validate(self, attrs):
        if not attrs:
            raise serializers.ValidationError("Provide name and/or category")
        return attrs


class DocumentContentPutSerializer(serializers.Serializer):
    file = serializers.FileField()


class GrantSerializer(serializers.ModelSerializer):
    user_id = serializers.UUIDField(source="user.id", read_only=True)
    user_email = serializers.EmailField(source="user.email", read_only=True)
    granted_by_id = serializers.UUIDField(source="granted_by.id", read_only=True)

    class Meta:
        model = Grant
        fields = (
            "id",
            "user_id",
            "user_email",
            "level",
            "granted_by_id",
            "created_at",
        )
        read_only_fields = fields


class GrantWriteSerializer(serializers.Serializer):
    user_id = serializers.UUIDField()
    level = serializers.ChoiceField(choices=Grant.Level.choices)
