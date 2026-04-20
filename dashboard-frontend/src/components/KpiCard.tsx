interface KpiCardProps {
  title: string
  value: string | number
  sub?: string
  color?: 'primary' | 'danger' | 'success' | 'warning' | 'info'
  icon?: string
}

const colorMap = {
  primary: 'text-violet-400',
  danger:  'text-red-400',
  success: 'text-emerald-400',
  warning: 'text-amber-400',
  info:    'text-blue-400',
}

export default function KpiCard({ title, value, sub, color = 'primary', icon }: KpiCardProps) {
  return (
    <div className="card flex flex-col gap-1">
      <div className="text-muted text-xs uppercase tracking-wider flex items-center gap-1.5">
        {icon && <span>{icon}</span>}
        {title}
      </div>
      <div className={`text-2xl font-bold ${colorMap[color]}`}>{value}</div>
      {sub && <div className="text-muted text-xs">{sub}</div>}
    </div>
  )
}
