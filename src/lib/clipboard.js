export async function copyToClipboard(text) {
  // Method 1: Modern clipboard API
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {}

  // Method 2: execCommand fallback (works on Android)
  try {
    const input = document.createElement('input')
    input.setAttribute('value', text)
    input.setAttribute('readonly', '')
    input.style.cssText = 'position:fixed;top:0;left:0;opacity:0;'
    document.body.appendChild(input)
    input.focus()
    input.setSelectionRange(0, text.length)
    const ok = document.execCommand('copy')
    document.body.removeChild(input)
    if (ok) return true
  } catch {}

  // Method 3: textarea fallback
  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.cssText = 'position:fixed;top:0;left:0;opacity:0;'
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(textarea)
    return ok
  } catch {}

  return false
}
