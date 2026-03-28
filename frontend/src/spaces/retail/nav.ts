import {
  Newspaper,
  FileText,
  MessageSquare,
  Lightbulb,
  Rss,
  Sparkles,
  ShoppingBag,
  Settings2,
} from 'lucide-react'
import type { NavGroup } from '@/spaces/registry'

export const RETAIL_NAV_GROUPS: NavGroup[] = [
  {
    key: 'intelligence',
    label: 'Intelligence',
    icon: Sparkles,
    items: [
      { to: '/retail', label: 'Daily Digest', icon: Newspaper },
      { to: '/retail/articles', label: 'Article Feed', icon: FileText },
      { to: '/retail/chat', label: 'Retail Chat', icon: MessageSquare },
    ],
  },
  {
    key: 'strategy',
    label: 'Strategy',
    icon: ShoppingBag,
    items: [
      { to: '/retail/sparks', label: 'Use Case Sparks', icon: Lightbulb },
    ],
  },
  {
    key: 'config',
    label: 'Configuration',
    icon: Settings2,
    items: [
      { to: '/retail/sources', label: 'Sources', icon: Rss },
    ],
  },
]
