import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { AdminAddress } from '../api/types'

export function AddressesPage() {
  const [addresses, setAddresses] = useState<AdminAddress[]>([])

  useEffect(() => {
    api.listAddresses().then((res) => setAddresses(res.addresses))
  }, [])

  return (
    <div className="container">
      <h1>Addresses</h1>
      <table>
        <thead><tr><th>Label</th><th>Recipient</th><th>Tower</th><th>Unit</th><th>City</th></tr></thead>
        <tbody>
          {addresses.map((a) => (
            <tr key={a.id}>
              <td>{a.label}</td>
              <td>{a.recipient_name}</td>
              <td>{a.building}</td>
              <td>{a.unit}</td>
              <td>{a.city}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
