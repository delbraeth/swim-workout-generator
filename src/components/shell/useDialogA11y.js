// src/components/shell/useDialogA11y.js — accessible-dialog behavior for modals.
// Returns a ref to attach to the dialog PANEL (the box inside .modal-overlay).
// Handles WCAG 2.4.3 / 2.1.2 / 4.1.2:
//   • moves focus into the dialog on open (respects an existing autoFocus),
//   • Escape closes (calls onClose),
//   • Tab is trapped within the dialog (cycles, no escaping to the page behind),
//   • returns focus to the triggering element on close.
// The component still adds role="dialog" aria-modal="true" + an accessible name
// (aria-label / aria-labelledby) to the same panel element. React is a global.
export function useDialogA11y(onClose) {
  const ref = React.useRef(null);
  // Keep the latest onClose without re-running the effect (avoids re-trapping).
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const prevFocus = document.activeElement;

    const focusables = () => Array.from(node.querySelectorAll(
      'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
    )).filter(el => el.offsetParent !== null || el === document.activeElement);

    // Focus into the dialog — but don't fight a field that already autofocused.
    if (!node.contains(document.activeElement)) {
      const first = focusables()[0];
      if (first) first.focus();
      else { node.setAttribute('tabindex', '-1'); node.focus(); }
    }

    function onKey(e) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (onCloseRef.current) onCloseRef.current();
        return;
      }
      if (e.key === 'Tab') {
        const f = focusables();
        if (f.length === 0) { e.preventDefault(); return; }
        const firstEl = f[0], lastEl = f[f.length - 1];
        if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
        else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
      }
    }
    node.addEventListener('keydown', onKey);
    return () => {
      node.removeEventListener('keydown', onKey);
      // Restore focus to whatever opened the dialog (if it's still around).
      if (prevFocus && typeof prevFocus.focus === 'function' && document.contains(prevFocus)) {
        prevFocus.focus();
      }
    };
  }, []);

  return ref;
}
