import { ReactNode, ButtonHTMLAttributes } from 'react'
import { Link } from 'react-router-dom'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface Common {
  children: ReactNode
  variant?: Variant
  size?: Size
  iconLeft?: ReactNode
  iconRight?: ReactNode
  fullWidth?: boolean
  className?: string
}
interface AsButton extends Common, Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'className'> {
  to?: undefined
  href?: undefined
}
interface AsLink extends Common {
  to: string
  href?: undefined
  onClick?: () => void
}
interface AsAnchor extends Common {
  href: string
  to?: undefined
  target?: string
  onClick?: () => void
}

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-4 text-xs',
  md: 'h-11 px-5 text-sm',
  lg: 'h-13 px-7 text-base',
}

const VARIANTS: Record<Variant, string> = {
  primary:   'text-ink-500 font-semibold shadow-lg shadow-sun-500/20',
  secondary: 'bg-white/5 hover:bg-white/10 text-white border border-white/10 font-medium',
  ghost:     'text-white/70 hover:text-white hover:bg-white/5 font-medium',
  danger:    'bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30 font-medium',
}

function classes(v: Variant, s: Size, fw?: boolean, extra = '') {
  return [
    'inline-flex items-center justify-center gap-2 rounded-xl transition-all active:scale-[0.97] no-underline',
    SIZES[s],
    VARIANTS[v],
    fw ? 'w-full' : '',
    extra,
  ].join(' ')
}

const primaryStyle = { background: 'linear-gradient(135deg, #FFB347 0%, #F09A2E 50%, #E07F1A 100%)' }

export default function Button(props: AsButton | AsLink | AsAnchor) {
  const { children, variant = 'primary', size = 'md', iconLeft, iconRight, fullWidth, className = '' } = props
  const cls = classes(variant, size, fullWidth, className)
  const style = variant === 'primary' ? primaryStyle : undefined
  const inner = (
    <>
      {iconLeft && <span className="shrink-0">{iconLeft}</span>}
      <span>{children}</span>
      {iconRight && <span className="shrink-0">{iconRight}</span>}
    </>
  )
  if ('to' in props && props.to) {
    return <Link to={props.to} onClick={props.onClick} className={cls} style={style}>{inner}</Link>
  }
  if ('href' in props && props.href) {
    return <a href={props.href} target={props.target} onClick={props.onClick} className={cls} style={style}>{inner}</a>
  }
  const { iconLeft: _i, iconRight: _i2, fullWidth: _f, variant: _v, size: _s, ...rest } = props as AsButton
  return <button className={cls} style={style} {...rest}>{inner}</button>
}
