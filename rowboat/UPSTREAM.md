# Rowboat source provenance

- Upstream: https://github.com/rowboatlabs/rowboat
- Revision: `c38f69a0268711909ec53987e2d797804ea0dab8`
- Imported: 2026-09-27
- License: Apache-2.0; see [LICENSE](LICENSE). Existing notices are retained.

This directory is a source snapshot with local modifications for Patchy Intelligence:

- A local-only backend startup profile.
- A browser transport adapter for the existing React interface, including ChatGPT OAuth login.
- Patchy MCP tools and connection setup, with writes limited to the demo description.
- Correct reporting of MCP tool refusals, with focused regression tests.

The root `scripts/intelligence/` launchers run these independent workspaces.
Build and usage instructions live in [Development](../docs/DEVELOPMENT.md#local-intelligence).
Credentials, installed dependencies, generated builds and runtime data are not included.
