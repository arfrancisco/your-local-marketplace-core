import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z, type ZodRawShape } from 'zod'
import { adminPost, adminPatch, adminDelete } from '../client.js'

// Every mutating tool requires confirm:true to actually write — this is a
// code-enforced branch, not just guidance in the description text. With
// confirm omitted/false, the handler performs no request at all and just
// describes what it would have done, so the calling model must get
// explicit human approval before the real call happens.
function registerMutateTool<Shape extends ZodRawShape>(
  server: McpServer,
  name: string,
  description: string,
  inputSchema: Shape,
  describeAction: (args: Record<string, unknown>) => string,
  perform: (args: Record<string, unknown>) => Promise<unknown>,
) {
  // The generic Shape -> registerTool's inferred callback argument type
  // doesn't narrow cleanly through this wrapper (TS can't relate a generic
  // ZodRawShape param to the SDK's own inferred literal-object type) — cast
  // at this one boundary rather than losing the per-tool zod validation
  // (which still runs at runtime regardless of this cast).
  const handler = async (args: Record<string, unknown>) => {
    if (args.confirm !== true) {
      return {
        content: [{ type: 'text' as const, text: `DRY RUN — would ${describeAction(args)}. Get explicit human approval, then re-call with confirm: true.` }],
      }
    }
    const result = await perform(args)
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
  }

  server.registerTool(
    name,
    {
      description:
        `${description} DESTRUCTIVE. Call first with confirm omitted/false to see what would happen, ` +
        'show that to the human operator, and only call again with confirm: true after they explicitly approve.',
      inputSchema: { ...inputSchema, confirm: z.boolean().default(false) },
    },
    handler as Parameters<typeof server.registerTool>[2],
  )
}

export function registerMutateTools(server: McpServer) {
  registerMutateTool(
    server, 'suspend_user',
    'Suspends a user account (status -> suspended), immediately blocking their API access.',
    { user_id: z.number() },
    (a) => `suspend user ${a.user_id}`,
    (a) => adminPost(`/admin/users/${a.user_id}/suspend`),
  )

  registerMutateTool(
    server, 'reactivate_user',
    'Reactivates a suspended user account.',
    { user_id: z.number() },
    (a) => `reactivate user ${a.user_id}`,
    (a) => adminPost(`/admin/users/${a.user_id}/reactivate`),
  )

  registerMutateTool(
    server, 'approve_vendor_profile',
    'Marks a vendor profile as verified.',
    { vendor_profile_id: z.number() },
    (a) => `approve (verify) vendor profile ${a.vendor_profile_id}`,
    (a) => adminPost(`/admin/vendor_profiles/${a.vendor_profile_id}/approve`),
  )

  registerMutateTool(
    server, 'reject_vendor_profile',
    'Marks a vendor profile as rejected.',
    { vendor_profile_id: z.number() },
    (a) => `reject vendor profile ${a.vendor_profile_id}`,
    (a) => adminPost(`/admin/vendor_profiles/${a.vendor_profile_id}/reject`),
  )

  registerMutateTool(
    server, 'update_shop',
    'Updates a shop\'s name, description, status, accepting_orders, contact_number, or address.',
    {
      shop_id: z.number(),
      name: z.string().optional(),
      description: z.string().optional(),
      status: z.string().optional(),
      accepting_orders: z.boolean().optional(),
      contact_number: z.string().optional(),
      address: z.string().optional(),
    },
    (a) => `update shop ${a.shop_id} with ${JSON.stringify(a)}`,
    (a) => {
      const { shop_id: shopId, confirm: _confirm, ...payload } = a
      return adminPatch(`/admin/shops/${shopId}`, payload)
    },
  )

  registerMutateTool(
    server, 'delete_shop',
    'Permanently deletes a shop and its items. Cannot be undone.',
    { shop_id: z.number() },
    (a) => `PERMANENTLY DELETE shop ${a.shop_id}`,
    (a) => adminDelete(`/admin/shops/${a.shop_id}`),
  )

  registerMutateTool(
    server, 'update_item',
    'Updates an item\'s name, description, price_cents, currency, enabled, stock_count, or position.',
    {
      item_id: z.number(),
      name: z.string().optional(),
      description: z.string().optional(),
      price_cents: z.number().optional(),
      currency: z.string().optional(),
      enabled: z.boolean().optional(),
      stock_count: z.number().nullable().optional(),
      position: z.number().optional(),
    },
    (a) => `update item ${a.item_id} with ${JSON.stringify(a)}`,
    (a) => {
      const { item_id: itemId, confirm: _confirm, ...payload } = a
      return adminPatch(`/admin/items/${itemId}`, payload)
    },
  )

  registerMutateTool(
    server, 'delete_item',
    'Permanently deletes an item. Cannot be undone.',
    { item_id: z.number() },
    (a) => `PERMANENTLY DELETE item ${a.item_id}`,
    (a) => adminDelete(`/admin/items/${a.item_id}`),
  )

  registerMutateTool(
    server, 'force_order_transition',
    'Forces an order to a new status, bypassing the normal customer/vendor actor restriction (the legal ' +
      'state-machine graph still applies — this cannot skip states). Attributed to the shop\'s own vendor ' +
      'user with an "[admin override]" reason prefix for the audit trail.',
    { order_id: z.number(), to_status: z.string(), reason: z.string() },
    (a) => `force order ${a.order_id} to status "${a.to_status}" (reason: ${a.reason})`,
    (a) => adminPost(`/admin/orders/${a.order_id}/transitions`, { to_status: a.to_status, reason: a.reason }),
  )

  registerMutateTool(
    server, 'resolve_feedback',
    'Marks a feedback submission as resolved.',
    { feedback_submission_id: z.number() },
    (a) => `resolve feedback submission ${a.feedback_submission_id}`,
    (a) => adminPost(`/admin/feedback_submissions/${a.feedback_submission_id}/resolve`),
  )

  registerMutateTool(
    server, 'reopen_feedback',
    'Reopens a previously resolved feedback submission.',
    { feedback_submission_id: z.number() },
    (a) => `reopen feedback submission ${a.feedback_submission_id}`,
    (a) => adminPost(`/admin/feedback_submissions/${a.feedback_submission_id}/reopen`),
  )

  registerMutateTool(
    server, 'resolve_error_log',
    'Marks a recorded error as resolved, removing it from the unresolved list.',
    { error_log_id: z.number() },
    (a) => `resolve error log ${a.error_log_id}`,
    (a) => adminPost(`/admin/error_logs/${a.error_log_id}/resolve`),
  )

  registerMutateTool(
    server, 'reopen_error_log',
    'Reopens a previously resolved error.',
    { error_log_id: z.number() },
    (a) => `reopen error log ${a.error_log_id}`,
    (a) => adminPost(`/admin/error_logs/${a.error_log_id}/reopen`),
  )

  registerMutateTool(
    server, 'revoke_api_token',
    'Soft-revokes an API token (expires it immediately) — the user will need to log in again. Issue/last-used history is kept.',
    { api_token_id: z.number() },
    (a) => `revoke API token ${a.api_token_id}`,
    (a) => adminDelete(`/admin/api_tokens/${a.api_token_id}`),
  )

  registerMutateTool(
    server, 'delete_tag',
    'Permanently deletes a catalog tag. Cannot be undone.',
    { tag_id: z.number() },
    (a) => `PERMANENTLY DELETE tag ${a.tag_id}`,
    (a) => adminDelete(`/admin/tags/${a.tag_id}`),
  )
}
