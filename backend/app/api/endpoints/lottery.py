from fastapi import APIRouter, HTTPException, Depends
from app.services.lottery_service import LotteryService
from app.core.dependencies import get_current_user

router = APIRouter()
lottery_service = LotteryService()

@router.get("/events")
async def get_lottery_events():
    try:
        return await lottery_service.get_active_events()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/events/{event_id}/enter")
async def enter_lottery(
    event_id: str,
    current_user=Depends(get_current_user)
):
    try:
        return await lottery_service.enter_lottery(event_id, current_user["id"])
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))