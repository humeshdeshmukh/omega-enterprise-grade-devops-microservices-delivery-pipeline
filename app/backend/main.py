from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
import os
import google.generativeai as genai

app = FastAPI(title="Omega Microservice API")

# Enable CORS for local development (frontend running on custom port)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database setup
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@localhost/omega_db")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class Item(Base):
    __tablename__ = "items"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    description = Column(String, index=True)

# Create tables
Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Gemini Configurations
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite")

if GEMINI_API_KEY and not GEMINI_API_KEY.startswith("AIzaSyAYSreAB"): # If it is not the default mock key
    genai.configure(api_key=GEMINI_API_KEY)
else:
    # Use None to trigger Mock Demo Mode if no valid key is set
    GEMINI_API_KEY = None
    print("⚠️ WARNING: GEMINI_API_KEY is not set. AIOps features will run in Mock Demo Mode.")

class AnalyzeRequest(BaseModel):
    log_data: str
    context_type: str = "logs"  # "logs", "metrics", "terraform", "kubernetes"

@app.get("/")
def read_root():
    return {"message": "Welcome to the Omega Enterprise DevOps Microservice!"}

@app.get("/items/")
def read_items(db: Session = Depends(get_db)):
    return db.query(Item).all()

@app.post("/items/")
def create_item(name: str, description: str, db: Session = Depends(get_db)):
    db_item = Item(name=name, description=description)
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@app.post("/api/ai/analyze")
def analyze_data(request: AnalyzeRequest):
    if not GEMINI_API_KEY:
        # Provide a high-quality mock DevOps recommendation if key is missing/placeholder
        return {
            "analysis": f"""## ⚠️ AIOps Demo Mode (Gemini API Key Not Configured)

To enable live Gemini analysis, please populate the `GEMINI_API_KEY` in your `.env` file and restart.

Here is a mock AIOps recommendation for your **{request.context_type}**:
- **Detected Pattern**: Simulated container failure or deployment bottleneck in **{request.context_type}** data.
- **Root Cause**: Pod resource limits were exceeded, leading to an OOMKilled state, or Terraform IAM permissions are overly permissive.
- **Recommendation**: Set up your Google Gemini API Key in the `.env` file at the root.
- **Commands**: 
  ```bash
  echo "GEMINI_API_KEY=your_actual_key" >> .env
  ./start.sh
  ```
""",
            "model": f"{GEMINI_MODEL} (Mock Demo)"
        }

    try:
        model = genai.GenerativeModel(GEMINI_MODEL)
        
        # Crafting a detailed, high-fidelity prompt for DevOps-specific response
        prompt = f"""
You are "Omega-AIOps", an enterprise-grade AI Operations assistant for DevOps, cloud infrastructure, and CI/CD pipelines.
Analyze the following input:

Context Type: {request.context_type}
Input Data:
{request.log_data}

Please provide a structured, professional report using markdown formatting.
Ensure your response includes:
1. **Executive Summary**: A quick 1-2 sentence overview of the situation.
2. **Issue Identification**: What went wrong (error codes, tracebacks, misconfigurations).
3. **Root Cause Analysis (RCA)**: Explain why this occurred under the hood.
4. **Step-by-Step Resolution Plan**: Practical, copy-pasteable commands, scripts, yaml snippets, or Terraform code to fix the issue.
5. **Architectural Prevention**: Best practices (e.g. security policy, resource limits, monitoring alerts) to prevent this from recurring.

Format the output clearly and use visual callouts like markdown blockquotes or alerts (e.g. > [!NOTE] or > [!WARNING]) if relevant. Keep it technical, direct, and actionable.
"""
        response = model.generate_content(prompt)
        return {
            "analysis": response.text,
            "model": GEMINI_MODEL
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Gemini API Exception: {str(e)}"
        )
