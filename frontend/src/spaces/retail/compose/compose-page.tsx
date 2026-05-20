import { FilePlus2 } from 'lucide-react'
import { TopHeader } from '@/shared/components/top-header'
import { useLayoutContext } from '@/shared/components/layout'
import { ComingSoonCard } from '@/shared/components/coming-soon-card'

export function ComposePage() {
  const { onMobileMenuToggle } = useLayoutContext()
  return (
    <div className="flex flex-col h-full">
      <TopHeader
        title="New Issue"
        subtitle="The Retail Read · composer"
        onMenuToggle={onMobileMenuToggle}
      />
      <div className="flex-1 overflow-auto">
        <ComingSoonCard
          title="New Issue"
          phase={4}
          description="The bi-weekly composer for The Retail Read. Section editors, voice tuning, and export formats arrive in Phase 4."
          icon={FilePlus2}
        />
      </div>
    </div>
  )
}
