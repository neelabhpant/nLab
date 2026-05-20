import { FileEdit } from 'lucide-react'
import { TopHeader } from '@/shared/components/top-header'
import { useLayoutContext } from '@/shared/components/layout'
import { ComingSoonCard } from '@/shared/components/coming-soon-card'

export function DraftsPage() {
  const { onMobileMenuToggle } = useLayoutContext()
  return (
    <div className="flex flex-col h-full">
      <TopHeader
        title="Drafts"
        subtitle="In-progress issues"
        onMenuToggle={onMobileMenuToggle}
      />
      <div className="flex-1 overflow-auto">
        <ComingSoonCard
          title="Drafts"
          phase={4}
          description="Saved-but-not-sent issues live here. Auto-save and resume arrive in Phase 4."
          icon={FileEdit}
        />
      </div>
    </div>
  )
}
