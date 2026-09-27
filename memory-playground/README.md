# Memory Playground

A small standalone starting point for **Patchy's intelligence layer**, using **Mem0 OSS locally**. One textbox, Remember, Recall, and results. One fixed demo user. No Mem0 Platform account or Mem0 API key.

## Setup

Requirements: Node 22.13+, npm, and [uv](https://docs.astral.sh/uv/getting-started/installation/). uv manages the Python environment; Python 3.12 is recommended.

```sh
npm install
uv sync --project backend --python 3.12 --locked
npm run setup
npm run dev
```

Open **http://127.0.0.1:3000**. The single dev command starts the page and Python backend together. Ctrl+C stops both. The backend uses one worker because embedded Qdrant owns its storage directory.

`npm run setup` asks which embedding provider to use, then writes a private, Git-ignored `backend/.env`:

- **OpenAI cloud:** choose an embedding model and dimensions; enter the API key at the hidden terminal prompt. The suggested pair is `text-embedding-3-small` / `1536`. Storage stays local; memory text and search queries go to OpenAI for embedding.
- **Ollama local:** choose an embedding model, dimensions, and local Ollama URL. The suggested pair is `nomic-embed-text` / `768`. Install and start [Ollama](https://ollama.com), then run `ollama pull nomic-embed-text` (or your chosen model). No cloud API key is needed.

No provider is selected automatically. If you skip setup, the page opens and Remember/Recall explain that setup is required. Existing `backend/.env` files are preserved by the setup command; edit that file and restart to change settings. A manual template is available at `backend/.env.example`.

**Remember stores the text verbatim (`infer=False`).** Embeddings power Recall. This initial version makes no language-model inference calls. Mem0 requires an LLM object at initialization, so an unused Ollama client is configured; no language model needs to be downloaded or running. Extraction and generated answers can be added later.

## Persistence

- Qdrant vectors and memory payloads: `.data/mem0/<profile>/qdrant/`
- SQLite history: `.data/mem0/<profile>/history.sqlite3`
- Model identity: `.data/mem0/<profile>/profile.json`

Paths resolve from the project directory, not the shell's working directory. `MEMORY_DATA_DIR` can override the storage root. These are durable disk files, not browser storage or `/tmp` data. Refreshing the page, restarting the backend, or rebuilding the UI does not clear them. To back up memories, stop the app and copy `.data/mem0` (or your configured storage directory).

The profile is derived from the embedding provider, model, dimensions, and endpoint. Changing these selects a separate store so incompatible vectors are never mixed. Old stores stay intact; returning to the previous model settings restores access to those memories. Automatic re-embedding/migration is outside this small prototype.

## Try it

1. Remember: “We are building an intelligence layer for Patchy, starting small with Mem0.”
2. Refresh the page and Recall: “What are we building for Patchy?”
3. Stop and restart with `npm run dev`; Recall again.

The textbox and results reset on refresh. The memories stay in Mem0's on-disk storage.

## Architecture

Browser → same-origin UI API routes → loopback Python service → Mem0 OSS → local Qdrant and SQLite.

- `app/page.tsx`: the existing small page and loading, success, empty, and error states.
- `lib/memory.ts`: server-only proxy to `127.0.0.1:8000`.
- `backend/app.py`: local FastAPI endpoints and validation.
- `backend/service.py`: one Mem0 OSS instance and fixed user `patchy-intelligence-demo`.
- `backend/config.py`: model configuration and persistent storage.
- `backend/uv.lock`: pinned Python dependencies, including Mem0 OSS.

Both services bind to loopback. Keys stay in the Python environment; the browser never receives them. Mem0 telemetry is disabled. This is a local single-user prototype, not a multi-user server.

This revision runs locally. The earlier private hosted preview is still the old cloud-API version; it cannot access this computer's memory store. `.openai/hosting.json` retains its historical project association and is not used by the local runtime. No new deployment is required.

## Checks

```sh
npm test
npm run test:backend
npm run typecheck
npm run build
```

The persistence test uses real Mem0, Qdrant, and SQLite in **two separate Python processes**, with deterministic test embeddings and a fail-if-called LLM. It verifies restart persistence and user isolation without choosing a model provider or calling a cloud service. Other tests cover the proxy, setup errors, model profile separation, validation, and safe provider errors. Live semantic retrieval requires completing model setup.

For the local production build, run `npm run build` then `npm start`.

## Direction

Keep this as the first lightweight building block of Patchy's intelligence layer. The adapter can later sit behind a Patchy plugin. User identity, extraction, memory management, and richer reasoning can follow without expanding this prototype's interface.

References: [Mem0 OSS](https://docs.mem0.ai/open-source/overview), [Qdrant storage configuration](https://docs.mem0.ai/components/vectordbs/dbs/qdrant), [Ollama embeddings](https://docs.mem0.ai/components/embedders/models/ollama).
