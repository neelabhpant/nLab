import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { TopHeader } from '@/shared/components/top-header'
import { useLayoutContext } from '@/shared/components/layout'
import { PROJECTS, type Project, type ProjectStatus } from '@/spaces/labs/data/projects'

const STATUS_STYLES: Record<ProjectStatus, { bg: string; text: string }> = {
  Active: { bg: 'bg-gain/10', text: 'text-gain' },
  'In Progress': { bg: 'bg-[#F5A623]/10', text: 'text-[#F5A623]' },
  Concept: { bg: 'bg-[#BD6BFF]/10', text: 'text-[#BD6BFF]' },
}

function ProjectCard({ project, index }: { project: Project; index: number }) {
  const navigate = useNavigate()
  const [hovered, setHovered] = useState(false)
  const statusStyle = STATUS_STYLES[project.status]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
      onClick={() => navigate(project.route ?? `/labs/${project.id}`)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative rounded-xl bg-surface-0 overflow-hidden cursor-pointer"
      style={{
        border: `1px solid ${hovered ? project.accent + '50' : 'var(--border)'}`,
        boxShadow: hovered
          ? `0 8px 24px -4px ${project.accent}20, 0 0 0 1px ${project.accent}25`
          : '0 1px 3px 0 rgb(0 0 0 / 0.04)',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        transition: 'all 0.3s ease',
      }}
    >
      <div className="h-1" style={{ background: `linear-gradient(90deg, ${project.accent}, ${project.accent}80)` }} />

      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <h3
            className="text-base font-display font-bold tracking-tight transition-colors duration-300"
            style={{ color: hovered ? project.accent : '#64748b' }}
          >
            {project.name}
          </h3>
          <span className={`flex-shrink-0 ml-3 text-[10px] font-display font-semibold px-2 py-0.5 rounded-full ${statusStyle.bg} ${statusStyle.text}`}>
            {project.status}
          </span>
        </div>

        <p className="text-sm font-body text-muted-foreground leading-relaxed mb-4 line-clamp-3">
          {project.description}
        </p>

        <div className="flex items-center justify-between">
          <div className="flex flex-wrap gap-1.5">
            {project.tags.map((tag) => (
              <span
                key={tag}
                className="text-[11px] font-body font-medium px-2 py-0.5 rounded-md"
                style={{ backgroundColor: `${project.accent}12`, color: project.accent }}
              >
                {tag}
              </span>
            ))}
          </div>

          <ArrowRight
            className="w-4 h-4 flex-shrink-0 transition-transform duration-200"
            style={{
              color: hovered ? project.accent : 'var(--muted-foreground)',
              opacity: hovered ? 1 : 0.4,
              transform: hovered ? 'translateX(2px)' : 'translateX(0)',
            }}
          />
        </div>
      </div>
    </motion.div>
  )
}

export function Gallery() {
  const { onMobileMenuToggle } = useLayoutContext()
  return (
    <div className="flex flex-col h-full">
      <TopHeader title="Labs" subtitle="Experiments and explorations" onMenuToggle={onMobileMenuToggle} />
      <div className="flex-1 overflow-auto p-6 lg:p-8">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="mb-6"
        >
          <p className="text-sm font-body text-muted-foreground max-w-xl">
            A space for experiments, prototypes, and side projects. Each card is a self-contained exploration — click to learn more.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {PROJECTS.map((project, i) => (
            <ProjectCard key={project.id} project={project} index={i} />
          ))}
        </div>
      </div>
    </div>
  )
}
