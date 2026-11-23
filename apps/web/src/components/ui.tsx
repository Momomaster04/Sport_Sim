import type { ButtonHTMLAttributes, ReactNode } from 'react';

function join(...classes: Array<string | false | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={join(
        'rounded-2xl border border-pitch-700/60 bg-pitch-900/70 shadow-xl shadow-black/30 backdrop-blur',
        className,
      )}
    >
      {children}
    </section>
  );
}

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3 border-b border-pitch-700/50 px-5 py-4">
      <div>
        <h2 className="text-sm font-semibold tracking-wide text-white uppercase">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-xs text-emerald-100/50">{subtitle}</p> : null}
      </div>
      {action}
    </header>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'danger';
};

export function Button({ variant = 'ghost', className, ...props }: ButtonProps) {
  const styles = {
    primary: 'bg-accent text-pitch-950 hover:bg-accent/85 font-semibold',
    ghost: 'bg-pitch-800 text-emerald-50 hover:bg-pitch-700 border border-pitch-700/70',
    danger: 'bg-transparent text-red-300/80 hover:bg-red-500/10 border border-red-500/30',
  }[variant];

  return (
    <button
      type="button"
      className={join(
        'rounded-lg px-3.5 py-2 text-sm transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-inherit',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        styles,
        className,
      )}
      {...props}
    />
  );
}

export function Tab({
  active,
  disabled,
  onClick,
  children,
  hint,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={hint}
      aria-current={active ? 'page' : undefined}
      className={join(
        'relative rounded-lg px-4 py-2 text-sm whitespace-nowrap transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        active
          ? 'bg-accent/15 font-semibold text-accent'
          : disabled
            ? 'cursor-not-allowed text-emerald-100/25'
            : 'text-emerald-100/60 hover:bg-pitch-800 hover:text-emerald-50',
      )}
    >
      {children}
    </button>
  );
}

export function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border border-pitch-700/50 bg-pitch-800/40 px-4 py-3" title={hint}>
      <div className="text-[11px] font-medium tracking-wider text-emerald-100/45 uppercase">{label}</div>
      <div className="nums mt-1 text-2xl font-semibold text-white">{value}</div>
    </div>
  );
}

/** A small coloured square used to identify a competitor in tables and lists. */
export function TeamDot({ color }: { color?: string | undefined }) {
  return (
    <span
      aria-hidden
      className="inline-block size-2.5 shrink-0 rounded-sm ring-1 ring-white/15"
      style={{ background: color ?? '#4b5563' }}
    />
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="px-5 py-14 text-center">
      <p className="text-sm font-medium text-emerald-50">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-xs text-emerald-100/50">{body}</p>
    </div>
  );
}
