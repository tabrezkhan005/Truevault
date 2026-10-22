from rest_framework.throttling import UserRateThrottle


class DownloadRateThrottle(UserRateThrottle):
    scope = "download"
