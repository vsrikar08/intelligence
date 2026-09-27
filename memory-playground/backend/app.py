from contextlib import asynccontextmanager
from typing import Literal

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, field_validator
from starlette.middleware.trustedhost import TrustedHostMiddleware

from config import SetupRequired
from answers import answer_question
from service import MemoryService


class MemoryInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    text: str = Field(min_length=1, max_length=4000)

    @field_validator('text')
    @classmethod
    def nonblank(cls, value):
        if not value.strip():
            raise ValueError('Text cannot be blank')
        return value.strip()


def create_app(service=None, answerer=answer_question):
    service = service or MemoryService()

    @asynccontextmanager
    async def lifespan(app):
        yield
        service.close()

    app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=['localhost', '127.0.0.1'])

    @app.middleware('http')
    async def guard(request: Request, call_next):
        # The browser talks to the UI's same-origin proxy, never directly here.
        if request.headers.get('origin'):
            return JSONResponse({'error': 'Use Memory Playground to access memories.'}, status_code=403)
        if request.method == 'POST':
            if 'application/json' not in request.headers.get('content-type', ''):
                return JSONResponse({'error': 'Send a JSON request.'}, status_code=415)
            size = 0
            async for chunk in request.stream():
                size += len(chunk)
                if size > 24000:
                    return JSONResponse({'error': 'Please keep your text under 4,000 characters.'}, status_code=413)
                # Cache the small body for FastAPI's subsequent validation.
                request._body = getattr(request, '_body', b'') + chunk
        response = await call_next(request)
        response.headers['Cache-Control'] = 'no-store'
        return response

    @app.exception_handler(RequestValidationError)
    async def validation_error(request, error):
        return JSONResponse({'error': 'Enter between 1 and 4,000 characters.'}, status_code=400)

    @app.get('/health')
    def health():
        return {'status': 'ok', 'storage': 'local'}

    @app.post('/api/{action}')
    def memory_action(action: Literal['remember', 'recall', 'ask'], body: MemoryInput):
        try:
            if action == 'ask':
                memories = service.execute('recall', body.text)
                result = answerer(body.text, memories)
                return {**result, 'message': 'The saved notes leave some gaps.' if result['insufficient'] else 'Based on your saved notes.'}
            memories = service.execute(action, body.text)
            message = ('Memory saved on this computer. It’ll be here when you come back.' if action == 'remember'
                       else 'Here’s what came to mind.' if memories
                       else 'No matching memories yet. Try another question, or remember something first.')
            return {'memories': memories, 'message': message}
        except SetupRequired as error:
            return JSONResponse({'error': str(error)}, status_code=503)
        except Exception:
            # Provider exceptions can include credentials, URLs or user text.
            if action == 'ask':
                return JSONResponse({'error': 'Could not produce an answer with valid memory references. Check the answer model settings or try again. Your memories are unchanged.'}, status_code=502)
            return JSONResponse({'error': 'Memory could not finish this request. Check your model settings, credentials or local model service. Try Recall before saving again.'}, status_code=502)

    return app


app = create_app()
