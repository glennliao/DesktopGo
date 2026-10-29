import { LaunchpadEmptyState } from './LaunchpadEmptyState'
import { PagedDirectoryLists } from '../directory-links/PagedDirectoryLists'
import { Suspense, lazy } from 'react'
import { RefreshCw } from 'lucide-react'
import { translate } from '@/lib/i18n'
import type { DesktopIcon, LaunchpadGridViewMode } from '@/types'
import type { LaunchpadImportPlacementRequest } from '@/components/launchpad/useLaunchpadIconImportController'
import { loadIconGrid, loadScrollableIconGrid } from '@/components/launchpad/launchpadGridChunks'
import { Button } from '@/components/ui/button'

const ScrollableIconGrid = lazy(() =>
  loadScrollableIconGrid().then(module => ({ default: module.ScrollableIconGrid }))
)
const IconGrid = lazy(() => loadIconGrid().then(module => ({ default: module.IconGrid })))

interface LaunchpadIconAreaProps {
  loading: boolean
  /** 图标库加载错误（icons 为空且出错时展示重试界面）。 */
  error: string | null
  icons: DesktopIcon[]
  onRetry: () => void
  gridViewMode: LaunchpadGridViewMode
  layoutResetToken: number
  sidebarCompact: boolean
  onToggleSidebarCompact: () => void
  importPlacementRequest: LaunchpadImportPlacementRequest | null
  addIconDisabled: boolean
  onAddIcon: () => void
  onQuickImport: () => void
  /** 布局预览期间锁住网格：除翻页外的指针交互全部失效。 */
  interactionLocked?: boolean
  /** 翻页指示器要避开的底部高度（布局抽屉）。 */
  paginationBottom?: number
}

/**
 * 启动台主区的内容状态机：加载中 / 加载失败重试 / 空态引导 / 滚动布局 / 分页布局。
 */
export function LaunchpadIconArea({
  loading,
  error,
  icons,
  onRetry,
  gridViewMode,
  layoutResetToken,
  sidebarCompact,
  onToggleSidebarCompact,
  importPlacementRequest,
  addIconDisabled,
  onAddIcon,
  onQuickImport,
  interactionLocked = false,
  paginationBottom = 0,
}: LaunchpadIconAreaProps) {
  return (
    <div className="relative flex h-full min-h-0 items-center justify-center">
      {loading ? (
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-foreground/40 border-t-foreground" />
          <span className="launchpad-wallpaper-text text-lg text-foreground/70">
            {translate('Loading...')}
          </span>
        </div>
      ) : error && icons.length === 0 ? (
        <div role="alert" className="flex max-w-md flex-col items-center gap-3 px-6 text-center">
          <div className="space-y-1">
            <p className="launchpad-wallpaper-text text-sm font-medium text-foreground">
              {translate('图标库加载失败，请重试。')}
            </p>
            <p
              className="launchpad-wallpaper-text break-words text-xs leading-5 text-muted-foreground"
              title={error}
            >
              {translate('现有布局不会被修改。')}
            </p>
          </div>
          <Button type="button" size="sm" onClick={onRetry}>
            <RefreshCw className="h-4 w-4" />
            {translate('重试')}
          </Button>
        </div>
      ) : gridViewMode === 'scroll' ? (
        <Suspense
          fallback={
            <div className="flex items-center gap-3">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-foreground/40 border-t-foreground" />
              <span className="launchpad-wallpaper-text text-lg text-foreground/70">
                {translate('Loading...')}
              </span>
            </div>
          }
        >
          <ScrollableIconGrid
            emptyContent={
              <LaunchpadEmptyState
                onAddIcon={onAddIcon}
                onQuickImport={onQuickImport}
                addIconDisabled={addIconDisabled}
              />
            }
            icons={icons}
            layoutResetToken={layoutResetToken}
            sidebarCompact={sidebarCompact}
            onToggleSidebarCompact={onToggleSidebarCompact}
            importPlacementRequest={importPlacementRequest}
            addIconDisabled={addIconDisabled}
            onAddIcon={onAddIcon}
          />
        </Suspense>
      ) : (
        <Suspense
          fallback={
            <span className="launchpad-wallpaper-text text-sm text-foreground/70">
              {translate('Loading...')}
            </span>
          }
        >
          <PagedDirectoryLists
            icons={icons}
            resetToken={layoutResetToken}
            disabled={interactionLocked}
            addDisabled={addIconDisabled}
          >
            {content => (
              <IconGrid
                contentOverride={content}
                emptyContent={
                  <LaunchpadEmptyState
                    onAddIcon={onAddIcon}
                    onQuickImport={onQuickImport}
                    addIconDisabled={addIconDisabled}
                  />
                }
                icons={icons}
                layoutResetToken={layoutResetToken}
                importPlacementRequest={importPlacementRequest}
                paginationBottom={paginationBottom}
                interactionLocked={interactionLocked}
              />
            )}
          </PagedDirectoryLists>
        </Suspense>
      )}
    </div>
  )
}
