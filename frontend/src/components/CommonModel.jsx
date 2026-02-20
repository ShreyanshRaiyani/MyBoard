import React, { useEffect } from 'react';

export default function CommonModel({
  open = false,
  title = 'Modal Title',
  onClose = () => {},
  children,
  primaryLabel = 'Save',
  secondaryLabel = 'Cancel',
  onPrimary = () => {},
  onSecondary = null,
  size = 'md', // sm | md | lg
}) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const sizeClass = size === 'lg' ? 'modal-lg' : size === 'sm' ? 'modal-sm' : 'modal-md';

  return (
    <div className="common-modal-backdrop" onMouseDown={onClose}>
      <div className={`common-modal ${sizeClass}`} role="dialog" aria-modal="true" onMouseDown={(e)=>e.stopPropagation()}>
        <header className="common-modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </header>

        <div className="common-modal-body">{children}</div>

        <footer className="common-modal-footer">
          <div className="modal-actions">
            <button className="btn secondary" onClick={onSecondary || onClose}>{secondaryLabel}</button>
            <button className="btn primary" onClick={onPrimary}>{primaryLabel}</button>
          </div>
        </footer>
      </div>
    </div>
  );
}
