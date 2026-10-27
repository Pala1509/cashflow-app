// Puente imperativo hacia <DialogHost/> (montado una sola vez en AppShell).
// Así se puede seguir escribiendo `if (!(await appConfirm('...'))) return`
// casi igual que con el confirm() nativo, pero mostrando nuestro propio
// diseño en vez del popup feo del navegador.

export type ConfirmOptions = {
  danger?: boolean
  confirmLabel?: string
  cancelLabel?: string
}

type Bridge = {
  confirm: (message: string, opts?: ConfirmOptions) => Promise<boolean>
  alertMsg: (message: string) => Promise<void>
}

let bridge: Bridge | null = null

export function _registerDialogBridge(b: Bridge | null) {
  bridge = b
}

export function appConfirm(message: string, opts?: ConfirmOptions): Promise<boolean> {
  if (!bridge) return Promise.resolve(window.confirm(message)) // red de seguridad si algo monta esto antes de tiempo
  return bridge.confirm(message, opts)
}

export function appAlert(message: string): Promise<void> {
  if (!bridge) {
    window.alert(message)
    return Promise.resolve()
  }
  return bridge.alertMsg(message)
}
