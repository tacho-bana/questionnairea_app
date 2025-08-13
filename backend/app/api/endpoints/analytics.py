from fastapi import APIRouter, HTTPException, Depends
from app.services.analytics_service import AnalyticsService
from app.core.dependencies import get_current_user

router = APIRouter()
analytics_service = AnalyticsService()

@router.get("/dashboard")
async def get_dashboard_data(current_user=Depends(get_current_user)):
    try:
        return await analytics_service.get_dashboard_data(current_user["id"])
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/survey/{survey_id}/visualization")
async def get_survey_visualization(
    survey_id: str,
    current_user=Depends(get_current_user)
):
    try:
        return await analytics_service.generate_survey_visualization(survey_id, current_user["id"])
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))