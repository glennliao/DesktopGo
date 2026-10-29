import { useEffect, useRef, useState } from 'react'
import { translate } from '../../../lib/i18n'
import { PAGINATION_ACTIVE_WIDTH, PAGINATION_DOT_GAP, PAGINATION_DOT_SIZE } from '../constants'

export function GridPageDots({
  count,
  current,
  onChange,
}: {
  count: number
  current: number
  onChange: (page: number) => void
}) {
  const [hover, setHover] = useState<number | null>(null)
  const container = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const node = container.current
    const active = node?.querySelector<HTMLElement>('[aria-current="page"]')
    if (node && active) {
      const offset =
        active.getBoundingClientRect().left - node.getBoundingClientRect().left + node.scrollLeft
      node.scrollTo({ left: Math.max(0, offset - node.clientWidth / 2 + active.clientWidth / 2) })
    }
  }, [current])
  return (
    <div
      ref={container}
      className="flex max-w-full items-center overflow-x-auto"
      style={{ columnGap: PAGINATION_DOT_GAP }}
      onMouseLeave={() => setHover(null)}
    >
      {Array.from({ length: count }, (_, index) => (
        <button
          key={index}
          data-pagination
          type="button"
          aria-label={translate('第 {page} 页', { page: index + 1 })}
          aria-current={current === index ? 'page' : undefined}
          onMouseEnter={() => setHover(index)}
          onClick={() => onChange(index)}
          className={`relative shrink-0 rounded-full transition-all duration-250 ease-out ${
            current === index
              ? 'bg-foreground/88 shadow-[0_0_10px_rgba(15,23,42,0.25)] dark:bg-white/95 dark:shadow-[0_0_10px_rgba(255,255,255,0.75)]'
              : hover === index
                ? 'bg-foreground/45 dark:bg-white/55'
                : 'bg-foreground/25 hover:bg-foreground/35 dark:bg-white/35 dark:hover:bg-white/45'
          }`}
          style={{
            width:
              current === index || hover === index ? PAGINATION_ACTIVE_WIDTH : PAGINATION_DOT_SIZE,
            height: PAGINATION_DOT_SIZE,
          }}
        />
      ))}
    </div>
  )
}
