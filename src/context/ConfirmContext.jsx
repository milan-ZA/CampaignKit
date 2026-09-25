import { createContext, useCallback, useContext, useRef, useState } from 'react'
import Modal from '../components/Modal'

const ConfirmContext = createContext(null)

/**
 * const confirm = useConfirm()
 * if (await confirm({ title, message, confirmLabel, danger })) { ... }
 */
export function ConfirmProvider({ children }) {
  const [dialog, setDialog] = useState(null)
  const resolver = useRef(null)

  const confirm = useCallback(
    (options) =>
      new Promise((resolve) => {
        resolver.current = resolve
        setDialog(options)
      }),
    [],
  )

  const close = (answer) => {
    resolver.current?.(answer)
    resolver.current = null
    setDialog(null)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {dialog && (
        <Modal onClose={() => close(false)} labelledBy="confirm-title" width={420} role="alertdialog">
          <div className="p-6">
            <h2 id="confirm-title" className="text-lg">
              {dialog.title}
            </h2>
            {dialog.message && <p className="mt-2 text-body">{dialog.message}</p>}
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => close(false)}>
                {dialog.cancelLabel ?? 'Cancel'}
              </button>
              <button
                type="button"
                autoFocus
                className={dialog.danger ? 'btn-danger' : 'btn-accent'}
                onClick={() => close(true)}
              >
                {dialog.confirmLabel ?? 'Yes, continue'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </ConfirmContext.Provider>
  )
}

export const useConfirm = () => useContext(ConfirmContext)
