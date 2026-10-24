from fastapi import HTTPException


class NotConfigured(HTTPException):
    def __init__(self, name: str, env_var: str):
        super().__init__(status_code=503, detail=f"{name} is not configured: set {env_var} in backend/.env")
