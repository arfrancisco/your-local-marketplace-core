import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { registerReadTools } from './tools/read.js'
import { registerMutateTools } from './tools/mutate.js'

const server = new McpServer({ name: 'kapitmarket-admin', version: '0.1.0' })

registerReadTools(server)
registerMutateTools(server)

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
