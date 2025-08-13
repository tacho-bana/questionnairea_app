from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from app.schemas.survey import SurveyCreate, SurveyResponse, SurveyList
from app.services.survey_service import SurveyService
from app.core.dependencies import get_current_user

router = APIRouter()
survey_service = SurveyService()

@router.get("/", response_model=List[SurveyList])
async def get_surveys(
    category_id: Optional[int] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 20
):
    try:
        return await survey_service.get_surveys(category_id, search, skip, limit)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/", response_model=dict)
async def create_survey(
    survey_data: SurveyCreate,
    current_user=Depends(get_current_user)
):
    try:
        return await survey_service.create_survey(survey_data, current_user["id"])
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{survey_id}")
async def get_survey(survey_id: str):
    try:
        return await survey_service.get_survey_by_id(survey_id)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("/{survey_id}/responses")
async def submit_response(
    survey_id: str,
    response_data: dict,
    current_user=Depends(get_current_user)
):
    try:
        return await survey_service.submit_response(survey_id, response_data, current_user["id"])
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))