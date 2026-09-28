# Patchy connection for our local Rowboat service

Start and manage this integration from the repository root:

```sh
pnpm dev:intelligence
pnpm dev:intelligence status
pnpm dev:intelligence stop
```

See [Patchy's local intelligence guide](../../docs/DEVELOPMENT.md#local-intelligence)
for building the backend, its RPC helper, and the connector smoke check.

`demo/start.mjs --setup-only` is the connection setup helper used by that
launcher. It checks Patchy's CLI identity, creates or reuses the dedicated
`rowboat-demo` patch, and registers the `patchy` MCP connection in
`ROWBOAT_WORKDIR/config/mcp.json`. Credentials stay in Patchy's normal credential
resolution flow. The launcher supplies an isolated CLI state directory.

The four tools identify the connected user/company, list patches, inspect patch
metadata and resource definitions, and update only the demo patch's description.
They do not read page bodies or business rows, or change patch source code.
The smoke check restores the original description after its test write.

Our `ROWBOAT_LOCAL_ONLY=1` boot profile keeps the local memory and automation
services while skipping hosted connector startup and model metadata refreshes.
The backend exposes authenticated RPC on loopback. Run `pnpm dev:intelligence:web`
from Patchy to serve the existing React interface through its local browser adapter.
Model configuration is separate and is required before assistant inference.
