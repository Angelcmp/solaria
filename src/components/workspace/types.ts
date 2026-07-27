import type { Conversation } from '../../hooks/useChat'

export interface Project {
  id: string
  name: string
  path: string
  createdAt: number
}

export interface WorkspaceAsideProps {
  conversations: Conversation[]
  activeConvId: string | null
  isCollapsed: boolean
  onToggle: () => void
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
  onPin: (id: string) => void
  onArchive: (id: string) => void
  onRestore: (id: string) => void
  onRename: (id: string, title: string) => void
  onShowSettings?: (tab?: string) => void
  projects?: Project[]
  onAddProject?: (project: Project) => void
  onUpdateProject?: (project: Project) => void
  onDeleteProject?: (id: string) => void
  onSelectProject?: (project: Project) => void
  activeProjectId?: string | null
  onOpenWiki?: () => void
}
