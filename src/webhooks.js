const WEBHOOKS_KEY = 'radiant_webhooks'

export function getWebhooks() {
  try { return JSON.parse(localStorage.getItem(WEBHOOKS_KEY) || '[]') }
  catch { return [] }
}

export function addWebhook(url, events = ['received', 'sent']) {
  const hooks = getWebhooks()
  hooks.push({ id: Date.now(), url, events, active: true, createdAt: Date.now() })
  localStorage.setItem(WEBHOOKS_KEY, JSON.stringify(hooks))
  return hooks
}

export function deleteWebhook(id) {
  const hooks = getWebhooks().filter(h => h.id !== id)
  localStorage.setItem(WEBHOOKS_KEY, JSON.stringify(hooks))
  return hooks
}

export function toggleWebhook(id) {
  const hooks = getWebhooks().map(h => h.id === id ? { ...h, active: !h.active } : h)
  localStorage.setItem(WEBHOOKS_KEY, JSON.stringify(hooks))
  return hooks
}

export async function fireWebhooks(event, data) {
  const hooks = getWebhooks().filter(h => h.active && h.events.includes(event))
  for (const hook of hooks) {
    try {
      await fetch(hook.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, data, timestamp: Date.now() }),
      })
    } catch {}
  }
}
