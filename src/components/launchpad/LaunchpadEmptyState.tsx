import { Import, Plus, Wand2 } from 'lucide-react'
import { translate } from '@/lib/i18n'
import { Button } from '@/components/ui/button'

export function LaunchpadEmptyState({
  onAddIcon,
  onQuickImport,
  addIconDisabled,
}: {
  onAddIcon: () => void
  onQuickImport: () => void
  addIconDisabled: boolean
}) {
  return (
    <div className="flex max-w-md flex-col items-center gap-4 px-6 text-center">
      <div className="flex h-28 w-44 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-foreground/30 bg-background/35 text-foreground/55 backdrop-blur-sm">
        <Import className="h-6 w-6" />
        <span className="launchpad-wallpaper-text text-xs">{translate('把图标拖到这里导入')}</span>
      </div>
      <div className="space-y-1">
        <p className="launchpad-wallpaper-text text-sm font-medium text-foreground">
          {translate('启动台还是空的')}
        </p>
        <p className="launchpad-wallpaper-text text-xs leading-5 text-muted-foreground">
          {translate('从桌面或资源管理器把应用、快捷方式或文件拖进窗口即可导入，也可以手动添加。')}
        </p>
        <p className="launchpad-wallpaper-text text-xs leading-5 text-muted-foreground">
          {translate('还可以一键扫描已安装的应用，批量导入常用软件。')}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button type="button" size="sm" onClick={onQuickImport} disabled={addIconDisabled}>
          <Wand2 className="h-4 w-4" />
          {translate('快捷导入')}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onAddIcon}
          disabled={addIconDisabled}
        >
          <Plus className="h-4 w-4" />
          {translate('添加图标')}
        </Button>
      </div>
    </div>
  )
}
