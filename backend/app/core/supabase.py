from supabase import create_client, Client
from app.core.config import settings

class SupabaseClient:
    _instance = None
    _client: Client = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if self._client is None:
            self._client = create_client(
                settings.SUPABASE_URL,
                settings.SUPABASE_SERVICE_ROLE_KEY
            )

    def get_client(self) -> Client:
        return self._client

# Global instance
supabase_client = SupabaseClient().get_client()