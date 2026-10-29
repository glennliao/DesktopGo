import { applyAiGroupsToLayout, type AiGroup } from '../../lib/aiOrganize'
import { getId, type GridItem, type PersistedLayout } from '../icon-grid/model'

/** Directory containers and manual items inside linked lists stay outside AI regrouping. */
export function applyAiGroupsPreservingDirectories(
  items: GridItem[],
  groups: AiGroup[],
  layout: PersistedLayout | null
): GridItem[] {
  const fixedIds = new Set(
    (layout?.scrollGroups ?? []).filter(group => group.directory).flatMap(group => group.itemIds)
  )
  const fixed = items.flatMap((item, index) =>
    fixedIds.has(getId(item)) || (item.kind === 'folder' && item.directory) ? [{ item, index }] : []
  )
  const fixedItems = new Set(fixed.map(entry => entry.item))
  const result = applyAiGroupsToLayout(
    items.filter(item => !fixedItems.has(item)),
    groups
  )
  fixed.forEach(({ item, index }) => result.splice(Math.min(index, result.length), 0, item))
  return result
}
