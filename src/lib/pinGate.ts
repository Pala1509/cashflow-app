export const PIN_STORAGE_KEY = 'cashflow_pin'
export const PIN_UNLOCKED_KEY = 'cashflow_pin_unlocked'

export function hasPinConfigured() {
  return Boolean(localStorage.getItem(PIN_STORAGE_KEY))
}

export function isUnlockedThisSession() {
  return sessionStorage.getItem(PIN_UNLOCKED_KEY) === '1'
}

export function checkPin(value: string) {
  return localStorage.getItem(PIN_STORAGE_KEY) === value
}

export function markUnlocked() {
  sessionStorage.setItem(PIN_UNLOCKED_KEY, '1')
}
