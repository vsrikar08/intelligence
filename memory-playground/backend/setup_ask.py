"""Add answer-model settings without changing the embedding or storage profile."""
import getpass
import os
from pathlib import Path
from dotenv import dotenv_values, set_key

path = Path(__file__).with_name('.env')
values = dotenv_values(path) if path.exists() else {}
if values.get('ASK_BASE_URL') or values.get('ASK_MODEL'):
    raise SystemExit('Answer settings already exist. Edit ASK_* in backend/.env; existing settings were preserved.')
print('Configure one answer model. Questions and retrieved notes are sent to this endpoint.')
print('Foundry: https://YOUR-RESOURCE.services.ai.azure.com/openai/v1/')
print('Ollama:  http://127.0.0.1:11434/v1/')
endpoint = input('API base URL (blank to configure later): ').strip()
if not endpoint:
    raise SystemExit('No answer settings changed.')
model = input('Model name (Foundry: your deployment name): ').strip()
if not model:
    raise SystemExit('A model/deployment name is required. No settings changed.')
key = getpass.getpass('API key (hidden; blank for local Ollama): ').strip()
if not path.exists():
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    os.close(fd)
for name, value in {'ASK_BASE_URL': endpoint, 'ASK_MODEL': model, 'ASK_API_KEY': key}.items():
    set_key(path, name, value)
print('Answer model saved. Restart with npm run dev. Memory and embedding settings are unchanged.')
