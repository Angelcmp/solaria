import GeneralWorkspace from './GeneralWorkspace'
import LegalWorkspace from './legal/LegalWorkspace'
import type { WorkspaceAsideProps } from './types'

export default function WorkspaceAside(props: WorkspaceAsideProps) {
  const { workspaceMode = 'general' } = props

  switch (workspaceMode) {
    case 'legal':
      return <LegalWorkspace {...props} />
    default:
      return <GeneralWorkspace {...props} />
  }
}
