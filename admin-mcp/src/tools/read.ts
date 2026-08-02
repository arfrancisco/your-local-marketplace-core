import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { adminGet, qs } from '../client.js'

function textResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
}

// All read tools run freely, no confirmation needed — they never write.
export function registerReadTools(server: McpServer) {
  server.registerTool(
    'list_users',
    { description: 'List users, optionally filtered by status (active/suspended) or a search query on email/mobile.',
      inputSchema: { status: z.string().optional(), q: z.string().optional(), page: z.number().optional() } },
    async (args) => textResult(await adminGet(`/admin/users${qs(args)}`)),
  )

  server.registerTool(
    'get_user',
    { description: 'Get a single user by id, including their customer/vendor profile summary.',
      inputSchema: { user_id: z.number() } },
    async ({ user_id }) => textResult(await adminGet(`/admin/users/${user_id}`)),
  )

  server.registerTool(
    'list_vendor_profiles',
    { description: 'List vendor profiles, optionally filtered by verification_status (unverified/pending/verified/rejected).',
      inputSchema: { verification_status: z.string().optional(), page: z.number().optional() } },
    async (args) => textResult(await adminGet(`/admin/vendor_profiles${qs(args)}`)),
  )

  server.registerTool(
    'get_vendor_profile',
    { description: 'Get a single vendor profile by id.', inputSchema: { vendor_profile_id: z.number() } },
    async ({ vendor_profile_id }) => textResult(await adminGet(`/admin/vendor_profiles/${vendor_profile_id}`)),
  )

  server.registerTool(
    'list_shops',
    { description: 'List shops, optionally filtered by status or a name search.',
      inputSchema: { status: z.string().optional(), q: z.string().optional(), page: z.number().optional() } },
    async (args) => textResult(await adminGet(`/admin/shops${qs(args)}`)),
  )

  server.registerTool(
    'get_shop',
    { description: 'Get a single shop by id, including its opening message/payment info.',
      inputSchema: { shop_id: z.number() } },
    async ({ shop_id }) => textResult(await adminGet(`/admin/shops/${shop_id}`)),
  )

  server.registerTool(
    'list_items',
    { description: 'List items, optionally filtered by shop_id or a name search.',
      inputSchema: { shop_id: z.number().optional(), q: z.string().optional(), page: z.number().optional() } },
    async (args) => textResult(await adminGet(`/admin/items${qs(args)}`)),
  )

  server.registerTool(
    'get_item',
    { description: 'Get a single item by id.', inputSchema: { item_id: z.number() } },
    async ({ item_id }) => textResult(await adminGet(`/admin/items/${item_id}`)),
  )

  server.registerTool(
    'list_orders',
    { description: 'List orders, optionally filtered by status or shop_id.',
      inputSchema: { status: z.string().optional(), shop_id: z.number().optional(), page: z.number().optional() } },
    async (args) => textResult(await adminGet(`/admin/orders${qs(args)}`)),
  )

  server.registerTool(
    'get_order',
    { description: 'Get a single order by id, including line items and legal next-status transitions.',
      inputSchema: { order_id: z.number() } },
    async ({ order_id }) => textResult(await adminGet(`/admin/orders/${order_id}`)),
  )

  server.registerTool(
    'list_order_status_events',
    { description: 'List the status-change audit trail, optionally filtered by order_id.',
      inputSchema: { order_id: z.number().optional(), page: z.number().optional() } },
    async (args) => textResult(await adminGet(`/admin/order_status_events${qs(args)}`)),
  )

  server.registerTool(
    'get_conversation',
    { description: 'Get an order\'s full chat transcript by conversation id.',
      inputSchema: { conversation_id: z.number() } },
    async ({ conversation_id }) => textResult(await adminGet(`/admin/conversations/${conversation_id}`)),
  )

  server.registerTool(
    'list_feedback_submissions',
    { description: 'List beta feedback/complaints, optionally filtered by resolved ("true"/"false").',
      inputSchema: { resolved: z.string().optional(), page: z.number().optional() } },
    async (args) => textResult(await adminGet(`/admin/feedback_submissions${qs(args)}`)),
  )

  server.registerTool(
    'get_feedback_submission',
    { description: 'Get a single feedback submission by id.', inputSchema: { feedback_submission_id: z.number() } },
    async ({ feedback_submission_id }) =>
      textResult(await adminGet(`/admin/feedback_submissions/${feedback_submission_id}`)),
  )

  server.registerTool(
    'list_error_logs',
    { description: 'List recorded errors (backend and frontend), newest activity first. Filter by resolved ("true"/"false") ' +
        'or source ("backend", "customer-web", "vendor-web", "admin-web"). One row per distinct error: repeats increment ' +
        'occurrences_count rather than adding rows. Backtraces are omitted here — use get_error_log for the full one.',
      inputSchema: { resolved: z.string().optional(), source: z.string().optional(), page: z.number().optional() } },
    async (args) => textResult(await adminGet(`/admin/error_logs${qs(args)}`)),
  )

  server.registerTool(
    'get_error_log',
    { description: 'Get a single error log by id, including its full backtrace.', inputSchema: { error_log_id: z.number() } },
    async ({ error_log_id }) => textResult(await adminGet(`/admin/error_logs/${error_log_id}`)),
  )

  server.registerTool(
    'list_api_tokens',
    { description: 'List API bearer tokens, optionally filtered by user_id. Never returns the token secret itself.',
      inputSchema: { user_id: z.number().optional(), page: z.number().optional() } },
    async (args) => textResult(await adminGet(`/admin/api_tokens${qs(args)}`)),
  )

  server.registerTool(
    'list_verification_challenges',
    { description: 'List OTP verification challenges (audit only), optionally filtered by user_id or purpose.',
      inputSchema: { user_id: z.number().optional(), purpose: z.string().optional(), page: z.number().optional() } },
    async (args) => textResult(await adminGet(`/admin/verification_challenges${qs(args)}`)),
  )

  server.registerTool(
    'list_customer_profiles',
    { description: 'List customer profiles.', inputSchema: { page: z.number().optional() } },
    async (args) => textResult(await adminGet(`/admin/customer_profiles${qs(args)}`)),
  )

  server.registerTool(
    'list_addresses',
    { description: 'List saved addresses, optionally filtered by user_id.',
      inputSchema: { user_id: z.number().optional(), page: z.number().optional() } },
    async (args) => textResult(await adminGet(`/admin/addresses${qs(args)}`)),
  )

  server.registerTool(
    'list_carts',
    { description: 'List carts, optionally filtered by status (active/converted/abandoned).',
      inputSchema: { status: z.string().optional(), page: z.number().optional() } },
    async (args) => textResult(await adminGet(`/admin/carts${qs(args)}`)),
  )

  server.registerTool(
    'list_tags',
    { description: 'List catalog tags with their item counts.', inputSchema: { page: z.number().optional() } },
    async (args) => textResult(await adminGet(`/admin/tags${qs(args)}`)),
  )

  server.registerTool(
    'list_early_access_signups',
    { description: 'List pre-launch early-access leads.', inputSchema: { page: z.number().optional() } },
    async (args) => textResult(await adminGet(`/admin/early_access_signups${qs(args)}`)),
  )
}
