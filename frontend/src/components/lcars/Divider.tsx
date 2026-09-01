export function Divider({ accent = 'amber' }: { accent?: string }) {
  return (
    <div className="lcars-divider my-4">
      <div className="bg-rail" />
      <div className="!flex-none w-10 opacity-60" style={{ background: `var(--color-${accent})` }} />
      <div className="!flex-none w-4 bg-rail" />
    </div>
  )
}
