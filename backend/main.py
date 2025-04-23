from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import httpx
import os
from dotenv import load_dotenv
import logging

# Load environment variables from .env file
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(title="Mistral Chat API")

# Allow CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Get API key from environment
MISTRAL_API_KEY = os.environ.get("MISTRAL_API_KEY")
if not MISTRAL_API_KEY:
    logger.error("MISTRAL_API_KEY is not set in environment variables")
    raise ValueError("MISTRAL_API_KEY is not set in environment variables")

# Initialize HTTP client with timeout
client = httpx.AsyncClient(timeout=60.0)

@app.get("/")
async def root():
    """Health check endpoint"""
    return {"status": "online", "message": "Mistral Chat API is running"}

@app.post("/chat")
async def chat(request: Request):
    """Process chat messages and get responses from Mistral AI"""
    try:
        # Parse request data
        data = await request.json()
        user_message = data.get("message", "")
        
        if not user_message:
            return JSONResponse(
                status_code=400,
                content={"error": "Message cannot be empty"}
            )
            
        logger.info(f"Received message: {user_message[:50]}...")
        
        # Call Mistral API
        response = await client.post(
            "https://api.mistral.ai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {MISTRAL_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "mistral-medium",
                "messages": [{"role": "user", "content": user_message}],
                "temperature": 0.7,
                "max_tokens": 1000,
            },
        )
        
        # Handle response
        response.raise_for_status()
        api_response = response.json()
        
        # Extract the reply from the response
        reply = api_response.get("choices", [{}])[0].get("message", {}).get("content", "")
        
        if not reply:
            logger.warning(f"Empty reply from Mistral API: {api_response}")
            return JSONResponse(
                status_code=500,
                content={"error": "Received empty reply from Mistral"}
            )
            
        logger.info(f"Returning response of length: {len(reply)}")
        return {"reply": reply}
        
    except httpx.HTTPStatusError as exc:
        logger.error(f"API returned error: {exc.response.text}")
        return JSONResponse(
            status_code=exc.response.status_code,
            content={"error": f"API returned an error: {exc.response.text}"}
        )
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"error": f"An unexpected error occurred: {str(e)}"}
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)