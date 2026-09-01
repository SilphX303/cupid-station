import type { ButtonHTMLAttributes } from 'react'

export function LcarsButton({
  accent = 'lavender',
  filled = false,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { accent?: string; filled?: boolean }) {
  return (
    <button
      className={`lcars-pill cursor-pointer px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] disabled:cursor-default disabled:opacity-40 ${className}`}
      style={
        filled
          ? { background: `var(--color-${accent})`, color: 'var(--color-space)', borderColor: `var(--color-${accent})` }
          : { color: `var(--color-${accent})` }
      }
      {...rest}
    />
  )
}
