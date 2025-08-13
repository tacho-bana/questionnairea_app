from fastapi import APIRouter, HTTPException, status
from app.schemas.auth import UserLogin, UserRegister, UserResponse
from app.services.auth_service import AuthService

router = APIRouter()
auth_service = AuthService()

@router.post("/register", response_model=UserResponse)
async def register(user_data: UserRegister):
    try:
        result = await auth_service.register_user(user_data)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.post("/login", response_model=UserResponse)
async def login(user_data: UserLogin):
    try:
        result = await auth_service.login_user(user_data)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e)
        )