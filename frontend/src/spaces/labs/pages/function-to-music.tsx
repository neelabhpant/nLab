import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { TopHeader } from '@/shared/components/top-header'
import { useLayoutContext } from '@/shared/components/layout'
import { FunctionChart } from '@/spaces/labs/components/function-music/function-chart'
import { FunctionControls } from '@/spaces/labs/components/function-music/function-controls'
import { FunctionInfo } from '@/spaces/labs/components/function-music/function-info'
import { useFunctionMusicStore } from '@/spaces/labs/stores/function-music-store'

export function FunctionToMusic() {
  const navigate = useNavigate()
  const { onMobileMenuToggle } = useLayoutContext()
  const { isPlotted, plot } = useFunctionMusicStore()

  useEffect(() => {
    if (!isPlotted) {
      plot()
    }
  }, [isPlotted, plot])

  return (
    <div className="flex flex-col h-full">
      <TopHeader title="Function to Music" subtitle="Labs project" onMenuToggle={onMobileMenuToggle}>
        <button
          onClick={() => navigate('/labs')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-medium text-muted-foreground hover:text-foreground hover:bg-surface-1 transition-all duration-200 cursor-pointer"
        >
          <ArrowLeft className="w-3 h-3" />
          Gallery
        </button>
      </TopHeader>

      <div className="flex-1 overflow-auto p-6 lg:p-8">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col md:flex-row gap-6 md:h-full"
        >
          <div className="w-full md:w-[65%] min-w-0 space-y-4">
            <FunctionChart />
            <FunctionControls />
          </div>

          <div className="w-full md:w-[35%] min-w-0">
            <FunctionInfo />
          </div>
        </motion.div>
      </div>
    </div>
  )
}
