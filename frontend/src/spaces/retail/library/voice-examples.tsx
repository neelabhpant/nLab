import { Mic } from 'lucide-react'
import { TopHeader } from '@/shared/components/top-header'
import { useLayoutContext } from '@/shared/components/layout'
import { ComingSoonCard } from '@/shared/components/coming-soon-card'

export function VoiceExamplesPage() {
  const { onMobileMenuToggle } = useLayoutContext()
  return (
    <div className="flex flex-col h-full">
      <TopHeader
        title="Voice Examples"
        subtitle="Few-shot corpus for newsletter generation"
        onMenuToggle={onMobileMenuToggle}
      />
      <div className="flex-1 overflow-auto">
        <ComingSoonCard
          title="Voice Examples"
          phase={5}
          description="The corpus the composer uses for voice tuning, per section type. Editable, grows with every issue you ship."
          icon={Mic}
        />
      </div>
    </div>
  )
}
