import logging
from typing import Optional
from fastapi import Security, HTTPException, status
from fastapi.security.api_key import APIKeyHeader
from app.config import settings

logger = logging.getLogger("store_intelligence.auth")

API_KEY_NAME = "X-API-Key"
api_key_header = APIKeyHeader(name=API_KEY_NAME, auto_error=False)

async def verify_api_key(
    api_key_header_value: Optional[str] = Security(api_key_header)
) -> Optional[str]:
    """Middleware dependency to check for valid header API Key."""
    # Bypassed in local development if AUTH_DISABLED is True
    if settings.AUTH_DISABLED:
        return "dev-user"

    if not api_key_header_value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="API Key missing. X-API-Key header required."
        )

    if api_key_header_value not in settings.api_key_list:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="API Key invalid. Access denied."
        )

    return api_key_header_value
