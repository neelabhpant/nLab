import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Play, Code2, FileText } from 'lucide-react'
import { TopHeader } from '@/shared/components/top-header'
import { PROJECTS, type ProjectStatus } from '@/spaces/labs/data/projects'

const STATUS_STYLES: Record<ProjectStatus, { bg: string; text: string }> = {
  Active: { bg: 'bg-gain/10', text: 'text-gain' },
  'In Progress': { bg: 'bg-[#F5A623]/10', text: 'text-[#F5A623]' },
  Concept: { bg: 'bg-[#BD6BFF]/10', text: 'text-[#BD6BFF]' },
}

const PLACEHOLDER_SECTIONS = [
  { label: 'Demo', icon: Play, color: '#00D4FF' },
  { label: 'Source Code', icon: Code2, color: '#00E599' },
  { label: 'Documentation', icon: FileText, color: '#F5A623' },
]

export function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()

  const project = PROJECTS.find((p) => p.id === projectId)

  if (!project) {
    return (
      <div className="flex flex-col h-full">
        <TopHeader title="Labs" subtitle="Project not found" />
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <h2 className="text-lg font-display font-bold text-foreground mb-2">Project not found</h2>
            <p className="text-sm font-body text-muted-foreground mb-6">
              The project &ldquo;{projectId}&rdquo; doesn&apos;t exist.
            </p>
            <button
              onClick={() => navigate('/labs')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-1 border border-border text-sm font-display font-medium text-foreground hover:bg-surface-2 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Gallery
            </button>
          </motion.div>
        </div>
      </div>
    )
  }

  const statusStyle = STATUS_STYLES[project.status]

  return (
    <div className="flex flex-col h-full">
      <TopHeader title={project.name} subtitle="Labs project">
        <button
          onClick={() => navigate('/labs')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-medium text-muted-foreground hover:text-foreground hover:bg-surface-1 transition-all duration-200 cursor-pointer"
        >
          <ArrowLeft className="w-3 h-3" />
          Gallery
        </button>
      </TopHeader>

      <div className="flex-1 overflow-auto p-6 lg:p-8">
        <div className="max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mb-8"
          >
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${project.accent}15` }}
              >
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: project.accent }} />
              </div>
              <div>
                <h2 className="text-xl font-display font-bold text-foreground tracking-tight">
                  {project.name}
                </h2>
                <span className={`text-[11px] font-display font-semibold px-2 py-0.5 rounded-full ${statusStyle.bg} ${statusStyle.text}`}>
                  {project.status}
                </span>
              </div>
            </div>

            <p className="text-sm font-body text-slate-600 leading-relaxed mb-5">
              {project.description}
            </p>

            <div className="flex flex-wrap gap-2">
              {project.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs font-body font-medium px-2.5 py-1 rounded-lg"
                  style={{ backgroundColor: `${project.accent}12`, color: project.accent }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {PLACEHOLDER_SECTIONS.map((section, i) => {
              const SectionIcon = section.icon
              return (
                <motion.div
                  key={section.label}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.1 + i * 0.06 }}
                  className="rounded-xl border border-border bg-surface-0 p-5 shadow-sm"
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center mb-3"
                    style={{ backgroundColor: `${section.color}15` }}
                  >
                    <SectionIcon className="w-4 h-4" style={{ color: section.color }} />
                  </div>
                  <h3 className="text-sm font-display font-semibold text-foreground mb-1">
                    {section.label}
                  </h3>
                  <p className="text-xs font-body text-slate-500">Coming Soon</p>
                </motion.div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
