"""Terminal-only setup; model credentials never enter the frontend."""
import getpass
import os
from pathlib import Path

path = Path(__file__).with_name('.env')
if path.exists():
    print('backend/.env already exists. Edit it to change models; existing settings were preserved.')
    raise SystemExit(0)
print('Choose embedding models. Memory storage stays on this computer in both modes.')
choice = input('1: OpenAI cloud (text sent to OpenAI)\n2: Ollama local\nChoice [1/2]: ').strip()
if choice not in ('1', '2'):
    raise SystemExit('No configuration written. Run setup again and choose 1 or 2.')
provider = 'openai' if choice == '1' else 'ollama'
default_model, default_dims = ('text-embedding-3-small', '1536') if choice == '1' else ('nomic-embed-text', '768')
model = input(f'Embedding model [{default_model}]: ').strip() or default_model
dims = input(f'Embedding dimensions [{default_dims}]: ').strip() or default_dims
if not dims.isdigit() or int(dims) < 1:
    raise SystemExit('Dimensions must be a positive integer. No configuration written.')
key = getpass.getpass('OpenAI API key (hidden; blank to set later): ').strip() if choice == '1' else ''
endpoint = (input('Ollama URL [http://127.0.0.1:11434]: ').strip() or 'http://127.0.0.1:11434') if choice == '2' else 'http://127.0.0.1:11434'
def quote(value):
    return "'" + value.replace('\\', '\\\\').replace("'", "\\'") + "'"
values = {'MODEL_PROVIDER': provider, 'EMBEDDING_MODEL': model, 'EMBEDDING_DIMS': dims, 'OPENAI_API_KEY': key, 'OLLAMA_BASE_URL': endpoint, 'MEMORY_DATA_DIR': '.data/mem0'}
fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(fd, 'w') as file:
    file.write('\n'.join(f'{k}={quote(v)}' for k, v in values.items()) + '\n')
print('Saved backend/.env. Start with npm run dev.')
if choice == '2':
    print(f'First start Ollama and pull your embedding model: ollama pull {model}')
print('Remember stores text verbatim; no language model download or extraction call is needed.')
