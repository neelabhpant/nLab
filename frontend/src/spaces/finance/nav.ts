import {
  TrendingUp,
  Sparkles,
  LayoutDashboard,
  MessageSquare,
  BriefcaseBusiness,
  CandlestickChart,
  Bot,
  Map,
  LineChart,
} from 'lucide-react'
import type { NavGroup } from '@/spaces/registry'

export const FINANCE_NAV_GROUPS: NavGroup[] = [
  {
    key: 'markets',
    label: 'Markets',
    icon: TrendingUp,
    items: [
      { to: '/finance', label: 'Overview', icon: LayoutDashboard },
      { to: '/finance/chat', label: 'Market Chat', icon: MessageSquare },
      { to: '/finance/trading', label: 'Trading', icon: CandlestickChart },
      { to: '/finance/trading/agents', label: 'AI Trading Agents', icon: Bot },
    ],
  },
  {
    key: 'intelligence',
    label: 'Intelligence',
    icon: Sparkles,
    items: [
      { to: '/finance/advisor/financial', label: 'Financial Advisor', icon: BriefcaseBusiness },
      { to: '/finance/roadmap', label: 'Financial Roadmap', icon: Map },
      { to: '/finance/forecast', label: 'Price Forecast', icon: LineChart },
    ],
  },
]
