import { FlaskConical, LayoutGrid, Tags } from 'lucide-react'
import type { NavGroup } from '@/spaces/registry'

export const LABS_NAV_GROUPS: NavGroup[] = [
  {
    key: 'projects',
    label: 'Projects',
    icon: FlaskConical,
    items: [
      { to: '/labs', label: 'All Projects', icon: LayoutGrid },
    ],
  },
  {
    key: 'categories',
    label: 'Categories',
    icon: Tags,
    items: [],
    comingSoon: true,
  },
]
