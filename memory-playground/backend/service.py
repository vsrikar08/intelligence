"""One Mem0 OSS instance, one demo identity, disk-backed vectors and history."""
from threading import RLock

from config import memory_config

DEMO_USER_ID = 'patchy-intelligence-demo'


class MemoryService:
    def __init__(self, config_factory=memory_config):
        self.config_factory = config_factory
        self.memory = None
        self.lock = RLock()

    def execute(self, action: str, text: str) -> list[dict]:
        with self.lock:
            if self.memory is None:
                from mem0 import Memory
                self.memory = Memory.from_config(self.config_factory())
            if action == 'remember':
                result = self.memory.add(
                    [{'role': 'user', 'content': text}], user_id=DEMO_USER_ID,
                    infer=False, metadata={'source': 'patchy-memory-playground'},
                )
            else:
                result = self.memory.search(text, user_id=DEMO_USER_ID, limit=5)
            memories = []
            for item in result['results']:
                value = item.get('memory') or item.get('data', {}).get('memory')
                if not isinstance(value, str) or not isinstance(item.get('id'), str):
                    raise ValueError('Unexpected memory result')
                memories.append({'id': item['id'], 'memory': value})
            if action == 'remember' and not memories:
                raise ValueError('No memory saved')
            return memories

    def close(self):
        with self.lock:
            if self.memory:
                self.memory.vector_store.client.close()
                self.memory.db.close()
                self.memory = None
