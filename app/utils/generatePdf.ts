import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// ── Shared types (mirrored from server export.get.ts) ─────────────────────
interface ExportRankingRow {
  rank: number
  name: string
  average: number
  judgeScores?: Record<string, number | null>
  themeAvgs?: Record<string, number>
}

interface ExportBracketRow {
  round: number
  position: number
  p1: string
  p2: string
  winner: string
}

interface ExportParticipantRow {
  number: number
  name: string
}

interface ExportJudgeDetailRow {
  name: string
  themeScores: Record<string, number | null>
  average: number
}

interface ExportJudgeDetail {
  judgeName: string
  participants: ExportJudgeDetailRow[]
}

interface ExportCategory {
  name: string
  type: string
  phase: string
  judgeNames: string[]
  themes: string[]
  participants: ExportParticipantRow[]
  ranking: ExportRankingRow[]
  bracket: ExportBracketRow[]
  judgeDetails: ExportJudgeDetail[]
}

interface ExportPayload {
  eventName: string
  exportedAt: string
  content: 'votes' | 'list'
  categories: ExportCategory[]
}

// ── Palette ──────────────────────────────────────────────────────────────────
const DARK_NAVY = [30, 41, 59] as [number, number, number]      // #1e293b
const ACCENT_BLUE = [59, 130, 246] as [number, number, number]  // #3b82f6
const LIGHT_ROW = [241, 245, 249] as [number, number, number]   // #f1f5f9
const WHITE = [255, 255, 255] as [number, number, number]
const TEXT_DARK = [15, 23, 42] as [number, number, number]       // #0f172a
const TEXT_MUTED = [100, 116, 139] as [number, number, number]  // #64748b
const GOLD = [234, 179, 8] as [number, number, number]          // #eab308 — rank 1
const SILVER = [148, 163, 184] as [number, number, number]      // #94a3b8 — rank 2
const BRONZE = [180, 120, 60] as [number, number, number]       // warm brown — rank 3
const JUDGE_HEADER = [45, 60, 84] as [number, number, number]   // slightly lighter navy for score cols

function rankColor(rank: number): [number, number, number] {
  if (rank === 1) return GOLD
  if (rank === 2) return SILVER
  if (rank === 3) return BRONZE
  return TEXT_DARK
}

function formatPhase(phase: string): string {
  return phase.charAt(0).toUpperCase() + phase.slice(1)
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '-').substring(0, 50) || 'event'
}

export interface PdfOptions {
  content: 'votes' | 'list'
  choreoDetail: 'averaged' | 'full'
}

export function generatePdf(data: ExportPayload, options: PdfOptions): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const marginL = 14
  const marginR = 14
  const contentW = pageW - marginL - marginR

  const isListMode = options.content === 'list'
  const isFullDetail = options.choreoDetail === 'full'

  // ── Page header/footer ────────────────────────────────────────────────────
  function drawPageFrame() {
    doc.setFillColor(...DARK_NAVY)
    doc.rect(0, 0, pageW, 12, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...WHITE)
    doc.text(data.eventName.toUpperCase(), marginL, 8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...TEXT_MUTED)
    doc.text(`Exported ${formatDate(data.exportedAt)}`, pageW - marginR, 8, { align: 'right' })

    doc.setFillColor(...DARK_NAVY)
    doc.rect(0, pageH - 10, pageW, 10, 'F')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...WHITE)
    doc.text('Eventiny', marginL, pageH - 3.5)
  }

  // ── Cover page ────────────────────────────────────────────────────────────
  doc.setFillColor(...DARK_NAVY)
  doc.rect(0, 0, pageW, 60, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(28)
  doc.setTextColor(...WHITE)
  doc.text(data.eventName, pageW / 2, 34, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(...ACCENT_BLUE)
  doc.text(isListMode ? 'Participant List' : 'Results Export', pageW / 2, 44, { align: 'center' })

  doc.setFontSize(9)
  doc.setTextColor(...TEXT_MUTED)
  doc.text(`Exported on ${formatDate(data.exportedAt)}`, pageW / 2, 52, { align: 'center' })

  // Category summary
  let cy = 74
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...TEXT_DARK)
  doc.text(`${data.categories.length} ${data.categories.length === 1 ? 'Category' : 'Categories'}`, marginL, cy)
  cy += 6

  for (const cat of data.categories) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...TEXT_MUTED)
    doc.text(`• ${cat.name}  (${cat.type} · ${formatPhase(cat.phase)})`, marginL + 3, cy)
    cy += 5.5
  }

  // Cover bottom bar
  doc.setFillColor(...DARK_NAVY)
  doc.rect(0, pageH - 10, pageW, 10, 'F')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...WHITE)
  doc.text('Eventiny', marginL, pageH - 3.5)

  // ── Category pages ────────────────────────────────────────────────────────
  for (const cat of data.categories) {
    doc.addPage()
    drawPageFrame()

    let y = 18

    // Category banner
    doc.setFillColor(...ACCENT_BLUE)
    doc.rect(marginL, y, contentW, 11, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(...WHITE)
    doc.text(cat.name.toUpperCase(), marginL + 4, y + 7.5)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text(`${cat.type.toUpperCase()}  ·  ${formatPhase(cat.phase)}`, pageW - marginR - 4, y + 7.5, { align: 'right' })
    y += 17

    // ── LIST MODE ─────────────────────────────────────────────────────────
    if (isListMode) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(...TEXT_DARK)
      doc.text('PARTICIPANT LIST', marginL, y)
      y += 4

      if (cat.participants.length === 0) {
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(8.5)
        doc.setTextColor(...TEXT_MUTED)
        doc.text('No participants registered.', marginL, y + 6)
      } else {
        autoTable(doc, {
          startY: y,
          head: [['#', 'Participant']],
          body: cat.participants.map((p: ExportParticipantRow) => [String(p.number), p.name]),
          margin: { left: marginL, right: marginR },
          styles: {
            font: 'helvetica',
            fontSize: 9,
            cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
            textColor: TEXT_DARK,
            lineColor: [226, 232, 240],
            lineWidth: 0.2,
          },
          headStyles: { fillColor: DARK_NAVY, textColor: WHITE, fontStyle: 'bold', fontSize: 8.5 },
          alternateRowStyles: { fillColor: LIGHT_ROW },
          columnStyles: {
            0: { halign: 'center', fontStyle: 'bold', cellWidth: 14 },
          },
          didDrawPage() { drawPageFrame() },
        })
      }
      continue
    }

    // ── VOTES MODE ────────────────────────────────────────────────────────

    // Averaged or Full Detail choreo
    const isChoreoFull = isFullDetail && cat.themes.length > 0

    if (cat.ranking.length > 0) {
      const rankingLabel = cat.themes.length > 0 ? 'CHOREO RANKING' : 'PRESELECTION RANKING'
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(...TEXT_DARK)
      doc.text(rankingLabel, marginL, y)
      y += 4

      if (isChoreoFull) {
        // Summary table: rank | name | overall avg only (compact)
        autoTable(doc, {
          startY: y,
          head: [['#', 'Participant', 'Overall Avg']],
          body: cat.ranking.map((row: ExportRankingRow) => [String(row.rank), row.name, String(row.average)]),
          margin: { left: marginL, right: marginR },
          tableWidth: 100,
          styles: {
            font: 'helvetica',
            fontSize: 8.5,
            cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
            textColor: TEXT_DARK,
            lineColor: [226, 232, 240],
            lineWidth: 0.2,
          },
          headStyles: { fillColor: DARK_NAVY, textColor: WHITE, fontStyle: 'bold', fontSize: 8 },
          alternateRowStyles: { fillColor: LIGHT_ROW },
          columnStyles: {
            0: { halign: 'center', fontStyle: 'bold', cellWidth: 10 },
            2: { halign: 'center', fontStyle: 'bold', cellWidth: 24 },
          },
          didParseCell(hookData) {
            if (hookData.section === 'body' && hookData.column.index === 0) {
              const rank = parseInt(hookData.cell.raw as string)
              if (rank <= 3) {
                hookData.cell.styles.textColor = rankColor(rank)
                hookData.cell.styles.fontStyle = 'bold'
              }
            }
          },
          didDrawPage() { drawPageFrame() },
        })

        y = (doc as any).lastAutoTable.finalY + 10

        // Per-judge sub-tables
        for (const judgeDetail of cat.judgeDetails) {
          if (y > pageH - 60) {
            doc.addPage()
            drawPageFrame()
            y = 18
          }

          // Judge label bar
          doc.setFillColor(...JUDGE_HEADER)
          doc.rect(marginL, y, contentW, 8, 'F')
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(8)
          doc.setTextColor(...WHITE)
          doc.text(`JUDGE: ${judgeDetail.judgeName.toUpperCase()}`, marginL + 3, y + 5.5)
          y += 10

          const themeHead = ['Participant', ...cat.themes, 'Avg']
          const themeBody = judgeDetail.participants.map((p: ExportJudgeDetailRow) => [
            p.name,
            ...cat.themes.map((t: string) => p.themeScores[t] !== null && p.themeScores[t] !== undefined ? String(p.themeScores[t]) : '—'),
            String(p.average),
          ])

          autoTable(doc, {
            startY: y,
            head: [themeHead],
            body: themeBody,
            margin: { left: marginL, right: marginR },
            styles: {
              font: 'helvetica',
              fontSize: 8,
              cellPadding: { top: 2, bottom: 2, left: 3, right: 3 },
              textColor: TEXT_DARK,
              lineColor: [226, 232, 240],
              lineWidth: 0.2,
            },
            headStyles: { fillColor: DARK_NAVY, textColor: WHITE, fontStyle: 'bold', fontSize: 7.5 },
            alternateRowStyles: { fillColor: LIGHT_ROW },
            columnStyles: {
              0: { cellWidth: 'auto' },
              [themeHead.length - 1]: { halign: 'center', fontStyle: 'bold', cellWidth: 18 },
            },
            didParseCell(hookData) {
              if (hookData.section === 'head' && hookData.column.index >= 1 && hookData.column.index < themeHead.length - 1) {
                hookData.cell.styles.fillColor = JUDGE_HEADER
              }
            },
            didDrawPage() { drawPageFrame() },
          })

          y = (doc as any).lastAutoTable.finalY + 8
        }
      } else {
        // Averaged mode (default)
        const scoreColumns = cat.themes.length > 0 ? cat.themes : cat.judgeNames
        const head = [['#', 'Participant', 'Avg', ...scoreColumns]]
        const body = cat.ranking.map((row: ExportRankingRow) => {
          const scores = scoreColumns.map((col: string) => {
            const val = cat.themes.length > 0
              ? (row.themeAvgs?.[col] ?? 0)
              : (row.judgeScores?.[col] ?? '-')
            return val === null ? '-' : String(val)
          })
          return [String(row.rank), row.name, String(row.average), ...scores]
        })

        autoTable(doc, {
          startY: y,
          head,
          body,
          margin: { left: marginL, right: marginR },
          styles: {
            font: 'helvetica',
            fontSize: 8.5,
            cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
            textColor: TEXT_DARK,
            lineColor: [226, 232, 240],
            lineWidth: 0.2,
          },
          headStyles: { fillColor: DARK_NAVY, textColor: WHITE, fontStyle: 'bold', fontSize: 8 },
          alternateRowStyles: { fillColor: LIGHT_ROW },
          columnStyles: {
            0: { halign: 'center', fontStyle: 'bold', cellWidth: 10 },
            2: { halign: 'center', fontStyle: 'bold', cellWidth: 18 },
          },
          didParseCell(hookData) {
            if (hookData.section === 'body' && hookData.column.index === 0) {
              const rank = parseInt(hookData.cell.raw as string)
              if (rank <= 3) {
                hookData.cell.styles.textColor = rankColor(rank)
                hookData.cell.styles.fontStyle = 'bold'
              }
            }
            if (hookData.section === 'head' && hookData.column.index >= 3) {
              hookData.cell.styles.fillColor = JUDGE_HEADER
            }
          },
          didDrawPage() { drawPageFrame() },
        })

        y = (doc as any).lastAutoTable.finalY + 8
      }
    } else {
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(8.5)
      doc.setTextColor(...TEXT_MUTED)
      doc.text('No ranking data available yet.', marginL, y + 6)
      y += 14
    }

    // ── Bracket results ───────────────────────────────────────────────────
    if (cat.bracket.length > 0) {
      if (y > pageH - 60) {
        doc.addPage()
        drawPageFrame()
        y = 18
      }

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(...TEXT_DARK)
      doc.text('BATTLE BRACKET', marginL, y)
      y += 4

      autoTable(doc, {
        startY: y,
        head: [['Round', 'Match', 'Participant 1', 'Participant 2', 'Winner']],
        body: cat.bracket.map((row: ExportBracketRow) => [
          `Round ${row.round}`,
          `#${row.position}`,
          row.p1,
          row.p2,
          row.winner || '—',
        ]),
        margin: { left: marginL, right: marginR },
        styles: {
          font: 'helvetica',
          fontSize: 8.5,
          cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
          textColor: TEXT_DARK,
          lineColor: [226, 232, 240],
          lineWidth: 0.2,
        },
        headStyles: { fillColor: DARK_NAVY, textColor: WHITE, fontStyle: 'bold', fontSize: 8 },
        alternateRowStyles: { fillColor: LIGHT_ROW },
        columnStyles: {
          0: { cellWidth: 22 },
          1: { cellWidth: 16, halign: 'center' },
          4: { fontStyle: 'bold' },
        },
        didParseCell(hookData) {
          if (hookData.section === 'body' && hookData.column.index === 4 && hookData.cell.raw && hookData.cell.raw !== '—') {
            hookData.cell.styles.textColor = ACCENT_BLUE
            hookData.cell.styles.fontStyle = 'bold'
          }
          if (hookData.section === 'body') {
            const rawRow = hookData.row.raw as string[] | undefined
            const round = rawRow?.[0] ? parseInt(rawRow[0].replace('Round ', '')) : 0
            if (round % 2 === 0) hookData.cell.styles.fillColor = [235, 242, 252]
          }
        },
        didDrawPage() { drawPageFrame() },
      })
    }
  }

  // ── Page numbers ──────────────────────────────────────────────────────────
  const totalPages = (doc.internal as any).pages.length - 1
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...TEXT_MUTED)
    doc.text(`Page ${i} of ${totalPages}`, pageW / 2, pageH - 3.5, { align: 'center' })
  }

  doc.save(`${sanitizeFilename(data.eventName)}-export.pdf`)
}

