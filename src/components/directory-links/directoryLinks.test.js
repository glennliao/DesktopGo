import test from 'node:test'
import assert from 'node:assert/strict'
import { directoryFolderSize, parseDirectoryLink, resizeDirectoryFolder } from './domain.ts'
import {
  hydrateLayout,
  serializeItems,
  parsePersistedLayout,
} from '../icon-grid/services/layoutStore.ts'
import { normalizeScrollGroups } from '../icon-grid/scroll/scrollGroupLayout.ts'
import {
  replaceFolderChildren,
  finalizeFolderExtractionInTopLevelLayout,
  dissolveFolderInTopLevelLayout,
} from '../icon-grid/domain/folderPolicy.ts'
import { applyAiGroupsPreservingDirectories } from './aiLayoutPolicy.ts'
import { prependDirectoryList, resizeDirectoryList } from './listLayoutPolicy.ts'
import { directoryEntryGridItem, directoryGridLayout, directoryGridWindow } from './gridWindow.ts'
import { linkedFolderPreview } from './folderPreview.ts'

test('directory pages cover every entry and clamp the last page after resizing or refresh', () => {
  const input = {
    items: Array.from({ length: 5001 }, (_, index) => icon(String(index))),
    width: 400,
    height: 248,
    tileWidth: 128,
    rowHeight: 128,
    page: 0,
    top: 0,
    paged: true,
  }
  const layout = directoryGridLayout(input)
  const first = directoryGridWindow({ ...input, layout })
  assert.equal(layout.columns, 3)
  assert.equal(first.visible.length, 6)
  assert.deepEqual(
    layout.slots.filter(Boolean),
    input.items.map(item => item.key)
  )
  const refreshedLayout = directoryGridLayout({ ...input, items: input.items.slice(0, 4) })
  const refreshed = directoryGridWindow({
    ...input,
    layout: refreshedLayout,
    page: first.pageCount - 1,
  })
  assert.equal(refreshed.currentPage, 0)
  assert.equal(refreshed.visible.length, 4)
  const narrow = directoryGridLayout({ ...input, width: 50, height: 20 })
  assert.equal(narrow.columns, 1)
  assert.equal(directoryGridWindow({ ...input, layout: narrow }).visible.length, 1)
  const continuous = directoryGridLayout({ ...input, paged: false })
  const scrolled = directoryGridWindow({ ...input, layout: continuous, paged: false, top: 12800 })
  assert.ok(scrolled.visible[0].row > 0)
  assert.ok(scrolled.visible.length < 30)
  assert.ok(scrolled.visible.length < input.items.length)
})

const directory = { version: 1, rootPath: 'D:\\项目.v1' }
const folder = {
  kind: 'folder',
  id: 'linked',
  name: 'Project',
  size: '1x1',
  children: [],
  directory,
}
const icon = id => ({
  kind: 'icon',
  key: id,
  icon: {
    id,
    name: id,
    path: id,
    target_path: id,
    icon_base64: '',
    item_type: 'file',
    origin: 'import',
  },
})
const group = { id: 'work', name: 'Work', icon: 'grid', itemIds: ['folder:linked'], directory }

test('subdirectory sizes survive both layout owners and successive list edits without altering members', () => {
  let linked = directory
  for (const [index, size] of ['1x1', '1x2', '2x1', '2x2'].entries())
    linked = resizeDirectoryFolder(linked, `工具\\子目录${index}`, size)
  assert.equal(directoryFolderSize(linked, '工具/子目录1'), '1x2')
  assert.equal(directoryFolderSize(linked, '工具/子目录2'), '2x1')
  assert.equal(directory.folderSizes, undefined)
  const saved = {
    items: serializeItems([{ ...folder, directory: linked }]),
    slots: ['folder:linked'],
    dockKeys: [],
    scrollGroups: [{ ...group, directory: linked }],
  }
  const resized = resizeDirectoryList(
    resizeDirectoryList(saved, 'work', '工具/子目录0', '2x1'),
    'work',
    '新增目录',
    '1x2'
  )
  assert.equal(resized.items, saved.items)
  assert.equal(resized.slots, saved.slots)
  const roundTrip = hydrateLayout(
    [],
    parsePersistedLayout(JSON.stringify({ ...resized, version: 9 }))
  )
  assert.equal(
    directoryFolderSize(roundTrip.layout.scrollGroups[0].directory, '工具/子目录0'),
    '2x1'
  )
  assert.equal(directoryFolderSize(roundTrip.layout.scrollGroups[0].directory, '新增目录'), '1x2')
  assert.equal(directoryFolderSize(roundTrip.items[0].directory, '工具/子目录0'), '1x1')
  assert.equal(directoryFolderSize(roundTrip.items[0].directory, '工具/子目录1'), '1x2')
  const parsed = parseDirectoryLink({ ...directory, folderSizes: { good: '1x2', invalid: '3x3' } })
  assert.deepEqual(parsed.folderSizes, { good: '1x2' })
  const entry = directoryEntryGridItem(parsed, {
    name: 'good',
    path: 'D:\\项目.v1\\good',
    relativePath: 'good',
    isDirectory: true,
    canEnter: true,
  })
  assert.equal(entry.size, '1x2')
})

test('paged covers leave their spare rows available to small icons on earlier pages', () => {
  const folders = Array.from({ length: 6 }, (_, index) => ({
    ...folder,
    id: `directory-${index}`,
    size: '2x2',
  }))
  const input = {
    items: [...folders, ...Array.from({ length: 12 }, (_, index) => icon(`file-${index}`))],
    width: 808,
    height: 376,
    tileWidth: 128,
    rowHeight: 128,
    paged: true,
  }
  const layout = directoryGridLayout(input)
  assert.equal(layout.columns, 6)
  assert.equal(layout.pageCount, 2)
  for (let page = 0; page < layout.pageCount; page++) {
    const entries = directoryGridWindow({ ...input, layout, page, top: 0 }).visible
    assert.equal(entries.filter(entry => entry.item.kind === 'folder').length, 3)
    assert.equal(entries.filter(entry => entry.item.kind === 'icon').length, 6)
    assert.ok(entries.every(entry => entry.row + entry.span.rows <= 3))
  }
})

test('directory subfolders use large covers and mixed tiles fit pages without overlapping', () => {
  const entries = ['工具', '开发', '文档'].map(name => ({
    name,
    path: `D:\\项目.v1\\${name}`,
    relativePath: name,
    isDirectory: true,
    canEnter: true,
  }))
  const items = [
    ...entries.map(entry => directoryEntryGridItem(directory, entry)),
    ...Array.from({ length: 5 }, (_, index) => icon(`file-${index}`)),
  ]
  assert.equal(items[0].kind, 'folder')
  assert.equal(items[0].size, '2x2')
  assert.equal(items[0].directory, directory)
  assert.deepEqual(items[0].children, [])
  const input = { items, width: 400, height: 248, tileWidth: 128, rowHeight: 128, paged: true }
  const layout = directoryGridLayout(input)
  const pages = Array.from(
    { length: layout.pageCount },
    (_, page) => directoryGridWindow({ ...input, layout, page, top: 0 }).visible
  )
  assert.equal(pages.flat().length, items.length)
  assert.equal(new Set(pages.flat().map(entry => entry.id)).size, items.length)
  for (const page of pages) {
    const occupied = new Set()
    for (const entry of page) {
      assert.ok(entry.col + entry.span.cols <= layout.columns)
      assert.ok(entry.row + entry.span.rows <= 2)
      for (let row = entry.row; row < entry.row + entry.span.rows; row++) {
        for (let col = entry.col; col < entry.col + entry.span.cols; col++) {
          const cell = row * layout.columns + col
          assert.equal(occupied.has(cell), false)
          occupied.add(cell)
        }
      }
    }
  }
  const narrow = directoryGridLayout({ ...input, width: 50, height: 20 })
  assert.equal(narrow.slots.filter(Boolean).length, items.length)
  assert.deepEqual(
    directoryGridWindow({ ...input, layout: narrow, page: 0, top: 0 }).visible[0].span,
    { cols: 1, rows: 1 }
  )
  assert.equal(items[0].size, '2x2')
  const continuous = directoryGridLayout({ ...input, paged: false })
  assert.deepEqual(
    continuous.entries.map(entry => [entry.row, entry.col]),
    [
      [0, 0],
      [0, 2],
      [1, 2],
      [2, 0],
      [2, 2],
      [3, 2],
      [4, 0],
      [4, 2],
    ]
  )
  const blocked = directoryEntryGridItem(directory, { ...entries[0], canEnter: false })
  assert.equal(blocked.kind, 'icon')
  assert.equal(blocked.icon.path, entries[0].path)
})

test('linked folder covers preview real contents without importing or replacing manual members', () => {
  const manual = icon('manual')
  const source = { ...folder, size: '2x2', children: [manual] }
  const before = serializeItems([source])
  const entries = Array.from({ length: 20 }, (_, index) => ({
    name: `app${index}.lnk`,
    path: `D:\\项目.v1\\app${index}.lnk`,
    relativePath: `app${index}.lnk`,
    isDirectory: false,
    canEnter: false,
  }))
  entries.push({
    name: '子目录',
    path: 'D:\\项目.v1\\子目录',
    relativePath: '子目录',
    isDirectory: true,
    canEnter: true,
  })
  const requested = []
  const preview = linkedFolderPreview(source, entries, 'zh-CN', entry => {
    requested.push(entry.path)
    return 'shell-icon'
  })
  assert.equal(preview.children.length, 12)
  assert.equal(preview.children[0], manual)
  assert.equal(preview.children[1].icon.name, '子目录')
  assert.equal(preview.children[2].icon.name, 'app0.lnk')
  assert.equal(preview.children[2].icon.path, entries[0].path)
  assert.equal(preview.children[2].icon.icon_base64, 'shell-icon')
  assert.equal(requested.length, 11)
  assert.deepEqual(serializeItems([source]), before)
  assert.equal(source.children.length, 1)
  assert.equal(
    linkedFolderPreview({ ...source, size: '1x1' }, entries, 'zh-CN', () => '').children.length,
    4
  )
  assert.equal(
    linkedFolderPreview({ ...source, directory: undefined }, entries, 'zh-CN', () => '').children,
    source.children
  )
})

test('creating a linked list preserves shared list records and never imports a folder item', () => {
  const saved = {
    items: serializeItems([folder]),
    slots: ['folder:linked'],
    dockKeys: [],
    scrollGroups: [group],
    scrollGroupItemsExplicit: true,
  }
  const linked = { version: 1, rootPath: 'E:\\资料' }
  const result = prependDirectoryList(saved, linked, index => `Group ${index + 1}`)
  assert.equal(result.items, saved.items)
  assert.equal(result.slots, saved.slots)
  assert.deepEqual(result.scrollGroups[0].directory, linked)
  assert.equal(result.scrollGroups[0].name, '资料')
  assert.deepEqual(result.scrollGroups[0].itemIds, [])
  assert.deepEqual(result.scrollGroups[1], group)
  assert.equal(saved.scrollGroups.length, 1)
  const first = prependDirectoryList(null, linked, index => `Group ${index + 1}`)
  assert.equal(first.scrollGroups.length, 1)
  assert.deepEqual(first.items, [])
  const legacy = prependDirectoryList(
    {
      items: [
        { type: 'icon', key: 'desktop:a' },
        { type: 'icon', key: 'customapp:b' },
      ],
      slots: ['desktop:a', 'customapp:b'],
      dockKeys: ['customapp:b'],
      pageSize: 1,
      scrollGroups: [
        { id: 'first', name: 'First', icon: 'grid', itemIds: [] },
        { id: 'second', name: 'Second', icon: 'grid', itemIds: [] },
      ],
      scrollGroupItemsExplicit: false,
    },
    linked,
    index => `Group ${index + 1}`
  )
  assert.deepEqual(
    legacy.scrollGroups.slice(1).map(group => group.itemIds),
    [['a'], []]
  )
})

test('linked empty folders and list links survive layout serialization and hydration without library entries', () => {
  const payload = {
    version: 9,
    items: serializeItems([folder]),
    slots: ['folder:linked'],
    dockKeys: [],
    scrollGroups: [group],
  }
  const parsed = parsePersistedLayout(JSON.stringify(payload))
  const hydrated = hydrateLayout([], parsed)
  assert.deepEqual(hydrated.items, [folder])
  assert.deepEqual(hydrated.layout.scrollGroups[0].directory, directory)
  assert.deepEqual(
    normalizeScrollGroups({
      groups: [group],
      outerItemIds: ['folder:linked'],
      hasExplicitItems: true,
      defaultName: () => 'Default',
    })[0].directory,
    directory
  )
})

test('extracting the last manual child does not remove a linked container or its slots', () => {
  const withChild = { ...folder, children: [icon('a')] }
  assert.deepEqual(replaceFolderChildren([withChild], folder.id, []), [folder])
  const slots = ['folder:linked']
  assert.deepEqual(finalizeFolderExtractionInTopLevelLayout([folder], slots, slots, folder.id), {
    items: [folder],
    outerSlots: slots,
    dockKeys: slots,
  })
  const restored = hydrateLayout([icon('a').icon], {
    items: serializeItems([withChild]),
    slots,
    dockKeys: [],
  })
  assert.equal(restored.items[0].kind, 'folder')
})

test('dissolving an empty linked folder safely removes its virtual layout and Dock slots', () => {
  const result = dissolveFolderInTopLevelLayout([folder], [null], ['folder:linked'], folder.id, {
    columns: 1,
    pageSize: 1,
  })
  assert.deepEqual(result.items, [])
  assert.deepEqual(result.dockKeys, [null])
})

test('AI cannot consume linked containers or manual members of a linked list', () => {
  const linked = { ...folder, children: [icon('a')] }
  const items = [linked, icon('b'), icon('c'), icon('d')]
  const result = applyAiGroupsPreservingDirectories(
    items,
    [{ folder_name: 'Mixed', icon_keys: ['a', 'b', 'c', 'd'] }],
    { scrollGroups: [{ ...group, itemIds: ['folder:linked', 'b'] }] }
  )
  assert.equal(result[0], linked)
  assert.equal(result[1], items[1])
  assert.equal(result[2].kind, 'folder')
  assert.deepEqual(
    result[2].children.map(item => item.key),
    ['c', 'd']
  )
})

test('future directory formats retain their fields during parsing and layout round trips', () => {
  const future = { version: 2, rootPath: directory.rootPath, futureOption: 'retain' }
  assert.deepEqual(parseDirectoryLink(future), future)
  assert.deepEqual(
    hydrateLayout([], {
      items: serializeItems([{ ...folder, directory: future }]),
      slots: [],
      dockKeys: [],
    }).items[0].directory,
    future
  )
  assert.equal(parseDirectoryLink({ version: 1, rootPath: '' }), undefined)
})
