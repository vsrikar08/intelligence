import { createRpcClient } from '../../../packages/client/dist/rpc.js'
import { createEventsClient, type PushChannel } from '../../../packages/client/dist/events.js'
import type { ipc } from '@x/shared'
import { createBrowserAuth } from './lib/browser-auth'

// Reuse the existing interface against our local service; the dev proxy keeps
// its bearer key server-side (2026-09-27, Patchy integration).
const baseUrl = `${location.origin}/rowboat`
const rpc = createRpcClient({ baseUrl, token: '' })
const auth = createBrowserAuth(() => window.open('about:blank', '_blank'))
const events = createEventsClient({
  baseUrl, token: '', clientName: 'patchy-local-web',
  capabilities: {
    'open-url': payload => auth.openUrl(payload),
    'focus-client': () => window.focus(),
  },
})
async function waitForConnection() {
  if (events.status() === 'connected') return
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => { unsubscribe(); reject(new Error('The local backend is not connected.')) }, 5000)
    const unsubscribe = events.onStatus(status => {
      if (status === 'connected') { clearTimeout(timer); unsubscribe(); resolve() }
    })
  })
}
const deltas = new Map<string, () => void>()
const local: Partial<Record<ipc.InvokeChannels, unknown>> = {
  'analytics:bootstrap': { installationId: 'patchy-local-web', apiUrl: baseUrl, appVersion: 'local' },
  'app:consumePendingDeepLink': { url: null },
  'app:consumePendingTrayCommand': { toggleMeetingNotes: false },
  'app:consumeUpdateInfo': { version: 'local', updatedFrom: null },
  'browser:getState': { activeTabId: null, tabs: [] },
  'ptt:getStatus': { supported: false, running: false, eventsSeen: false },
  'quickAsk:getShortcut': { accelerator: '', registered: false, isDefault: true },
  'updater:getStatus': { state: 'disabled', version: 'local', reason: 'dev' },
  'power:getCaffeinate': { enabled: false },
}

window.ipc = {
  async invoke(channel, args) {
    if (channel === 'chatgpt:signIn') {
      return auth.signIn(async () => {
        await waitForConnection()
        return rpc.call(channel, args)
      })
    }
    if (channel in local) return local[channel] as never
    if (channel === 'turns:subscribe' || channel === 'turns:unsubscribe') {
      const { turnId } = args as { turnId: string }
      deltas.get(turnId)?.()
      deltas.delete(turnId)
      if (channel === 'turns:subscribe') deltas.set(turnId, events.subscribeTurnDeltas(turnId))
      return {} as never
    }
    if (channel === 'app:focusMainWindow') { window.focus(); return {} as never }
    return rpc.call(channel, args)
  },
  on(channel, listener) {
    return events.on(channel as PushChannel, payload => listener(payload as never))
  },
  send(channel) {
    // These are native window lifecycle signals, not backend operations.
    if (['quickAsk:appReady', 'quickAsk:tuckAck', 'quickAsk:tuck'].includes(channel)) return
    console.warn(`Client-only event unavailable in browser: ${channel}`)
  },
}
window.featureFlags = { spaces: false }
window.electronUtils = {
  getZoomFactor: () => 1,
  getPathForFile: () => { throw new Error('Local filesystem attachment paths are unavailable in this browser client.') },
}
window.addEventListener('pagehide', () => events.close())
await import('./main')
