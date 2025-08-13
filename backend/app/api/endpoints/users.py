from fastapi import APIRouter, HTTPException, Depends
from app.schemas.user import UserProfile, PointTransaction
from app.services.user_service import UserService
from app.core.dependencies import get_current_user

router = APIRouter()
user_service = UserService()

@router.get("/profile", response_model=UserProfile)
async def get_profile(current_user=Depends(get_current_user)):
    try:
        return await user_service.get_user_profile(current_user["id"])
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/transactions")
async def get_transactions(current_user=Depends(get_current_user)):
    try:
        return await user_service.get_point_transactions(current_user["id"])
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))