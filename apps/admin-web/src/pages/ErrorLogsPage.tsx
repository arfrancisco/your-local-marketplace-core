import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { AdminErrorLog } from '../api/types'

const SOURCES = ['backend', 'customer-web', 'vendor-web', 'admin-web', 'client-unknown']

export function ErrorLogsPage() {
  const [items, setItems] = useState<AdminErrorLog[]>([])
  const [resolved, setResolved] = useState('false')
  const [source, setSource] = useState('')
  // The list omits backtraces (they are large); clicking a row fetches the
  // detail record, which includes one.
  const [selected, setSelected] = useState<AdminErrorLog | null>(null)

  function refresh() {
    api.listErrorLogs({ resolved, source }).then((res) => setItems(res.error_logs))
  }

  useEffect(refresh, [resolved, source])

  function open(id: number) {
    api.getErrorLog(id).then((res) => setSelected(res.error_log))
  }

  function toggleResolved(errorLog: AdminErrorLog) {
    const action = errorLog.resolved ? api.reopenErrorLog : api.resolveErrorLog
    action(errorLog.id).then((res) => {
      refresh()
      setSelected((current) => (current && current.id === errorLog.id ? res.error_log : current))
    })
  }

  return (
    <div className="container">
      <h1>Error logs</h1>
      <p>
        One row per distinct error, deduped by fingerprint. Repeats increment the occurrence count
        rather than adding rows, and only the first occurrence sends an email alert.
      </p>

      <select value={resolved} onChange={(e) => setResolved(e.target.value)}>
        <option value="false">Unresolved</option>
        <option value="true">Resolved</option>
        <option value="">All</option>
      </select>
      <select value={source} onChange={(e) => setSource(e.target.value)}>
        <option value="">All sources</option>
        {SOURCES.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>

      <table>
        <thead>
          <tr>
            <th>Source</th><th>Error</th><th>Where</th><th>Count</th>
            <th>First seen</th><th>Last seen</th><th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((e) => (
            <tr key={e.id}>
              <td>{e.source}</td>
              <td>
                <button type="button" onClick={() => open(e.id)}>
                  {e.exception_class}
                </button>
                <div>{e.message}</div>
              </td>
              <td>{e.request_path ? `${e.request_method ?? ''} ${e.request_path}`.trim() : '—'}</td>
              <td>{e.occurrences_count}</td>
              <td>{e.first_seen_at}</td>
              <td>{e.last_seen_at}</td>
              <td>
                <button type="button" onClick={() => toggleResolved(e)}>
                  {e.resolved ? 'Reopen' : 'Resolve'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {items.length === 0 && <p>No errors logged.</p>}

      {selected && (
        <div>
          <h2>
            {selected.exception_class} ({selected.source})
          </h2>
          <button type="button" onClick={() => setSelected(null)}>Close</button>
          <p>{selected.message}</p>
          <dl>
            <dt>Occurrences</dt><dd>{selected.occurrences_count}</dd>
            <dt>First seen</dt><dd>{selected.first_seen_at}</dd>
            <dt>Last seen</dt><dd>{selected.last_seen_at}</dd>
            <dt>Where</dt><dd>{selected.request_path ?? '—'}</dd>
            <dt>User</dt><dd>{selected.user_id ?? 'anonymous'}</dd>
            <dt>Fingerprint</dt><dd>{selected.fingerprint}</dd>
          </dl>
          <h3>Backtrace</h3>
          <pre style={{ overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
            {selected.backtrace ?? '(none recorded)'}
          </pre>
          <button type="button" onClick={() => toggleResolved(selected)}>
            {selected.resolved ? 'Reopen' : 'Resolve'}
          </button>
        </div>
      )}
    </div>
  )
}
