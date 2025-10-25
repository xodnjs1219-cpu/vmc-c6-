import React, { ReactNode } from 'react';
import { X } from 'lucide-react';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

interface DialogContentProps {
  children: ReactNode;
}

interface DialogHeaderProps {
  children: ReactNode;
}

interface DialogTitleProps {
  children: ReactNode;
  className?: string;
}

interface DialogDescriptionProps {
  children: ReactNode;
}

interface DialogFooterProps {
  children: ReactNode;
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/50"
        onClick={() => onOpenChange(false)}
      />
      {children}
    </>
  );
}

export function DialogContent({ children }: DialogContentProps) {
  return (
    <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border border-slate-200 bg-white p-6 shadow-lg">
      {children}
    </div>
  );
}

export function DialogHeader({ children }: DialogHeaderProps) {
  return <div className="space-y-2 pb-4">{children}</div>;
}

export function DialogTitle({ children, className = '' }: DialogTitleProps) {
  return <h2 className={`text-lg font-semibold text-slate-900 ${className}`}>{children}</h2>;
}

export function DialogDescription({ children }: DialogDescriptionProps) {
  return <p className="text-sm text-slate-600">{children}</p>;
}

export function DialogFooter({ children }: DialogFooterProps) {
  return <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">{children}</div>;
}
