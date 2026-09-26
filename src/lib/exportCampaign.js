import { zipSync } from 'fflate'
import { loadImagesForItems, slugify } from './api'

/**
 * Campaign exports: a spreadsheet (.xlsx for Excel, .csv for Google Sheets) and a ZIP of all post images.
 * Everything runs in the browser from data the campaign page already loads, so no new server code
 * or database access is needed and Row Level Security still applies to every read.
 */

export const EXPORT_COLUMNS = ['Week', 'Date', 'Channel', 'Content Idea', 'Copy', 'Ad Script', 'Creative Brief', 'Assets']

const pad = (n) => String(n).padStart(2, '0')

/**
 * File names for every image, grouped by week, e.g. week-01/2026-10-05_instagram_1.png.
 * Two posts on the same day and channel get _post-2, _post-3 so names never clash.
 * Returns { [itemId]: [{ image, path }] }.
 */
export function assetPaths(items, imagesByItem) {
  const seen = new Map()
  const out = {}
  for (const item of items) {
    const images = imagesByItem[item.id] ?? []
    if (!images.length) continue
    const base = `week-${pad(item.week_number)}/${item.post_date}_${slugify(item.channel)}`
    const n = (seen.get(base) ?? 0) + 1
    seen.set(base, n)
    const stem = n > 1 ? `${base}_post-${n}` : base
    out[item.id] = images.map((image, i) => ({ image, path: `${stem}_${i + 1}.png` }))
  }
  return out
}

/** One row per post, in plan order. The Assets column lists the image file names used in the ZIP. */
export function campaignRows(items, imagesByItem) {
  const paths = assetPaths(items, imagesByItem)
  return items.map((item) => [
    item.week_number,
    item.post_date,
    item.channel,
    item.content_idea ?? '',
    item.copy ?? '',
    item.ad_script ?? '',
    item.creative_brief ?? '',
    (paths[item.id] ?? []).map((p) => p.path).join('\n'),
  ])
}

export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ---- CSV (Google Sheets: File > Import) ---------------------------------------

export function toCsv(rows) {
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const lines = [EXPORT_COLUMNS, ...rows].map((r) => r.map(cell).join(','))
  // The byte-order mark makes Excel and Google Sheets read accents and emojis correctly.
  return new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
}

// ---- XLSX (Excel) -------------------------------------------------------------
// A minimal, valid .xlsx built by hand (an .xlsx is a ZIP of XML files), so we don't need a spreadsheet library.

const enc = new TextEncoder()

// Excel rejects control characters in XML and caps a cell at 32,767 characters.
const xml = (v) =>
  String(v ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .slice(0, 32000)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const colName = (i) => String.fromCharCode(65 + i) // A to H is enough for 8 columns

const COLUMN_WIDTHS = [7, 12, 18, 40, 60, 50, 50, 42]

export function toXlsx(rows, sheetName = 'Campaign') {
  const header = `<row r="1">${EXPORT_COLUMNS.map((h, c) => `<c r="${colName(c)}1" t="inlineStr" s="1"><is><t>${xml(h)}</t></is></c>`).join('')}</row>`
  const body = rows
    .map((row, r) => {
      const ref = (c) => `${colName(c)}${r + 2}`
      const cells = row.map((v, c) =>
        typeof v === 'number'
          ? `<c r="${ref(c)}" s="2"><v>${v}</v></c>`
          : `<c r="${ref(c)}" t="inlineStr" s="2"><is><t xml:space="preserve">${xml(v)}</t></is></c>`,
      )
      return `<row r="${r + 2}">${cells.join('')}</row>`
    })
    .join('')

  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<cols>${COLUMN_WIDTHS.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>
<sheetData>${header}${body}</sheetData>
<autoFilter ref="A1:${colName(EXPORT_COLUMNS.length - 1)}${rows.length + 1}"/>
</worksheet>`

  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="3">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`

  const files = {
    '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`,
    '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
    'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="${xml(sheetName.slice(0, 31))}" sheetId="1" r:id="rId1"/></sheets>
<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'${xml(sheetName.slice(0, 31))}'!$A$1:$${colName(EXPORT_COLUMNS.length - 1)}$${rows.length + 1}</definedName></definedNames>
</workbook>`,
    'xl/_rels/workbook.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
    'xl/worksheets/sheet1.xml': sheet,
    'xl/styles.xml': styles,
  }
  const zipped = zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, enc.encode(v)])))
  return new Blob([zipped], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

// ---- ZIP of all images ------------------------------------------------------------

/**
 * Fetches every image for the campaign and returns a ZIP blob, organised by week.
 * Signed links are refreshed first, so this works even if the page has been open for hours.
 * onProgress(done, total) runs after each image.
 */
export async function zipCampaignImages(items, onProgress) {
  const fresh = await loadImagesForItems(items.map((i) => i.id))
  const paths = Object.values(assetPaths(items, fresh)).flat()
  if (!paths.length) return null

  const files = {}
  let done = 0
  onProgress?.(0, paths.length)
  // Four downloads at a time: quick, without flooding a slow connection.
  const queue = [...paths]
  const worker = async () => {
    while (queue.length) {
      const { image, path } = queue.shift()
      if (!image.url) throw new Error('missing link')
      const res = await fetch(image.url)
      if (!res.ok) throw new Error(`download failed (${res.status})`)
      // PNGs are already compressed, so store them as-is (level 0) to keep this fast.
      files[path] = [new Uint8Array(await res.arrayBuffer()), { level: 0 }]
      onProgress?.(++done, paths.length)
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()])
  return new Blob([zipSync(files)], { type: 'application/zip' })
}
