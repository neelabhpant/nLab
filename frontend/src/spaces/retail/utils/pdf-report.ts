import { jsPDF } from 'jspdf'

export interface StructuredReport {
  executive_summary: string
  key_theme_analysis: string
  story_analyses: {
    title: string
    source: string
    relevance: number
    analysis: string
  }[]
  use_case_opportunities: {
    title: string
    confidence: number
    problem: string
    solution: string
    architecture: string
    why_we_win: string
  }[]
  recommended_actions: string[]
  meta: {
    date: string
    top_theme: string
    theme_summary: string
    article_count: number
    source_breakdown: Record<string, number>
  }
}

const COLORS = {
  navy: [15, 23, 42] as [number, number, number],
  darkSlate: [30, 41, 59] as [number, number, number],
  slate700: [51, 65, 85] as [number, number, number],
  slate500: [100, 116, 139] as [number, number, number],
  slate400: [148, 163, 184] as [number, number, number],
  slate200: [226, 232, 240] as [number, number, number],
  slate100: [241, 245, 249] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  sky600: [2, 132, 199] as [number, number, number],
  sky100: [224, 242, 254] as [number, number, number],
  amber600: [217, 119, 6] as [number, number, number],
  amber50: [255, 251, 235] as [number, number, number],
  emerald600: [5, 150, 105] as [number, number, number],
  emerald50: [236, 253, 245] as [number, number, number],
  teal600: [13, 148, 136] as [number, number, number],
  teal50: [240, 253, 250] as [number, number, number],
  red50: [254, 242, 242] as [number, number, number],
  red600: [220, 38, 38] as [number, number, number],
}

const PAGE_WIDTH = 210
const PAGE_HEIGHT = 297
const MARGIN_LEFT = 18
const MARGIN_RIGHT = 18
const MARGIN_TOP = 20
const MARGIN_BOTTOM = 20
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT

function checkPage(pdf: jsPDF, y: number, needed: number): number {
  if (y + needed > PAGE_HEIGHT - MARGIN_BOTTOM) {
    pdf.addPage()
    return MARGIN_TOP
  }
  return y
}

function drawDivider(pdf: jsPDF, y: number, color = COLORS.slate200): number {
  y = checkPage(pdf, y, 8)
  pdf.setDrawColor(...color)
  pdf.setLineWidth(0.3)
  pdf.line(MARGIN_LEFT, y, PAGE_WIDTH - MARGIN_RIGHT, y)
  return y + 6
}

function wrapText(pdf: jsPDF, text: string, maxWidth: number): string[] {
  return pdf.splitTextToSize(text, maxWidth) as string[]
}

function drawSectionHeader(pdf: jsPDF, y: number, title: string, accentColor: [number, number, number]): number {
  y = checkPage(pdf, y, 16)
  pdf.setFillColor(...accentColor)
  pdf.roundedRect(MARGIN_LEFT, y, 3, 10, 1.5, 1.5, 'F')
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(13)
  pdf.setTextColor(...COLORS.navy)
  pdf.text(title.toUpperCase(), MARGIN_LEFT + 7, y + 7.5)
  return y + 16
}

function drawParagraph(pdf: jsPDF, y: number, text: string, fontSize = 9.5, color = COLORS.slate700, lineHeight = 4.5): number {
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(fontSize)
  pdf.setTextColor(...color)
  const paragraphs = text.split('\n\n')
  for (const para of paragraphs) {
    const lines = wrapText(pdf, para.trim(), CONTENT_WIDTH)
    for (const line of lines) {
      y = checkPage(pdf, y, lineHeight + 2)
      pdf.text(line, MARGIN_LEFT, y)
      y += lineHeight
    }
    y += 2
  }
  return y
}

function drawBadge(pdf: jsPDF, x: number, y: number, label: string, bg: [number, number, number], fg: [number, number, number]): number {
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(8)
  const w = pdf.getTextWidth(label) + 6
  pdf.setFillColor(...bg)
  pdf.roundedRect(x, y - 4.5, w, 7, 2, 2, 'F')
  pdf.setTextColor(...fg)
  pdf.text(label, x + 3, y)
  return x + w + 3
}

export function generateProfessionalPDF(report: StructuredReport): void {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  let y = 0

  const dateFormatted = new Date(report.meta.date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  // --- HEADER BAND ---
  pdf.setFillColor(...COLORS.navy)
  pdf.rect(0, 0, PAGE_WIDTH, 52, 'F')

  pdf.setFillColor(...COLORS.sky600)
  pdf.rect(0, 52, PAGE_WIDTH, 2, 'F')

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(9)
  pdf.setTextColor(...COLORS.sky600)
  pdf.text('RETAIL INTELLIGENCE', MARGIN_LEFT, 16)

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(22)
  pdf.setTextColor(...COLORS.white)
  pdf.text('Executive Briefing', MARGIN_LEFT, 30)

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  pdf.setTextColor(...COLORS.slate400)
  pdf.text(dateFormatted, MARGIN_LEFT, 40)

  const sourceCount = Object.keys(report.meta.source_breakdown).length
  const statsText = `${report.meta.article_count} Articles  |  ${sourceCount} Sources  |  ${report.story_analyses.length} Key Stories`
  pdf.text(statsText, MARGIN_LEFT, 47)

  y = 62

  // --- TOP THEME ---
  y = checkPage(pdf, y, 30)
  pdf.setFillColor(...COLORS.sky100)
  const themeLines = wrapText(pdf, report.meta.top_theme, CONTENT_WIDTH - 14)
  const summaryPreview = report.meta.theme_summary.length > 200
    ? report.meta.theme_summary.substring(0, 200) + '...'
    : report.meta.theme_summary
  const summaryLines = wrapText(pdf, summaryPreview, CONTENT_WIDTH - 14)
  const themeBoxH = 12 + themeLines.length * 6 + summaryLines.length * 4.5 + 4
  pdf.roundedRect(MARGIN_LEFT, y, CONTENT_WIDTH, themeBoxH, 3, 3, 'F')

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(8)
  pdf.setTextColor(...COLORS.sky600)
  pdf.text("TODAY'S THEME", MARGIN_LEFT + 7, y + 8)

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(12)
  pdf.setTextColor(...COLORS.navy)
  let themeY = y + 16
  for (const line of themeLines) {
    pdf.text(line, MARGIN_LEFT + 7, themeY)
    themeY += 6
  }

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.setTextColor(...COLORS.slate700)
  for (const line of summaryLines) {
    pdf.text(line, MARGIN_LEFT + 7, themeY)
    themeY += 4.5
  }

  y += themeBoxH + 8

  // --- EXECUTIVE SUMMARY ---
  y = drawSectionHeader(pdf, y, 'Executive Summary', COLORS.sky600)
  y = drawParagraph(pdf, y, report.executive_summary)
  y += 2

  // --- KEY THEME ANALYSIS ---
  y = drawDivider(pdf, y)
  y = drawSectionHeader(pdf, y, 'Key Theme Analysis', COLORS.teal600)
  y = drawParagraph(pdf, y, report.key_theme_analysis)
  y += 2

  // --- TOP STORIES ---
  y = drawDivider(pdf, y)
  y = drawSectionHeader(pdf, y, 'Top Stories & Analysis', COLORS.emerald600)

  for (const story of report.story_analyses) {
    y = checkPage(pdf, y, 30)

    pdf.setFillColor(...COLORS.slate100)
    const titleLines = wrapText(pdf, story.title, CONTENT_WIDTH - 10)
    const analysisLines = wrapText(pdf, story.analysis, CONTENT_WIDTH - 10)
    const cardH = 8 + titleLines.length * 5 + 6 + analysisLines.length * 4.5 + 8
    pdf.roundedRect(MARGIN_LEFT, y, CONTENT_WIDTH, cardH, 2, 2, 'F')

    const relevColor = story.relevance >= 70 ? COLORS.emerald600 : story.relevance >= 40 ? COLORS.amber600 : COLORS.slate500
    pdf.setFillColor(...relevColor)
    pdf.roundedRect(MARGIN_LEFT, y, 3, cardH, 1.5, 1.5, 'F')

    let cardY = y + 6
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(10)
    pdf.setTextColor(...COLORS.navy)
    for (const line of titleLines) {
      pdf.text(line, MARGIN_LEFT + 7, cardY)
      cardY += 5
    }

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(...COLORS.slate500)
    const metaText = `${story.source}  |  Relevance: ${story.relevance}/100`
    pdf.text(metaText, MARGIN_LEFT + 7, cardY)
    cardY += 6

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.setTextColor(...COLORS.slate700)
    for (const line of analysisLines) {
      pdf.text(line, MARGIN_LEFT + 7, cardY)
      cardY += 4.5
    }

    y += cardH + 4
  }

  y += 2

  // --- USE CASE OPPORTUNITIES ---
  y = drawDivider(pdf, y)
  y = drawSectionHeader(pdf, y, 'Use Case Opportunities', COLORS.amber600)

  for (const uc of report.use_case_opportunities) {
    y = checkPage(pdf, y, 50)

    pdf.setFillColor(...COLORS.white)
    pdf.setDrawColor(...COLORS.slate200)

    const sections = [
      { label: 'THE PROBLEM', text: uc.problem },
      { label: 'THE SOLUTION', text: uc.solution },
      { label: 'ARCHITECTURE', text: uc.architecture },
      { label: 'WHY WE WIN', text: uc.why_we_win },
    ]

    let totalH = 14
    const sectionLines: string[][] = []
    for (const s of sections) {
      const lines = wrapText(pdf, s.text, CONTENT_WIDTH - 16)
      sectionLines.push(lines)
      totalH += 8 + lines.length * 4.5
    }

    pdf.roundedRect(MARGIN_LEFT, y, CONTENT_WIDTH, totalH, 2, 2, 'FD')

    let ucY = y + 7
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(10.5)
    pdf.setTextColor(...COLORS.navy)
    pdf.text(uc.title, MARGIN_LEFT + 6, ucY)

    const confLabel = `${uc.confidence}%`
    const confBg = uc.confidence >= 75 ? COLORS.emerald50 : COLORS.amber50
    const confFg = uc.confidence >= 75 ? COLORS.emerald600 : COLORS.amber600
    drawBadge(pdf, MARGIN_LEFT + 6 + pdf.getTextWidth(uc.title) + 4, ucY, confLabel, confBg, confFg)
    ucY += 8

    for (let i = 0; i < sections.length; i++) {
      y = checkPage(pdf, ucY, 12)
      if (y !== ucY) {
        ucY = y
      }

      const labelColor = i === 3 ? COLORS.teal600 : COLORS.slate500
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(7.5)
      pdf.setTextColor(...labelColor)
      pdf.text(sections[i].label, MARGIN_LEFT + 6, ucY)
      ucY += 4

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(9)
      pdf.setTextColor(...COLORS.slate700)
      for (const line of sectionLines[i]) {
        ucY = checkPage(pdf, ucY, 5)
        pdf.text(line, MARGIN_LEFT + 6, ucY)
        ucY += 4.5
      }
      ucY += 3
    }

    y = ucY + 4
  }

  // --- RECOMMENDED ACTIONS ---
  y = drawDivider(pdf, y)
  y = drawSectionHeader(pdf, y, 'Recommended Actions', COLORS.red600)

  for (let i = 0; i < report.recommended_actions.length; i++) {
    y = checkPage(pdf, y, 12)

    const numCircleX = MARGIN_LEFT + 4
    pdf.setFillColor(...COLORS.sky600)
    pdf.circle(numCircleX, y - 1.5, 3, 'F')
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(8)
    pdf.setTextColor(...COLORS.white)
    pdf.text(String(i + 1), numCircleX - 1.5, y)

    const actionLines = wrapText(pdf, report.recommended_actions[i], CONTENT_WIDTH - 16)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9.5)
    pdf.setTextColor(...COLORS.slate700)
    let actionY = y
    for (const line of actionLines) {
      actionY = checkPage(pdf, actionY, 5)
      pdf.text(line, MARGIN_LEFT + 12, actionY)
      actionY += 4.5
    }
    y = actionY + 3
  }

  // --- FOOTER ---
  y = checkPage(pdf, y, 20)
  y += 4
  pdf.setDrawColor(...COLORS.slate200)
  pdf.setLineWidth(0.3)
  pdf.line(MARGIN_LEFT, y, PAGE_WIDTH - MARGIN_RIGHT, y)
  y += 6

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(7.5)
  pdf.setTextColor(...COLORS.slate400)
  pdf.text('Generated by nLab Retail Intelligence', MARGIN_LEFT, y)
  pdf.text('Confidential — For internal use only', PAGE_WIDTH - MARGIN_RIGHT, y, { align: 'right' })

  // --- PAGE NUMBERS ---
  const totalPages = pdf.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7)
    pdf.setTextColor(...COLORS.slate400)
    pdf.text(`Page ${i} of ${totalPages}`, PAGE_WIDTH - MARGIN_RIGHT, PAGE_HEIGHT - 10, { align: 'right' })
  }

  pdf.save(`retail-briefing-${report.meta.date}.pdf`)
}
