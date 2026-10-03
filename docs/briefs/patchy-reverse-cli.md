# Personal agents using Patchy: prototype brief

Discussion brief, 3 October 2026. This is a proposed prototype, not a description
of shipped agent access. Saved on the `patchy-reverse-cli` side branch at the
maintainer's request.

Source idea: [Let everyone's agent use the company's patches](https://post.patchyhq.com/d/b3qiwx7yzwo3).

## The product

Patchy already lets a builder agent create and publish a tool, then lets people
use its page. This project adds the other direction: a person's existing personal
agent reads and updates deployed company patches for them.

The person can talk to their agent in Slack or another interface. The agent may
run anywhere. Hermes is the first example client, not a product requirement.

Example: “We onboarded Xydc. Update the onboarding tracker.” The agent finds the
patch, reads its available operations, performs the permitted update, and returns
the actual result and a link. The page reflects the change, with attribution to
the person and their agent.

## Agreed behavior

- The person can name a patch. Otherwise the agent finds the relevant patch and
  asks for clarification when the choice is ambiguous.
- Each patch is authorized separately. A person can initiate that authorization
  through their agent.
- Only the owner commands their connected personal agent in the first version.
  Other people connect their own agents.
- The patch owner or a company admin selects one agent access mode per patch:
  **read only**, **raw table access**, or **declared actions**. There is no Off
  mode. The product does not restrict that choice to a particular patch category.
- **Read only** allows questions and data retrieval without writes. Reads preserve
  the person's data permissions: whole tables when allowed, permitted queries
  when the patch enforces restrictions.
- **Raw table access** allows direct row operations. It can bypass business rules
  implemented in handlers; choosing this mode is deliberate.
- **Declared actions** exposes named operations supplied by the patch author,
  with required inputs and the patch's rules. Reads can use declared queries.
- Existing authorization follows changes to the patch's access mode
  automatically, including expanded write access, without another consent step.
- Permissions and business approval workflows belong to Patchy Cloud and the
  patch. Agent calls reuse them; this project adds no separate approval hierarchy.
- Edits record the person and agent that performed them. “Signed” means
  authenticated attribution here, not a cryptographic signature system.
- Company memory/search is deferred.

## What already exists

The cloud has company member/admin roles, patch ownership, machine login and
revocation, patch discovery, tables, and tier 2 queries, mutations and actions.
Published handler descriptors contain names, kinds, input/output schemas and
declared error names. They do not yet include agent-facing descriptions or
exposure settings.

Existing patches demonstrate business permissions and approval. The Brightline
spend patch prevents self-approval, requires an admin for expenses of $2,500 or
more, and makes marking an expense paid admin-only. Its sales patch limits
closing, reopening and reassigning deals to their owner or an admin. These rules
live in the same handlers the manual page calls.

The original idea page says tier 2 is unbuilt. Current repo documentation records
its implementation as built, with production infrastructure/deployment pending.

Relevant sources:

- [Product contracts](../product.md)
- [Handler descriptors](../../packages/api/src/handlers.ts)
- [Spend approval rules](../../scenarios/brightline/patches/spend/server/requests.ts)
- [Sales permissions](../../scenarios/brightline/patches/new-business/server/deals.ts)

## The missing foundation

Existing runtime calls require a browser session and an open patch. Machine
tokens are explicitly refused. Direct resource operations are also refused on
tier 2. An external personal agent therefore cannot already invoke a patch merely
by wrapping the builder CLI.

The prototype needs an explicit cloud entry point for authenticated,
request-scoped agent operations. It should establish the person, check their
patch authorization and the current access mode, and reuse the existing handler
engine and permission checks. Broader unattended automation remains separate.

Current machine credentials identify a machine shared by agents. Distinguishing
the connected personal agent requires additional trusted attribution. Existing
runtime logs are visible to owners/admins; a reader-visible activity view is
additional prototype work.

## First build and sequence

1. **Prove external execution.** Against one existing sales patch on the local
   cloud, read a deal and update it through its existing handler without an open
   patch tab. Seed a development agent connection and per-patch authorization.
   Use real handlers and data, with attributable results.
2. **Expose the working path to an agent.** Proposed first interface: a small MCP
   service for discovering patches, inspecting capabilities, requesting access,
   reading and performing operations. Use published metadata; do not require the
   personal agent to have the patch's source repo.
3. **Add connection and settings.** A basic authorization link, revocation, and
   the three owner/admin access modes. Check current authority on each request.
4. **Connect Slack.** Adapt the existing `personal-agent` wrapper to accept its
   owner's Slack identity and let Hermes call the service.
5. **Show the result.** Return a patch link and the actual outcome; show the person
   and agent in a simple activity view. Reuse mutation replay protection where
   applicable so retries do not duplicate an edit.

MCP is proposed, not a settled requirement. A CLI calls the same backend through
terminal commands; MCP provides structured agent tools. The branch name does
not commit the project to CLI-first delivery.

The existing Brightline scenario supplies multiple discoverable patches,
business-rule examples, approval, and local development identities. Start there
rather than building a new demo application.

## Prototype acceptance

- A question without a patch name retrieves the correct permitted data.
- A Slack-requested edit appears on the patch's page.
- Read-only mode refuses writes.
- Existing patch permissions and approval rules still apply to declared calls.
- The activity record identifies the person and agent.
- Revoking patch authorization prevents further access.
- A repeated mutation request does not duplicate the change.

The companion interface owns how agents discover and call tools. Patchy Cloud
owns authoritative data access, execution, business rules and attribution. The
prototype is one local company, one personal-agent client and a few real patches.
Production deployment, company memory, embedded Slack/Salesforce interfaces and
a broader agent ecosystem come later.
