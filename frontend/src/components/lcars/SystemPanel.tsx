import type { ReactNode } from 'react'

/** Panel with the 22px hairline head strip: accent name cell + register code. */
export function SystemPanel({
  title,
  code,
  accent = 'lavender',
  children,
  className = '',
  pad = true,
}: {
  title: string
  code?: string
  accent?: string
  children: ReactNode
  className?: string
  pad?: boolean
}) {
  return (
    <section className={`lcars-panel ${className}`}>
      <header className="flex h-[22px] items-stretch border-b border-line-hi">
        <div
          className="flex items-center border-r border-line-hi px-2 text-[9px] uppercase tracking-[0.2em]"
          style={{ color: `var(--color-${accent})` }}
        >
          {title}
        </div>
        <div className="flex flex-1 items-center justify-end px-2">
          {code && <span className="lcars-code">{code}</span>}
        </div>
      </header>
      <div className={pad ? 'p-3 md:p-4' : ''}>{children}</div>
    </section>
  )
}
