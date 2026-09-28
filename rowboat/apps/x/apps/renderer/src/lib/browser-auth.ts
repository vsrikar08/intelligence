type LoginWindow = Pick<Window, 'closed' | 'close' | 'focus' | 'location' | 'opener'>

// Reserve a window during the click, before the asynchronous OAuth reverse
// call arrives, so browsers do not block it (2026-09-27, local web login).
export function createBrowserAuth(open: () => LoginWindow | null) {
  let pending: LoginWindow | null = null
  return {
    openUrl(payload: unknown) {
      if (typeof payload !== 'object' || payload === null || !('url' in payload) || typeof payload.url !== 'string') throw new Error('Invalid login URL.')
      const url = new URL(payload.url)
      if (url.origin !== 'https://auth.openai.com' || url.pathname !== '/oauth/authorize' || url.username || url.password) {
        throw new Error('This browser connection only opens ChatGPT sign-in.')
      }
      if (!pending || pending.closed) throw new Error('Click Sign in with ChatGPT to open a login window.')
      pending.location.href = url.href
      pending.focus()
    },
    async signIn<T>(start: () => Promise<T>): Promise<T> {
      if (pending && !pending.closed) throw new Error('A sign-in window is already open.')
      const popup = open()
      if (!popup) throw new Error('Allow pop-ups for this local page, then try ChatGPT sign-in again.')
      popup.opener = null
      pending = popup
      try { return await start() }
      finally {
        popup.close()
        if (pending === popup) pending = null
      }
    },
  }
}
