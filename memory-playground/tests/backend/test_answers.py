import json

import httpx
import pytest
from fastapi.testclient import TestClient

from answers import answer_question, complete
from app import create_app
from config import SetupRequired

NOTES = [{'id': 'onboarding', 'memory': 'I manage Acme onboarding.'}, {'id': 'security', 'memory': 'Alex handles security reviews.'}]


def test_answer_returns_only_cited_notes_and_keeps_data_out_of_system_prompt():
    def model(messages):
        assert messages[0]['role'] == 'system'
        assert 'untrusted' in messages[0]['content']
        data = json.loads(messages[1]['content'])
        assert data['saved_memories'] == NOTES
        return json.dumps({'answer': 'Alex handles security reviews. The notes don’t say whether Alex is assigned to Acme onboarding.', 'memory_ids': ['security'], 'insufficient': True})
    result = answer_question('Who can help with security on Acme?', NOTES, model)
    assert result['memories'] == [NOTES[1]]
    assert result['insufficient'] is True


def test_no_notes_does_not_call_model():
    def never(messages):
        raise AssertionError('No model call needed')
    result = answer_question('Who handles security?', [], never)
    assert result['insufficient'] is True
    assert result['memories'] == []


@pytest.mark.parametrize('result', [
    {'answer': 'Alex', 'memory_ids': ['invented'], 'insufficient': False},
    {'answer': 'Alex', 'memory_ids': [], 'insufficient': False},
    {'answer': 'Alex', 'memory_ids': ['security', 'security'], 'insufficient': False},
    {'answer': '', 'memory_ids': ['security'], 'insufficient': False},
    {'answer': 'Alex', 'memory_ids': ['security'], 'insufficient': 'false'},
])
def test_invalid_model_answers_are_rejected(result):
    with pytest.raises(ValueError):
        answer_question('Who?', NOTES, lambda messages: json.dumps(result))


def test_foundry_compatible_request_stays_on_backend(monkeypatch):
    monkeypatch.setenv('ASK_BASE_URL', 'https://demo.services.ai.azure.com/openai/v1/')
    monkeypatch.setenv('ASK_MODEL', 'my-deployment')
    monkeypatch.setenv('ASK_API_KEY', 'test-secret')
    def respond(request):
        assert str(request.url) == 'https://demo.services.ai.azure.com/openai/v1/chat/completions'
        assert request.headers['Authorization'] == 'Bearer test-secret'
        body = json.loads(request.content)
        assert body['model'] == 'my-deployment'
        assert 'tools' not in body
        return httpx.Response(200, json={'choices': [{'finish_reason': 'stop', 'message': {'content': 'answer'}}]})
    client = httpx.Client
    monkeypatch.setattr(httpx, 'Client', lambda **kwargs: client(transport=httpx.MockTransport(respond), **kwargs))
    assert complete([{'role': 'user', 'content': 'question'}]) == 'answer'


def test_missing_model_configuration_is_actionable(monkeypatch):
    monkeypatch.delenv('ASK_BASE_URL', raising=False)
    monkeypatch.delenv('ASK_MODEL', raising=False)
    with pytest.raises(SetupRequired, match='setup:ask'):
        complete([])


def test_ask_only_recalls_never_saves():
    class Service:
        def execute(self, action, text):
            assert action == 'recall'
            return NOTES
        def close(self):
            pass
    def answerer(question, memories):
        assert memories == NOTES
        return {'answer': 'Alex handles security reviews.', 'memories': [NOTES[1]], 'insufficient': False}
    with TestClient(create_app(Service(), answerer), base_url='http://127.0.0.1') as client:
        response = client.post('/api/ask', json={'text': 'Who handles security?'})
        assert response.status_code == 200
        assert response.json()['memories'] == [NOTES[1]]
        assert response.json()['answer'] == 'Alex handles security reviews.'


def test_ask_provider_errors_are_sanitized():
    class Service:
        def execute(self, action, text):
            return NOTES
        def close(self):
            pass
    def failure(*args):
        raise RuntimeError('secret-key-in-provider-error')
    with TestClient(create_app(Service(), failure), base_url='http://127.0.0.1') as client:
        response = client.post('/api/ask', json={'text': 'Who?'})
        assert response.status_code == 502
        assert 'secret-key' not in response.text


def test_model_setup_commands_preserve_each_others_settings(tmp_path):
    import shutil
    import subprocess
    import sys
    from pathlib import Path
    from dotenv import dotenv_values
    root = Path(__file__).resolve().parents[2]
    for filename in ('setup_ask.py', 'setup_models.py'):
        shutil.copy(root / 'backend' / filename, tmp_path / filename)
    subprocess.run([sys.executable, str(tmp_path / 'setup_ask.py')], input='http://127.0.0.1:11434/v1/\nlocal-chat\n\n', text=True, capture_output=True, check=True)
    subprocess.run([sys.executable, str(tmp_path / 'setup_models.py')], input='2\n\n\n\n', text=True, capture_output=True, check=True)
    settings = dotenv_values(tmp_path / '.env')
    assert settings['ASK_MODEL'] == 'local-chat'
    assert settings['MODEL_PROVIDER'] == 'ollama'
    assert settings['EMBEDDING_MODEL'] == 'nomic-embed-text'
