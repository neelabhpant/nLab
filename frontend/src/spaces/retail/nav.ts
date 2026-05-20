import {
  Newspaper,
  FileText,
  MessageSquare,
  PenSquare,
  FilePlus2,
  FileEdit,
  Archive,
  BookOpen,
  Search,
  Target,
  Mic,
  Users,
} from 'lucide-react'
import type { NavGroup } from '@/spaces/registry'

export const RETAIL_NAV_GROUPS: NavGroup[] = [
  {
    key: 'compose',
    label: 'Compose',
    icon: PenSquare,
    items: [
      { to: '/retail/compose', label: 'New Issue', icon: FilePlus2 },
      { to: '/retail/compose/drafts', label: 'Drafts', icon: FileEdit },
      { to: '/retail/compose/archive', label: 'Archive', icon: Archive },
    ],
  },
  {
    key: 'research',
    label: 'Research',
    icon: Search,
    items: [
      { to: '/retail/research/digest', label: 'Daily Digest', icon: Newspaper },
      { to: '/retail/research/articles', label: 'Article Feed', icon: FileText },
    ],
  },
  {
    key: 'library',
    label: 'Library',
    icon: BookOpen,
    items: [
      { to: '/retail/library/povs', label: 'POVs', icon: Target },
      { to: '/retail/library/voice', label: 'Voice Examples', icon: Mic },
      { to: '/retail/library/distribution', label: 'Distribution Lists', icon: Users },
    ],
  },
  {
    key: 'chat',
    label: 'Chat',
    icon: MessageSquare,
    items: [
      { to: '/retail/chat', label: 'Retail Chat', icon: MessageSquare },
    ],
  },
]
