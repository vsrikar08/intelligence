import json
import os
from pathlib import Path
import subprocess
import sys

from fastapi.testclient import TestClient
from app import create_app
from config import memory_config, SetupRequired

ROOT = Path(__file__).resolve().parents[2]


def test_real_mem0_survives_process_restart(tmp_path):
    env = {**os.environ, 'MODEL_PROVIDER': 'ollama', 'EMBEDDING_MODEL': 'offline-test', 'EMBEDDING_DIMS': '4', 'MEMORY_DATA_DIR': str(tmp_path)}
    def run(action):
        result = subprocess.run([sys.executable, str(ROOT / 'tests/backend/persistence_worker.py'), action], env=env, text=True, capture_output=True, check=True)
        return json.loads(result.stdout.strip().splitlines()[-1])
    saved = run('remember')
    recalled = run('recall')  # Completely new Python process; real persistent storage.
    assert saved[0]['memory'] == 'Patchy intelligence starts with Mem0.'
    assert recalled == saved
    assert list(tmp_path.glob('*/history.sqlite3'))
    assert list(tmp_path.glob('*/qdrant'))


def test_model_profiles_keep_incompatible_embeddings_separate(tmp_path, monkeypatch):
    for key, value in {'MODEL_PROVIDER': 'ollama', 'EMBEDDING_MODEL': 'model-a', 'EMBEDDING_DIMS': '768', 'MEMORY_DATA_DIR': str(tmp_path)}.items():
        monkeypatch.setenv(key, value)
    first = memory_config()
    monkeypatch.setenv('EMBEDDING_MODEL', 'model-b')
    second = memory_config()
    assert first['history_db_path'] != second['history_db_path']
    assert first['vector_store']['config']['on_disk'] is True
    monkeypatch.setenv('EMBEDDING_MODEL', 'model-a')
    assert memory_config()['history_db_path'] == first['history_db_path']


class FakeService:
    def __init__(self, error=None):
        self.calls = []
        self.error = error
    def execute(self, action, text):
        if self.error:
            raise self.error
        self.calls.append((action, text))
        return [{'id': '1', 'memory': text}]
    def close(self):
        pass


def test_api_validation_and_ui_contract():
    service = FakeService()
    with TestClient(create_app(service), base_url='http://127.0.0.1') as client:
        saved = client.post('/api/remember', json={'text': '  Patchy context  '})
        assert saved.status_code == 200
        assert saved.json()['memories'][0]['memory'] == 'Patchy context'
        assert service.calls == [('remember', 'Patchy context')]
        assert saved.headers['cache-control'] == 'no-store'
        for body in [{'text': ' '}, {'text': 'x' * 4001}, {'text': 3}, {'text': 'hello', 'user_id': 'other'}]:
            assert client.post('/api/remember', json=body).status_code == 400
        assert client.post('/api/recall', json={'text': 'hello'}, headers={'Origin': 'https://other.example'}).status_code == 403
        assert client.post('/api/remember', content='x', headers={'Content-Type': 'text/plain'}).status_code == 415
        assert client.post('/api/remember', content='x' * 24001, headers={'Content-Type': 'application/json'}).status_code == 413


def test_setup_and_provider_errors_are_safe():
    for error, status in [(SetupRequired('Run setup.'), 503), (RuntimeError('secret credential'), 502)]:
        with TestClient(create_app(FakeService(error)), base_url='http://127.0.0.1') as client:
            response = client.post('/api/recall', json={'text': 'Patchy'})
            assert response.status_code == status
            assert 'secret credential' not in response.text
