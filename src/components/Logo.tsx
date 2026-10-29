import { appIdentity } from '@/lib/appIdentity'

interface LogoIconProps {
  size?: number
  className?: string
}

/** DesktopGo 品牌图标，统一使用 public/logo.svg。 */
export function LogoIcon({ size = 24, className }: LogoIconProps) {
  return (
    <img
      src="/logo.svg"
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      className={className}
    />
  )
}

interface LogoTextProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const textSizes = {
  sm: 'text-sm',
  md: 'text-xl',
  lg: 'text-3xl',
}

/** DesktopGo 品牌文字 */
export function LogoText({ size = 'md', className }: LogoTextProps) {
  const name = appIdentity.name
  if (!name.startsWith('DesktopGo')) {
    return <span className={`${textSizes[size]} font-semibold ${className ?? ''}`}>{name}</span>
  }
  return (
    <span className={`inline-flex items-baseline whitespace-nowrap ${className ?? ''}`}>
      <span className={`${textSizes[size]} font-light text-muted-foreground/70 tracking-wide`}>
        Desktop
      </span>
      <span className={`${textSizes[size]} font-bold text-[#a78bfa] tracking-wide`}>Go</span>
      {name.slice('DesktopGo'.length).trim() ? (
        <span className={`${textSizes[size]} ml-1 font-medium text-foreground`}>
          {name.slice('DesktopGo'.length).trim()}
        </span>
      ) : null}
    </span>
  )
}

interface LogoProps {
  iconSize?: number
  textSize?: 'sm' | 'md' | 'lg'
  showIcon?: boolean
  showText?: boolean
  className?: string
}

/** 完整 Logo：图标 + 文字 */
export function Logo({
  iconSize = 24,
  textSize = 'md',
  showIcon = true,
  showText = true,
  className,
}: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ''}`}>
      {showIcon && <LogoIcon size={iconSize} />}
      {showText && <LogoText size={textSize} />}
    </span>
  )
}
