import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.routers import carplan, integrations

app = FastAPI(title="HackTX 2026")

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(httpx.HTTPStatusError)
async def upstream_error(_: Request, exc: httpx.HTTPStatusError):
    # Surface third-party API errors (bad key, bad params) instead of a bare 500.
    return JSONResponse(
        status_code=502,
        content={"detail": f"Upstream {exc.response.status_code} from {exc.request.url.host}", "body": exc.response.text[:500]},
    )


@app.get("/health")
async def health():
    return {"ok": True}


app.include_router(integrations.router)
app.include_router(carplan.router)
