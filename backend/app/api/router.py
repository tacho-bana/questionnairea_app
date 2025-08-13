from fastapi import APIRouter
from app.api.endpoints import surveys, users, auth, analytics, lottery

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(surveys.router, prefix="/surveys", tags=["surveys"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
api_router.include_router(lottery.router, prefix="/lottery", tags=["lottery"])