import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { AdminTag } from '../api/types'

export function TagsPage() {
  const [tags, setTags] = useState<AdminTag[]>([])

  function refresh() {
    api.listTags().then((res) => setTags(res.tags))
  }

  useEffect(refresh, [])

  return (
    <div className="container">
      <h1>Tags</h1>
      <table>
        <thead><tr><th>Name</th><th>Item count</th><th></th></tr></thead>
        <tbody>
          {tags.map((t) => (
            <tr key={t.id}>
              <td>{t.name}</td>
              <td>{t.item_count}</td>
              <td>
                <button
                  onClick={() => {
                    if (confirm(`Delete tag "${t.name}"?`)) api.deleteTag(t.id).then(refresh)
                  }}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
