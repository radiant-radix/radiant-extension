const KEY = 'radiant_address_book'

export function getContacts() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch { return [] }
}

export function addContact(name, address) {
  const contacts = getContacts()
  if (contacts.find(c => c.address === address)) throw new Error('Address already exists')
  contacts.push({ id: Date.now(), name, address, createdAt: Date.now() })
  localStorage.setItem(KEY, JSON.stringify(contacts))
  return contacts
}

export function deleteContact(id) {
  const contacts = getContacts().filter(c => c.id !== id)
  localStorage.setItem(KEY, JSON.stringify(contacts))
  return contacts
}

export function editContact(id, name) {
  const contacts = getContacts().map(c => c.id === id ? { ...c, name } : c)
  localStorage.setItem(KEY, JSON.stringify(contacts))
  return contacts
}
