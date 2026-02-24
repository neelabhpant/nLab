import { useState, useEffect, useCallback, useMemo } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  HelpCircle,
  Settings as SettingsIcon,
  ChevronRight,
} from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChatWidget } from './chat-widget'
import { SPACES } from '@/spaces/registry'
import type { NavGroup } from '@/spaces/registry'
import { FINANCE_NAV_GROUPS } from '@/spaces/finance/nav'
import { LABS_NAV_GROUPS } from '@/spaces/labs/nav'

const SPACE_NAV: Record<string, NavGroup[]> = {
  finance: FINANCE_NAV_GROUPS,
  labs: LABS_NAV_GROUPS,
}

const STORAGE_KEY = 'nlab-nav-groups'

function loadExpandedState(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Record<string, boolean>
  } catch { /* ignore */ }
  return {}
}

function getDefaultExpanded(groups: NavGroup[]): Record<string, boolean> {
  const defaults: Record<string, boolean> = {}
  groups.forEach((g, i) => { defaults[g.key] = i === 0 })
  return defaults
}

const pageVariants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
}

export function Layout() {
  const location = useLocation()
  const isChatPage = location.pathname === '/finance/chat'

  const activeSpace = useMemo(() =>
    SPACES.find((s) =>
      location.pathname === s.basePath || location.pathname.startsWith(s.basePath + '/')
    ) ?? SPACES[0],
  [location.pathname])

  const navGroups = SPACE_NAV[activeSpace.id] ?? []

  const [expanded, setExpanded] = useState(() => {
    const stored = loadExpandedState()
    return { ...getDefaultExpanded(navGroups), ...stored }
  })

  useEffect(() => {
    setExpanded((prev) => ({ ...getDefaultExpanded(navGroups), ...loadExpandedState(), ...prev }))
  }, [navGroups])

  useEffect(() => {
    for (const group of navGroups) {
      if (group.items.some((item) => item.to === activeSpace.basePath ? location.pathname === activeSpace.basePath : location.pathname.startsWith(item.to))) {
        setExpanded((prev) => {
          if (prev[group.key]) return prev
          const next = { ...prev, [group.key]: true }
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
          return next
        })
        break
      }
    }
  }, [location.pathname, navGroups, activeSpace.basePath])

  const toggleGroup = useCallback((key: string) => {
    setExpanded((prev) => {
      const next = { ...prev, [key]: !prev[key] }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  return (
    <div className="flex h-screen bg-surface-0">
      <aside className="w-[240px] border-r border-sidebar-border bg-sidebar flex flex-col py-6 flex-shrink-0">
        <div className="px-6 mb-8">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan flex items-center justify-center">
              <span className="text-xs font-display font-bold text-white">nL</span>
            </div>
            <span className="text-lg font-display font-bold text-foreground tracking-tight">
              nLab
            </span>
          </div>
        </div>

        <nav className="flex flex-col gap-0.5 px-3 flex-1 overflow-y-auto">
          {navGroups.map((group) => {
            const GroupIcon = group.icon
            const isOpen = expanded[group.key] ?? false
            const hasActive = group.items.some((item) =>
              item.to === activeSpace.basePath ? location.pathname === activeSpace.basePath : location.pathname.startsWith(item.to)
            )

            return (
              <div key={group.key} className="mb-1">
                <button
                  onClick={() => !group.comingSoon && toggleGroup(group.key)}
                  className={`flex items-center justify-between w-full px-3 py-2 rounded-lg text-xs font-display font-semibold uppercase tracking-wider transition-colors ${
                    group.comingSoon
                      ? 'text-sidebar-foreground/30 cursor-default'
                      : hasActive
                        ? 'text-sidebar-accent-foreground'
                        : 'text-sidebar-foreground/60 hover:text-sidebar-foreground cursor-pointer'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <GroupIcon className="w-4 h-4" strokeWidth={2} />
                    {group.label}
                  </span>
                  {group.comingSoon ? (
                    <span className="text-[9px] font-body font-medium normal-case tracking-normal px-1.5 py-0.5 rounded bg-surface-1 text-muted-foreground/50">
                      Soon
                    </span>
                  ) : (
                    <motion.span
                      animate={{ rotate: isOpen ? 90 : 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </motion.span>
                  )}
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && !group.comingSoon && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="flex flex-col gap-0.5 pl-3 mt-0.5">
                        {group.items.map(({ to, label, icon: Icon }) => (
                          <NavLink
                            key={to}
                            to={to}
                            end={to === activeSpace.basePath}
                            className={({ isActive }) =>
                              `relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-200 ${
                                isActive
                                  ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold'
                                  : 'text-sidebar-foreground hover:bg-surface-1 hover:text-foreground'
                              }`
                            }
                          >
                            {({ isActive }) => (
                              <>
                                {isActive && (
                                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-cyan" />
                                )}
                                <Icon className="w-[16px] h-[16px] flex-shrink-0" strokeWidth={isActive ? 2.2 : 1.8} />
                                <span className="font-body">{label}</span>
                              </>
                            )}
                          </NavLink>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </nav>

        <div className="px-3 mt-auto flex flex-col gap-0.5">
          <div className="h-px bg-border mx-3 mb-2" />
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold'
                  : 'text-sidebar-foreground hover:bg-surface-1 hover:text-foreground'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-cyan" />
                )}
                <SettingsIcon className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={isActive ? 2.2 : 1.8} />
                <span className="font-body">Settings</span>
              </>
            )}
          </NavLink>
          <button
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-body text-muted-foreground hover:text-foreground hover:bg-surface-1 transition-all duration-200 cursor-pointer w-full text-left"
          >
            <HelpCircle className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={1.8} />
            <span>Help Center</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-auto relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
              className="h-full"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {!isChatPage && <ChatWidget />}
    </div>
  )
}
