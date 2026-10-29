import { useRef } from 'react'
import { useInView } from 'framer-motion'
import type { FolderItem } from '../icon-grid/model'
import { FolderIconVisual } from '../icon-grid/views/FolderVisuals'
import { useLinkedFolderPreview } from './useLinkedFolderPreview'

export function LinkedFolderIconVisual({
  folder,
  imgSize,
}: {
  folder: FolderItem
  imgSize: number
}) {
  const node = useRef<HTMLDivElement>(null)
  const visible = useInView(node, { margin: '120px' })
  const { display } = useLinkedFolderPreview(folder, visible)
  return (
    <div ref={node} style={{ width: imgSize, height: imgSize }}>
      <FolderIconVisual
        icons={display.children.map(child => child.icon)}
        imgSize={imgSize}
        withSurface={false}
      />
    </div>
  )
}
