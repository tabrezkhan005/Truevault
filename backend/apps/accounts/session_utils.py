from django.contrib.sessions.models import Session
from django.utils import timezone


def flush_user_sessions(user) -> int:
    """
    Delete all non-expired sessions belonging to this user.

    WHY: deactivation must revoke access immediately; an old session cookie
    must not keep working after is_active=False.
    """
    deleted = 0
    user_key = str(user.id)
    for session in Session.objects.filter(expire_date__gte=timezone.now()):
        data = session.get_decoded()
        if data.get("_auth_user_id") == user_key:
            session.delete()
            deleted += 1
    return deleted
