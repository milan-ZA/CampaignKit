import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

const openModals = []

/**
 * Centred dialog with a dark backdrop. Closes on Escape and on a backdrop click.
 * fullScreenOnMobile: fills the screen below 640px.
 */
export default function Modal({
  children,
  onClose,
  width = 480,
  labelledBy,
  fullScreenOnMobile = false,
  role = 'dialog',
  className = '',
}) {
  const panelRef = useRef(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const token = {}
    openModals.push(token)
    const previouslyFocused = document.activeElement
    const onKey = (e) => {
      // Only the top-most modal reacts, so Escape in a confirm dialog doesn't also close the preview.
      if (e.key === 'Escape' && openModals[openModals.length - 1] === token) {
        e.preventDefault()
        onCloseRef.current()
      }
    }
    document.addEventListener('keydown', onKey)
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    if (!panelRef.current?.contains(document.activeElement)) panelRef.current?.focus()
    return () => {
      openModals.splice(openModals.indexOf(token), 1)
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previouslyFocused?.focus?.()
    }
  }, [])

  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-backdrop ${
        fullScreenOnMobile ? 'p-0 sm:p-4' : 'p-4'
      }`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        style={{ '--modal-w': `${width}px` }}
        className={`relative flex max-h-full w-full flex-col overflow-auto bg-surface shadow-pop outline-none ${
          fullScreenOnMobile
            ? 'h-full sm:h-auto sm:max-h-[92vh] sm:max-w-(--modal-w) sm:rounded-2xl'
            : 'max-h-[92vh] max-w-(--modal-w) rounded-2xl'
        } ${className}`}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}
