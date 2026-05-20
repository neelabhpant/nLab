import { Users } from 'lucide-react'
import { TopHeader } from '@/shared/components/top-header'
import { useLayoutContext } from '@/shared/components/layout'
import { ComingSoonCard } from '@/shared/components/coming-soon-card'

export function DistributionListsPage() {
  const { onMobileMenuToggle } = useLayoutContext()
  return (
    <div className="flex flex-col h-full">
      <TopHeader
        title="Distribution Lists"
        subtitle="Who gets each issue"
        onMenuToggle={onMobileMenuToggle}
      />
      <div className="flex-1 overflow-auto">
        <ComingSoonCard
          title="Distribution Lists"
          phase={4}
          description="Recipient groups (AEs, RVPs, GVPs). Used by the composer at send time."
          icon={Users}
        />
      </div>
    </div>
  )
}
