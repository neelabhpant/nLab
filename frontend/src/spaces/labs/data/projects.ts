export type ProjectStatus = 'Active' | 'In Progress' | 'Concept'

export interface Project {
  id: string
  name: string
  description: string
  tags: string[]
  status: ProjectStatus
  accent: string
  route?: string
}

export const PROJECTS: Project[] = [
  {
    id: 'openclaw',
    name: 'OpenClaw Lite',
    description:
      'A personal AI agent playground inspired by OpenClaw. Configure skills, define the agent\'s soul, and chat with a gateway-powered assistant that can search the web, do math, and remember things.',
    tags: ['AI', 'Agents', 'Skills', 'OpenClaw'],
    status: 'Active',
    accent: '#FF6B35',
    route: '/labs/openclaw',
  },
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
    id: 'crew-canvas',
    name: 'Crew Canvas',
    description:
      'Design, observe, and learn how multi-agent AI crews work. Describe a goal, watch it decompose into specialized agents, and observe real-time execution with tool calls, handoffs, and results.',
    tags: ['AI', 'CrewAI', 'Education', 'Agents'],
    status: 'Active',
    accent: '#00D4FF',
    route: '/labs/workshop',
  },
]
