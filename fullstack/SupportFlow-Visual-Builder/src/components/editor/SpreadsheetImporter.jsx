import { useMemo, useState } from 'react'

import { createFlowFromExcelWorkbook } from '../../domain/importExcelFlow.js'
import { createFlowFromJsonText, SAMPLE_FLOW_JSON_TEXT } from '../../domain/importJsonFlow.js'
import {
  createFlowFromSpreadsheet,
  SAMPLE_SPREADSHEET_TEXT,
} from '../../domain/importSpreadsheetFlow.js'

const SOURCE_LABELS = {
  excel: 'Excel workbook',
  json: 'JSON',
  spreadsheet: 'spreadsheet',
}

function getSourceTypeFromFile(fileName) {
  const normalizedName = fileName.toLowerCase()

  if (normalizedName.endsWith('.xlsx')) {
    return 'excel'
  }

  if (normalizedName.endsWith('.json')) {
    return 'json'
  }

  return 'spreadsheet'
}

function getSourceTypeFromText(rawText, preferredSourceType) {
  if (preferredSourceType === 'json') {
    return 'json'
  }

  const trimmed = rawText.trim()

  return trimmed.startsWith('{') || trimmed.startsWith('[') ? 'json' : 'spreadsheet'
}

function createFlowFromText(rawText, sourceType) {
  const resolvedSourceType = getSourceTypeFromText(rawText, sourceType)
  const result =
    resolvedSourceType === 'json'
      ? createFlowFromJsonText(rawText)
      : createFlowFromSpreadsheet(rawText)

  return {
    ...result,
    sourceLabel: SOURCE_LABELS[resolvedSourceType],
  }
}

function getPreview(rawText, sourceType, preparedImport) {
  if (preparedImport) {
    return {
      status: 'ready',
      sourceLabel: preparedImport.sourceLabel,
      nodeCount: preparedImport.flow.nodes.length,
      routeCount: preparedImport.flow.nodes.reduce((count, node) => count + node.options.length, 0),
      warningCount: preparedImport.warnings.length,
    }
  }

  if (!rawText.trim()) {
    return null
  }

  try {
    const result = createFlowFromText(rawText, sourceType)

    return {
      status: 'ready',
      sourceLabel: result.sourceLabel,
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
  const [sourceType, setSourceType] = useState('spreadsheet')
  const [preparedImport, setPreparedImport] = useState(null)
  const [isReadingFile, setIsReadingFile] = useState(false)
  const [error, setError] = useState('')
  const preview = useMemo(
    () => getPreview(rawText, sourceType, preparedImport),
    [rawText, sourceType, preparedImport],
  )

  if (!open) {
    return null
  }

  const resetImportState = () => {
    setRawText('')
    setFileName('')
    setPreparedImport(null)
    setError('')
  }

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    const nextSourceType = getSourceTypeFromFile(file.name)
    setIsReadingFile(true)
    setSourceType(nextSourceType)
    setFileName(file.name)
    setPreparedImport(null)
    setError('')

    try {
      if (nextSourceType === 'excel') {
        const result = await createFlowFromExcelWorkbook(await file.arrayBuffer())

        setRawText('')
        setPreparedImport({
          ...result,
          sourceLabel: SOURCE_LABELS.excel,
        })
      } else {
        setRawText(await file.text())
      }
    } catch (fileError) {
      setRawText('')
      setPreparedImport(null)
      setError(fileError.message || 'Could not read that file. Try JSON, CSV, TSV, or XLSX.')
    } finally {
      setIsReadingFile(false)
      event.target.value = ''
    }
  }

  const handleImport = () => {
    try {
      const result = preparedImport ?? createFlowFromText(rawText, sourceType)

      onImport(result)
      resetImportState()
      setSourceType('spreadsheet')
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
        aria-label="Import flow"
      >
        <header>
          <div>
            <span>Flow Import</span>
            <h2>Build flow from JSON or Excel</h2>
          </div>
          <button type="button" aria-label="Close flow import" onClick={onClose}>
            x
          </button>
        </header>

        <div className="spreadsheet-importer__body">
          <p>
            Paste SupportFlow JSON, paste rows copied from Excel, or upload `.json`, `.xlsx`,
            `.csv`, or `.tsv` files. Spreadsheet headings can use Node ID, Type, Question Text,
            Route Label, and Next Node ID.
          </p>

          <div className="spreadsheet-importer__actions">
            <label>
              <span>Import file</span>
              <input
                type="file"
                accept=".json,.xlsx,.csv,.tsv,.txt,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/tab-separated-values,text/plain"
                onChange={handleFileChange}
              />
            </label>
            <button
              type="button"
              onClick={() => {
                resetImportState()
                setRawText(SAMPLE_SPREADSHEET_TEXT)
                setFileName('sample-pasted-from-excel.tsv')
                setSourceType('spreadsheet')
              }}
            >
              Use sheet sample
            </button>
            <button
              type="button"
              onClick={() => {
                resetImportState()
                setRawText(SAMPLE_FLOW_JSON_TEXT)
                setFileName('sample-flow.json')
                setSourceType('json')
              }}
            >
              Use JSON sample
            </button>
          </div>

          {fileName && <p className="spreadsheet-importer__file">Loaded: {fileName}</p>}

          <label className="spreadsheet-importer__textarea-label" htmlFor="import-source">
            Pasted rows or JSON
          </label>
          <textarea
            id="import-source"
            value={rawText}
            rows="10"
            placeholder="Paste SupportFlow JSON or spreadsheet rows"
            disabled={Boolean(preparedImport)}
            onChange={(event) => {
              setRawText(event.target.value)
              setPreparedImport(null)
              setFileName('')
              setError('')
              setSourceType(getSourceTypeFromText(event.target.value, 'spreadsheet'))
            }}
          />

          {isReadingFile && (
            <div className="spreadsheet-importer__preview" role="status">
              Reading import file...
            </div>
          )}

          {!isReadingFile && preview?.status === 'ready' && (
            <div className="spreadsheet-importer__preview" role="status">
              Ready to create {preview.nodeCount} nodes and {preview.routeCount} routes from{' '}
              {preview.sourceLabel}
              {preview.warningCount > 0 ? ` with ${preview.warningCount} warnings` : ''}.
            </div>
          )}

          {(error || (!isReadingFile && preview?.status === 'error')) && (
            <div className="spreadsheet-importer__error" role="alert">
              {error || preview.message}
            </div>
          )}
        </div>

        <footer>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" disabled={isReadingFile} onClick={handleImport}>
            Create flow
          </button>
        </footer>
      </section>
    </div>
  )
}
