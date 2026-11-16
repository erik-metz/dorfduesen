'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/** Native top layer keeps dialogs clickable above sticky headers and maps. */
export function ModalDialog({ children, onClose, className = '', label, labelledBy, describedBy }: {
  children: ReactNode;
  onClose: () => void;
  className?: string;
  label?: string;
  labelledBy?: string;
  describedBy?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    element?.showModal();
    return () => {
      element?.close();
      // React may remove the node before passive cleanup, so native focus
      // restoration alone does not cover close buttons that unmount the dialog.
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);

  function dismiss() {
    dialog.current?.close();
    onClose();
  }

  return <dialog ref={dialog} aria-label={label} aria-labelledby={labelledBy} aria-describedby={describedBy}
    onCancel={event => { event.preventDefault(); dismiss(); }}
    onClick={event => { if (event.target === event.currentTarget) dismiss(); }}
    className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none overflow-y-auto border-0 bg-transparent p-4 text-zinc-100 outline-none backdrop:bg-black/80 backdrop:backdrop-blur-sm [&[open]]:flex [&[open]]:items-center [&[open]]:justify-center">
    <div className={className || 'contents'}>{children}</div>
  </dialog>;
}
