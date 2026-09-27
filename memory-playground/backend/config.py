"""Backend-only model configuration and stable, project-local storage paths."""
import hashlib
import json
import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / 'backend' / '.env')
os.environ['MEM0_TELEMETRY'] = 'false'
os.environ['MEM0_DIR'] = str(ROOT / '.data' / 'mem0-runtime')


class SetupRequired(Exception):
    pass


def memory_config() -> dict:
    provider = os.getenv('MODEL_PROVIDER', '').strip()
    if provider not in ('openai', 'ollama'):
        raise SetupRequired('Choose cloud or local models first: run npm run setup in the project folder.')
    if provider == 'openai' and not os.getenv('OPENAI_API_KEY', '').strip():
        raise SetupRequired('Add OPENAI_API_KEY to backend/.env, then restart the app.')
    model = os.getenv('EMBEDDING_MODEL', '').strip()
    try:
        dimensions = int(os.getenv('EMBEDDING_DIMS', '0'))
    except ValueError:
        dimensions = 0
    if not model or dimensions < 1:
        raise SetupRequired('Set EMBEDDING_MODEL and its EMBEDDING_DIMS in backend/.env, then restart.')
    endpoint = os.getenv('OLLAMA_BASE_URL', 'http://127.0.0.1:11434').rstrip('/') if provider == 'ollama' else 'https://api.openai.com/v1'
    identity = {'provider': provider, 'model': model, 'dimensions': dimensions, 'endpoint': endpoint}
    fingerprint = hashlib.sha256(json.dumps(identity, sort_keys=True).encode()).hexdigest()[:16]
    root = Path(os.getenv('MEMORY_DATA_DIR') or ROOT / '.data' / 'mem0').expanduser()
    if not root.is_absolute():
        root = ROOT / root
    folder = root / fingerprint
    folder.mkdir(parents=True, exist_ok=True)
    # A different embedding space gets a separate store; existing memories stay intact.
    (folder / 'profile.json').write_text(json.dumps(identity, indent=2) + '\n')
    embedding = {'model': model, 'embedding_dims': dimensions}
    if provider == 'ollama':
        embedding['ollama_base_url'] = endpoint
    else:
        embedding['api_key'] = os.environ['OPENAI_API_KEY']
    return {
        'embedder': {'provider': provider, 'config': embedding},
        # Mem0 initializes an LLM object even for infer=False. No LLM calls are made.
        'llm': {'provider': 'ollama', 'config': {'model': 'llama3.2', 'ollama_base_url': 'http://127.0.0.1:11434'}},
        'vector_store': {'provider': 'qdrant', 'config': {
            'collection_name': 'patchy_memories', 'path': str(folder / 'qdrant'),
            'embedding_model_dims': dimensions, 'on_disk': True,
        }},
        'history_db_path': str(folder / 'history.sqlite3'),
    }
