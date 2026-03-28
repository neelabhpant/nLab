import { TrendingUp, FlaskConical, ShoppingBag } from 'lucide-react'
import type { ComponentType } from 'react'

export type IconComponent = ComponentType<{ className?: string; strokeWidth?: number }>

export interface NavItem {
  to: string
  label: string
  icon: IconComponent
}

export interface NavGroup {
  key: string
  label: string
  icon: IconComponent
  items: NavItem[]
  comingSoon?: boolean
}

export interface SpaceDefinition {
  id: string
  name: string
  icon: IconComponent
  basePath: string
}

export const SPACES: SpaceDefinition[] = [
  {
    id: 'finance',
    name: 'Finance',
    icon: TrendingUp,
    basePath: '/finance',
  },
  {
    id: 'retail',
    name: 'Retail',
    icon: ShoppingBag,
    basePath: '/retail',
  },
  {
    id: 'labs',
    name: 'Labs',
    icon: FlaskConical,
    basePath: '/labs',
  },
]
