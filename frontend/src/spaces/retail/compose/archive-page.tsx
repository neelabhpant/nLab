import { Archive } from 'lucide-react'
import { TopHeader } from '@/shared/components/top-header'
import { useLayoutContext } from '@/shared/components/layout'
import { ComingSoonCard } from '@/shared/components/coming-soon-card'

export function ArchivePage() {
  const { onMobileMenuToggle } = useLayoutContext()
  return (
    <div className="flex flex-col h-full">
      <TopHeader
        title="Archive"
        subtitle="Sent issues of The Retail Read"
        onMenuToggle={onMobileMenuToggle}
      />
      <div className="flex-1 overflow-auto">
        <ComingSoonCard
          title="Archive"
          phase={4}
          description="Every issue you ship lands here as a permanent record (PDF, HTML, Slack). Arrives in Phase 4."
          icon={Archive}
        />
      </div>
    </div>
  )
}
