"use client";
import { useEffect, useRef } from "react";
import {
  BookOpen,
  Dumbbell,
  Footprints,
  Moon,
  Sun,
  Smartphone,
  Laptop,
  Briefcase,
  CircleCheck,
  Heart,
  Wallet,
  Sparkles,
  X,
  Target,
  type LucideIcon,
} from "lucide-react";
const icons: Record<string, LucideIcon> = {
  "book-open": BookOpen,
  dumbbell: Dumbbell,
  footprints: Footprints,
  moon: Moon,
  sun: Sun,
  smartphone: Smartphone,
  laptop: Laptop,
  briefcase: Briefcase,
  "circle-check": CircleCheck,
  heart: Heart,
  wallet: Wallet,
  sparkles: Sparkles,
  target: Target,
};
export function Icon({ name, size = 24 }: { name: string; size?: number }) {
  const I = icons[name] || CircleCheck;
  return <I size={size} strokeWidth={1.75} aria-hidden />;
}
export function Wordmark({
  className = "",
  home = false,
}: {
  className?: string;
  home?: boolean;
}) {
  const content = (
    <>
      motion
      <span className="logo-dot" aria-hidden />
    </>
  );
  return home ? (
    <a className={`wordmark ${className}`} href="/" aria-label="Motion home">
      {content}
    </a>
  ) : (
    <span className={`wordmark ${className}`}>{content}</span>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    const trigger = document.activeElement;
    d?.showModal();
    return () => {
      d?.close();
      if (trigger instanceof HTMLElement && trigger.isConnected)
        trigger.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="sheet-head">
        <h2>{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={20} aria-hidden />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Empty({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <Sparkles size={24} aria-hidden />
      <h3>{title}</h3>
      <p>{body}</p>
      {children}
    </div>
  );
}
