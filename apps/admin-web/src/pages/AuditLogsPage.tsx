import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { AdminAuditLogEntry } from '../api/types'

export function AuditLogsPage() {
  const [items, setItems] = useState<AdminAuditLogEntry[]>([])
  const [adminUserId, setAdminUserId] = useState('')
  const [resourceType, setResourceType] = useState('')

  function refresh() {
    api
      .listAuditLogs({
        admin_user_id: adminUserId ? Number(adminUserId) : undefined,
        resource_type: resourceType || undefined,
      })
      .then((res) => setItems(res.audit_logs))
  }

  useEffect(refresh, [adminUserId, resourceType])

  return (
    <div className="container">
      <h1>Audit log</h1>
      <p className="muted">
        One row per mutating admin request (POST/PATCH/PUT/DELETE). Read-only requests aren't
        logged here.
      </p>

      <input
        placeholder="Filter by admin account ID"
        value={adminUserId}
        onChange={(e) => setAdminUserId(e.target.value)}
      />{' '}
      <input
        placeholder="Filter by resource type (e.g. Shop)"
        value={resourceType}
        onChange={(e) => setResourceType(e.target.value)}
      />

      <table>
        <thead>
          <tr>
            <th>ID</th><th>Admin</th><th>Method</th><th>Path</th><th>Action</th>
            <th>Resource</th><th>Status</th><th>When</th>
          </tr>
        </thead>
        <tbody>
          {items.map((e) => (
            <tr key={e.id}>
              <td>{e.id}</td>
              <td>{e.admin_user_id ?? '—'}</td>
              <td>{e.http_method}</td>
              <td>{e.path}</td>
              <td>{e.controller}#{e.action}</td>
              <td>{e.resource_type ? `${e.resource_type} ${e.resource_id ?? ''}`.trim() : '—'}</td>
              <td>{e.status_code}</td>
              <td>{e.created_at}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {items.length === 0 && <p>No audit log entries.</p>}
    </div>
  )
}
