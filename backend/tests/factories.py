import factory
from django.contrib.auth import get_user_model

User = get_user_model()


class UserFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = User
        skip_postgeneration_save = True

    email = factory.Sequence(lambda n: f"user{n}@example.com")
    username = factory.LazyAttribute(lambda o: o.email)
    role = User.Role.VIEWER
    is_active = True

    @factory.post_generation
    def password(self, create, extracted, **kwargs):
        raw = extracted or "password123!"
        self.set_password(raw)
        if create:
            self.save(update_fields=["password"])


class AdminFactory(UserFactory):
    role = User.Role.ADMIN
    email = factory.Sequence(lambda n: f"admin{n}@example.com")


class OwnerFactory(UserFactory):
    role = User.Role.OWNER
    email = factory.Sequence(lambda n: f"owner{n}@example.com")


class ViewerFactory(UserFactory):
    role = User.Role.VIEWER
    email = factory.Sequence(lambda n: f"viewer{n}@example.com")
