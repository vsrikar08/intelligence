"""Real Mem0/Qdrant/SQLite; only the model boundary is replaced for offline tests."""
import json
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'backend'))
from config import memory_config
from service import MemoryService
from mem0.utils.factory import EmbedderFactory, LlmFactory

class OfflineEmbedding:
    def embed(self, text, memory_action=None):
        return [1.0, 0.0, 0.0, 0.0]
    def embed_batch(self, texts, memory_action=None):
        return [self.embed(text) for text in texts]
class NoInference:
    def generate_response(self, *args, **kwargs):
        raise AssertionError('Verbatim memory must not call an LLM')
EmbedderFactory.create = staticmethod(lambda *args, **kwargs: OfflineEmbedding())
LlmFactory.create = staticmethod(lambda *args, **kwargs: NoInference())
service = MemoryService()
try:
    result = service.execute(sys.argv[1], 'Patchy intelligence starts with Mem0.')
    if sys.argv[1] == 'remember':
        service.memory.add('Other user secret', user_id='someone-else', infer=False)
    print(json.dumps(result))
finally:
    service.close()
