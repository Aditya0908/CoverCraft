import os
import sys
import json
import re
import tempfile
from typing import Optional, Dict

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from mangum import Mangum

# Allow importing job_assistant from parent directory
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from job_assistant import JobApplicationAssistant

app = FastAPI(title="Job Assistant API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

JSON_TEMPLATE = """
{
  "personal_info": { "full_name": "", "email": "", "phone": "", "location": "", "portfolio_url": "", "linkedin_url": "", "explicit_years_of_experience": "" },
  "professional_summary": "",
  "core_competencies": [ { "skill": "", "proficiency_level": "", "years_experience": 0 } ],
  "work_experience": [ { "company": "", "role": "", "duration": "", "industry": "", "responsibilities": [""], "achievements": [ { "description": "", "impact_metric": "", "tools_used": [""] } ] } ],
  "major_projects": [ { "name": "", "problem_statement": "", "solution_summary": "", "technologies": [""], "measurable_outcomes": "", "business_impact": "" } ],
  "education": [ { "degree": "", "institution": "", "year": "", "notable_coursework": [""] } ],
  "certifications": [""],
  "leadership_experience": [ { "role": "", "organization": "", "impact": "" } ],
  "awards": [""],
  "publication_or_research": [""],
  "role_alignment_notes": [""]
}
"""


def get_assistant():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured on the server.")
    return JobApplicationAssistant(api_key=api_key)


# ─── Request Models ────────────────────────────────────────────────────────────

class GenerateRequest(BaseModel):
    company: str
    role: str
    description: str
    candidate_profile: dict
    user_yoe: Optional[str] = "0"

class RefineRequest(BaseModel):
    current_letter: str
    instruction: str
    company: str
    role: str
    description: str
    candidate_profile: dict

class ExperienceCheckRequest(BaseModel):
    job_description: str
    user_yoe: str


# ─── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/upload-resume")
async def upload_resume(file: UploadFile = File(...)):
    """Accept a PDF or DOCX resume, parse it to structured JSON."""
    ext = file.filename.split(".")[-1].lower()
    if ext not in ("pdf", "docx"):
        raise HTTPException(status_code=400, detail="Only PDF and DOCX files are supported.")

    assistant = get_assistant()

    # Write to temp file so the existing extract_text_from_file works
    with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        raw_text = assistant.extract_text_from_file(tmp_path)
        profile = assistant.parse_resume_to_json(raw_text, JSON_TEMPLATE)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        os.unlink(tmp_path)

    return {"profile": profile}


@app.post("/api/experience-check")
def experience_check(req: ExperienceCheckRequest):
    assistant = get_assistant()
    try:
        result = assistant.check_experience_gap(req.job_description, req.user_yoe)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/generate")
def generate(req: GenerateRequest):
    assistant = get_assistant()
    job_details = {
        "company": req.company,
        "role": req.role,
        "description": req.description,
    }
    # Inject YoE into profile so the prompt picks it up correctly
    profile = req.candidate_profile
    if profile.get("personal_info") is not None:
        profile["personal_info"]["explicit_years_of_experience"] = req.user_yoe

    try:
        letter = assistant.generate_cover_letter(job_details, profile)
        return {"cover_letter": letter}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/refine")
def refine(req: RefineRequest):
    assistant = get_assistant()
    job_details = {
        "company": req.company,
        "role": req.role,
        "description": req.description,
    }
    try:
        refined = assistant.refine_cover_letter(
            req.current_letter,
            req.instruction,
            job_details,
            req.candidate_profile,
        )
        return {"cover_letter": refined}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Vercel / AWS Lambda handler
handler = Mangum(app, lifespan="off")
