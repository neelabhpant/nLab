import {
  TrendingUp,
  Sparkles,
  Target,
  LayoutDashboard,
  BarChart3,
  MessageSquare,
  BriefcaseBusiness,
  PieChart,
  CandlestickChart,
  Bot,
} from 'lucide-react'
import type { NavGroup } from '@/spaces/registry'

export const FINANCE_NAV_GROUPS: NavGroup[] = [
  {
    key: 'markets',
    label: 'Markets',
    icon: TrendingUp,
    items: [
      { to: '/finance', label: 'Overview', icon: LayoutDashboard },
      { to: '/finance/analytics', label: 'Analytics', icon: BarChart3 },
      { to: '/finance/chat', label: 'Market Chat', icon: MessageSquare },
      { to: '/finance/trading', label: 'Trading', icon: CandlestickChart },
      { to: '/finance/trading/agents', label: 'AI Agents', icon: Bot },
    ],
  },
  {
    key: 'advisors',
    label: 'Advisors',
    icon: Sparkles,
    items: [
      { to: '/finance/advisor/financial', label: 'Financial Advisor', icon: BriefcaseBusiness },
      { to: '/finance/advisor/portfolio', label: 'Portfolio Advisor', icon: PieChart },
    ],
  },
  {
    key: 'planning',
    label: 'Planning',
    icon: Target,
    items: [],
    comingSoon: true,
  },
]
