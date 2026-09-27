# Memory Playground

A small standalone starting point for **Patchy's intelligence layer**, using **Mem0 OSS locally**. One textbox, Remember, Recall, Ask, and results. One fixed demo user. No Mem0 Platform account or Mem0 API key.

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

No embedding provider is selected automatically. If you skip setup, the page opens and Remember/Recall explain that setup is required. Existing embedding settings are preserved by the setup command; edit that file and restart to change settings. Answer-model settings can be configured separately. A manual template is available at `backend/.env.example`.

**Remember stores the text verbatim (`infer=False`).** Embeddings power Recall. Remember and Recall make no language-model inference calls. Ask uses its own answer model. Mem0 requires an LLM object at initialization, so an unused Ollama client is configured; no language model needs to be downloaded or running. Automatic extraction is left for later.

## Ask: one answer from saved notes

Run `npm run setup:ask` and restart the app. This adds three backend-only settings without changing your embeddings or memory store:

```dotenv
ASK_BASE_URL=https://YOUR-RESOURCE.services.ai.azure.com/openai/v1/
ASK_MODEL=your-deployment-name
ASK_API_KEY=your-resource-key
```

Use your Foundry resource's **OpenAI-compatible v1 endpoint** and model deployment name. This small adapter calls `/chat/completions` once; it does not require Foundry Agent Service or an agent framework. See [Microsoft's endpoint guide](https://learn.microsoft.com/en-us/azure/ai-foundry/foundry-models/concepts/endpoints).

For local Ollama, use `http://127.0.0.1:11434/v1/`, a pulled chat model name, and a blank key. Other OpenAI-compatible v1 chat endpoints can use the same settings. Model selection remains a setup choice; no deployment is assumed or provisioned.

Ask retrieves up to five memories for the fixed demo user, asks the model to answer only from those notes, and displays **Memories used** underneath. For example, a note saying “Alex handles security reviews” can suggest Alex as a contact, but does not establish that Alex is assigned to Acme onboarding. The prompt asks the model to state missing information and conflicts. With no retrieved notes, the app returns a simple insufficient-context message without calling a model.

Only source IDs present in the retrieved notes are accepted; malformed output and invented source IDs produce an error. This validates reference identity, not the factual support for every sentence—the displayed notes let us inspect that. Saved notes are treated as untrusted content, not instructions. Questions and retrieved notes are sent to the configured answer provider; keys stay on the backend. Ask does not save the question or answer.

Both setup commands work in either order and preserve the other's settings.

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
- `backend/answers.py`: one grounded answer call and validation of cited memory IDs.
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

The persistence test uses real Mem0, Qdrant, and SQLite in **two separate Python processes**, with deterministic test embeddings and a fail-if-called LLM. It verifies restart persistence and user isolation without choosing a model provider or calling a cloud service. Other tests cover the proxy, setup errors, model profile separation, validation, safe provider errors, Ask without notes, unsupported source IDs, and the Foundry-compatible request contract. Live semantic retrieval and answer quality require completing model setup; no live Foundry deployment has been tested yet.

For the local production build, run `npm run build` then `npm start`.

## Direction

Keep this as the first lightweight building block of Patchy's intelligence layer. The adapter can later sit behind a Patchy plugin. User identity, extraction, memory management, and richer reasoning can follow without expanding this prototype's interface.

References: [Mem0 OSS](https://docs.mem0.ai/open-source/overview), [Qdrant storage configuration](https://docs.mem0.ai/components/vectordbs/dbs/qdrant), [Ollama embeddings](https://docs.mem0.ai/components/embedders/models/ollama).
