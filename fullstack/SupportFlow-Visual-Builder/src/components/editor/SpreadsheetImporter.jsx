import { useMemo, useState } from 'react'

import { createFlowFromExcelWorkbook } from '../../domain/importExcelFlow.js'
import { createFlowFromJsonText, SAMPLE_FLOW_JSON_TEXT } from '../../domain/importJsonFlow.js'
import {
  createFlowFromSpreadsheet,
  SAMPLE_SPREADSHEET_TEXT,
} from '../../domain/importSpreadsheetFlow.js'
import { getImportedWorkflowName } from '../../domain/workflowLibrary.js'

const SOURCE_LABELS = {
  excel: 'Excel workbook',
  json: 'JSON',
  spreadsheet: 'spreadsheet',
}

const ALLOWED_FILE_EXTENSIONS = ['.json', '.xlsx', '.csv', '.tsv']
const ALLOWED_FILE_TYPES = [
  'application/json',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/tab-separated-values',
]
const ACCEPTED_FILE_TYPES = [...ALLOWED_FILE_EXTENSIONS, ...ALLOWED_FILE_TYPES].join(',')

function getFileExtension(fileName) {
  const normalizedName = fileName.toLowerCase()

  return ALLOWED_FILE_EXTENSIONS.find((extension) => normalizedName.endsWith(extension)) ?? ''
}

function isAllowedWorkflowFile(file) {
  return Boolean(getFileExtension(file.name))
}

function getSourceTypeFromFile(fileName) {
  const extension = getFileExtension(fileName)

  if (extension === '.xlsx') {
    return 'excel'
  }

  if (extension === '.json') {
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

function getImportSummary(item) {
  return {
    name: getImportedWorkflowName(item.sourceLabel, item.sourceName),
    nodeCount: item.flow.nodes.length,
    routeCount: item.flow.nodes.reduce((count, node) => count + node.options.length, 0),
    warningCount: item.warnings.length,
  }
}

function getPreview(rawText, sourceType, preparedImport, preparedImports) {
  if (preparedImports.length > 0) {
    const workflowSummaries = preparedImports.map(getImportSummary)

    return {
      status: 'ready-batch',
      workflowCount: preparedImports.length,
      nodeCount: workflowSummaries.reduce((count, item) => count + item.nodeCount, 0),
      routeCount: workflowSummaries.reduce((count, item) => count + item.routeCount, 0),
      warningCount: workflowSummaries.reduce((count, item) => count + item.warningCount, 0),
      workflowSummaries,
    }
  }

  if (preparedImport) {
    const workflowSummary = getImportSummary(preparedImport)

    return {
      status: 'ready',
      sourceLabel: preparedImport.sourceLabel,
      nodeCount: workflowSummary.nodeCount,
      routeCount: workflowSummary.routeCount,
      warningCount: workflowSummary.warningCount,
      workflowSummaries: [workflowSummary],
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
      workflowSummaries: [getImportSummary(result)],
    }
  } catch (error) {
    return {
      status: 'error',
      message: error.message,
    }
  }
}

async function createImportFromFile(file) {
  const sourceType = getSourceTypeFromFile(file.name)

  if (sourceType === 'excel') {
    const result = await createFlowFromExcelWorkbook(await file.arrayBuffer())

    return {
      ...result,
      sourceLabel: SOURCE_LABELS.excel,
      sourceName: file.name,
    }
  }

  return {
    ...createFlowFromText(await file.text(), sourceType),
    sourceName: file.name,
  }
}

export default function SpreadsheetImporter({ open, onClose, onImport }) {
  const [rawText, setRawText] = useState('')
  const [fileName, setFileName] = useState('')
  const [uploadedFileName, setUploadedFileName] = useState('')
  const [sourceType, setSourceType] = useState('spreadsheet')
  const [preparedImport, setPreparedImport] = useState(null)
  const [preparedImports, setPreparedImports] = useState([])
  const [isReadingFile, setIsReadingFile] = useState(false)
  const [error, setError] = useState('')
  const preview = useMemo(
    () => getPreview(rawText, sourceType, preparedImport, preparedImports),
    [rawText, sourceType, preparedImport, preparedImports],
  )

  if (!open) {
    return null
  }

  const resetImportState = () => {
    setRawText('')
    setFileName('')
    setUploadedFileName('')
    setPreparedImport(null)
    setPreparedImports([])
    setError('')
  }

  const handleFileChange = async (event) => {
    const files = [...(event.target.files ?? [])]

    if (files.length === 0) {
      return
    }

    const validFiles = files.filter(isAllowedWorkflowFile)
    const rejectedFiles = files.filter((file) => !isAllowedWorkflowFile(file))
    const rejectedFileMessage =
      rejectedFiles.length > 0
        ? `Only .json, .xlsx, .csv, or .tsv workflow files are allowed. Skipped: ${rejectedFiles
            .map((file) => file.name)
            .join(', ')}.`
        : ''

    setIsReadingFile(true)
    setSourceType(
      validFiles.length === 1 ? getSourceTypeFromFile(validFiles[0].name) : 'spreadsheet',
    )
    setFileName(
      validFiles.length > 1 ? `${validFiles.length} files selected` : (validFiles[0]?.name ?? ''),
    )
    setUploadedFileName(validFiles.length === 1 ? (validFiles[0]?.name ?? '') : '')
    setPreparedImport(null)
    setPreparedImports([])
    setRawText('')
    setError(rejectedFileMessage)

    try {
      if (validFiles.length === 0) {
        return
      }

      if (files.length === 1 && validFiles.length === 1) {
        const file = validFiles[0]
        const nextSourceType = getSourceTypeFromFile(file.name)

        setSourceType(nextSourceType)
        setFileName(file.name)
        setUploadedFileName(file.name)

        if (nextSourceType === 'excel') {
          setPreparedImport(await createImportFromFile(file))
        } else {
          setRawText(await file.text())
        }

        return
      }

      const nextPreparedImports = await Promise.all(validFiles.map(createImportFromFile))

      if (nextPreparedImports.length === 1) {
        setRawText('')
        setPreparedImport(nextPreparedImports[0])
      } else {
        setPreparedImports(nextPreparedImports)
      }
    } catch (fileError) {
      setRawText('')
      setPreparedImport(null)
      setPreparedImports([])
      setError(fileError.message || 'Could not read that file. Try JSON, CSV, TSV, or XLSX.')
    } finally {
      setIsReadingFile(false)
      event.target.value = ''
    }
  }

  const handleImport = () => {
    try {
      const result =
        preparedImports.length > 0
          ? preparedImports
          : (preparedImport ?? {
              ...createFlowFromText(rawText, sourceType),
              sourceName: uploadedFileName,
            })

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
            Paste SupportFlow JSON, paste rows copied from Excel, or upload workflow files. You can
            select multiple files at once, and every valid import is saved automatically.
          </p>

          <ul className="spreadsheet-importer__file-types" aria-label="Allowed workflow file types">
            {ALLOWED_FILE_EXTENSIONS.map((extension) => (
              <li key={extension}>{extension}</li>
            ))}
          </ul>

          <div className="spreadsheet-importer__actions">
            <label>
              <span>Import files</span>
              <input
                type="file"
                multiple
                accept={ACCEPTED_FILE_TYPES}
                onChange={handleFileChange}
              />
            </label>
            <button
              type="button"
              onClick={() => {
                resetImportState()
                setRawText(SAMPLE_SPREADSHEET_TEXT)
                setFileName('sample-pasted-from-excel.tsv')
                setUploadedFileName('')
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
                setUploadedFileName('')
                setSourceType('json')
              }}
            >
              Use JSON sample
            </button>
          </div>

          {fileName && <p className="spreadsheet-importer__file">Selected: {fileName}</p>}

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
              setPreparedImports([])
              setFileName('')
              setUploadedFileName('')
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
              <p>
                Ready to create {preview.nodeCount} nodes and {preview.routeCount} routes from{' '}
                {preview.sourceLabel}
                {preview.warningCount > 0 ? ` with ${preview.warningCount} warnings` : ''}.
              </p>
              <ul className="spreadsheet-importer__workflow-preview">
                {preview.workflowSummaries.map((workflow, index) => (
                  <li key={`${workflow.name}-${index}`}>
                    <strong>{workflow.name}</strong>
                    <span>
                      {workflow.nodeCount} nodes · {workflow.routeCount} routes
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!isReadingFile && preview?.status === 'ready-batch' && (
            <div className="spreadsheet-importer__preview" role="status">
              <p>
                Ready to create {preview.workflowCount} workflows with {preview.nodeCount} nodes and{' '}
                {preview.routeCount} routes from selected files
                {preview.warningCount > 0 ? ` with ${preview.warningCount} warnings` : ''}.
              </p>
              <ul className="spreadsheet-importer__workflow-preview">
                {preview.workflowSummaries.map((workflow, index) => (
                  <li key={`${workflow.name}-${index}`}>
                    <strong>{workflow.name}</strong>
                    <span>
                      {workflow.nodeCount} nodes · {workflow.routeCount} routes
                    </span>
                  </li>
                ))}
              </ul>
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
