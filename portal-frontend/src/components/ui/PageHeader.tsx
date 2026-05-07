import { ReactNode } from 'react'

interface Props {
  eyebrow?: string
  title: string | ReactNode
  subtitle?: string | ReactNode
  actions?: ReactNode
  align?: 'left' | 'center'
}

export default function PageHeader({ eyebrow, title, subtitle, actions, align = 'left' }: Props) {
  return (
    <header className={`mb-10 lg:mb-14 ${align === 'center' ? 'text-center' : ''}`}>
      <div className={`flex flex-col gap-4 lg:flex-row lg:items-end ${align === 'center' ? 'lg:flex-col lg:items-center' : 'lg:justify-between'}`}>
        <div className={align === 'center' ? 'mx-auto' : ''}>
          {eyebrow && (
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-sun-300 mb-3">
              {eyebrow}
            </p>
          )}
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-semibold leading-[1.05] tracking-tight"
              style={{ color: '#f8fafc' }}>
            {title}
          </h1>
          {subtitle && (
            <p className="mt-4 text-base lg:text-lg max-w-2xl" style={{ color: 'rgba(241,245,249,0.62)' }}>
              {subtitle}
            </p>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-3 shrink-0">{actions}</div>}
      </div>
    </header>
  )
}
