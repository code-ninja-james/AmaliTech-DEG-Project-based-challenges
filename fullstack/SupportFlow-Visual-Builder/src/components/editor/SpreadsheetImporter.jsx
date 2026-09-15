import { useMemo, useState } from 'react'

import {
  createFlowFromSpreadsheet,
  SAMPLE_SPREADSHEET_TEXT,
} from '../../domain/importSpreadsheetFlow.js'

function getPreview(rawText) {
  if (!rawText.trim()) {
    return null
  }

  try {
    const result = createFlowFromSpreadsheet(rawText)

    return {
      status: 'ready',
      nodeCount: result.flow.nodes.length,
      routeCount: result.flow.nodes.reduce((count, node) => count + node.options.length, 0),
      warningCount: result.warnings.length,
    }
  } catch (error) {
    return {
      status: 'error',
      message: error.message,
    }
  }
}

export default function SpreadsheetImporter({ open, onClose, onImport }) {
  const [rawText, setRawText] = useState('')
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const preview = useMemo(() => getPreview(rawText), [rawText])

  if (!open) {
    return null
  }

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    try {
      const text = await file.text()

      setRawText(text)
      setFileName(file.name)
      setError('')
    } catch {
      setError('Could not read that file. Export the Excel sheet as CSV/TSV and try again.')
    }
  }

  const handleImport = () => {
    try {
      const result = createFlowFromSpreadsheet(rawText)

      onImport(result)
      setRawText('')
      setFileName('')
      setError('')
    } catch (importError) {
      setError(importError.message)
    }
  }

  return (
    <div
      className="spreadsheet-importer__backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <section
        className="spreadsheet-importer"
        role="dialog"
        aria-modal="true"
        aria-label="Import spreadsheet flow"
      >
        <header>
          <div>
            <span>Spreadsheet Import</span>
            <h2>Build flow from Excel rows</h2>
          </div>
          <button type="button" aria-label="Close spreadsheet import" onClick={onClose}>
            x
          </button>
        </header>

        <div className="spreadsheet-importer__body">
          <p>
            Paste rows copied from Excel, or upload a CSV/TSV export. Use headings like Node ID,
            Type, Question Text, Route Label, and Next Node ID.
          </p>

          <div className="spreadsheet-importer__actions">
            <label>
              <span>CSV/TSV file</span>
              <input type="file" accept=".csv,.tsv,.txt" onChange={handleFileChange} />
            </label>
            <button
              type="button"
              onClick={() => {
                setRawText(SAMPLE_SPREADSHEET_TEXT)
                setFileName('sample-pasted-from-excel.tsv')
                setError('')
              }}
            >
              Use sample
            </button>
          </div>

          {fileName && <p className="spreadsheet-importer__file">Loaded: {fileName}</p>}

          <label className="spreadsheet-importer__textarea-label" htmlFor="spreadsheet-rows">
            Spreadsheet rows
          </label>
          <textarea
            id="spreadsheet-rows"
            value={rawText}
            rows="10"
            placeholder="Node ID, Type, Question Text, Route Label, Next Node ID"
            onChange={(event) => {
              setRawText(event.target.value)
              setError('')
            }}
          />

          {preview?.status === 'ready' && (
            <div className="spreadsheet-importer__preview" role="status">
              Ready to create {preview.nodeCount} nodes and {preview.routeCount} routes
              {preview.warningCount > 0 ? ` with ${preview.warningCount} warnings` : ''}.
            </div>
          )}

          {(error || preview?.status === 'error') && (
            <div className="spreadsheet-importer__error" role="alert">
              {error || preview.message}
            </div>
          )}
        </div>

        <footer>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" onClick={handleImport}>
            Create flow
          </button>
        </footer>
      </section>
    </div>
  )
}
