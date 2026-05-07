import { ReactNode } from 'react'

interface Props {
  label: string
  hint?: ReactNode
  action?: ReactNode
}

export default function SectionDivider({ label, hint, action }: Props) {
  return (
    <div className="flex items-end justify-between gap-4 mb-5 lg:mb-6">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-sun-300 mb-1">{label}</p>
        {hint && <p className="text-sm" style={{ color: 'rgba(241,245,249,0.5)' }}>{hint}</p>}
      </div>
      {action}
    </div>
  )
}
