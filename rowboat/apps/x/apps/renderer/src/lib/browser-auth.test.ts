import { describe, expect, it, vi } from 'vitest'
import { createBrowserAuth } from './browser-auth'

function setup() {
  const popup = { closed: false, close: vi.fn(), focus: vi.fn(), location: { href: 'about:blank' }, opener: {} }
  const open = vi.fn(() => popup as unknown as Window)
  return { popup, open, auth: createBrowserAuth(open) }
}

describe('browser ChatGPT login', () => {
  it('reserves the window before starting OAuth and navigates on the reverse call', async () => {
    const { popup, open, auth } = setup()
    await auth.signIn(async () => {
      expect(open).toHaveBeenCalledOnce()
      expect(popup.opener).toBeNull()
      auth.openUrl({ url: 'https://auth.openai.com/oauth/authorize?state=test' })
      expect(popup.location.href).toBe('https://auth.openai.com/oauth/authorize?state=test')
      return { signedIn: true }
    })
    expect(popup.close).toHaveBeenCalledOnce()
  })
  it('does not start OAuth when the popup is blocked', async () => {
    const start = vi.fn()
    await expect(createBrowserAuth(() => null).signIn(start)).rejects.toThrow('Allow pop-ups')
    expect(start).not.toHaveBeenCalled()
  })
  it('rejects unrelated URLs and cleans up cancelled or failed attempts', async () => {
    const { popup, auth } = setup()
    await expect(auth.signIn(async () => {
      expect(() => auth.openUrl({ url: 'https://example.com/oauth/authorize' })).toThrow('only opens ChatGPT')
      throw new Error('cancelled')
    })).rejects.toThrow('cancelled')
    expect(popup.close).toHaveBeenCalledOnce()
    expect(() => auth.openUrl({ url: 'https://auth.openai.com/oauth/authorize' })).toThrow('Click Sign in')
  })
})
