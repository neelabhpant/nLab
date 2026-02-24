export type ProjectStatus = 'Active' | 'In Progress' | 'Concept'

export interface Project {
  id: string
  name: string
  description: string
  tags: string[]
  status: ProjectStatus
  accent: string
}

export const PROJECTS: Project[] = [
  {
    id: 'function-to-music',
    name: 'Function to Music',
    description:
      'Convert mathematical functions into musical compositions. Map each point on a curve to a note — pitch from Y values, rhythm from X intervals. Hear what sine waves, fractals, and stock charts sound like.',
    tags: ['Python', 'Audio', 'Math', 'Creative'],
    status: 'Active',
    accent: '#BD6BFF',
  },
  {
    id: 'agent-workflow-engine',
    name: 'Agent Workflow Engine',
    description:
      'Autonomous AI agents that chain tasks and tools into workflows. Define goals, let agents decompose them into steps, select tools, and execute — with human-in-the-loop checkpoints.',
    tags: ['AI', 'CrewAI', 'Automation'],
    status: 'In Progress',
    accent: '#F5A623',
  },
]
