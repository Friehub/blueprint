# Module Contract: `returns`

**Version:** 0.1.0

---

### `returns`
Return authorization, inspection, disposition, and refund coordination for commerce workflows.

**Functions**
```
requestReturn(order_id: any, items: any[], reason: any, metadata?: any) → ReturnAuthorization
getReturn(return_id: any) → ReturnAuthorization
listReturns(input: any, options?: any) → PaginatedResult<ReturnAuthorization>
approveReturn(return_id: any) → ReturnAuthorization
rejectReturn(return_id: any, reason: any) → ReturnAuthorization
receiveReturn(return_id: any, received_items: any, metadata?: any) → ReturnAuthorization
inspectReturn(return_id: any, disposition: any) → ReturnAuthorization
closeReturn(return_id: any) → ReturnAuthorization
```

**Types**
```
ReturnAuthorization { id, order_id, status, items, reason, created_at, approved_at?, received_at?, closed_at? }
ReturnItem { line_id, quantity, condition?: string }
ReturnDisposition = restock | refurbish | discard | return_to_vendor | refund_only
ReturnStatus = requested | approved | rejected | in_transit | received | inspected | closed | cancelled
```

**Invariants**
- Return quantities must never exceed the purchased quantity.
- Approved returns must preserve immutable audit history.
- Inventory restock may only occur after a valid received/inspection state as defined by the deployment.

**Providers:** custom RMA systems, ecommerce return portals, warehouse return workflows, commerce helpdesk integrations

---

## System-Level Integrations

- **Runtime Standards:** Inherits `contracts/core/runtime_standards.md`.
- **Consistency:** Return authorization and disposition updates must be strongly consistent.
- **Idempotency:** `requestReturn`, `approveReturn`, and `receiveReturn` must be idempotent on the return identity.
- **Storage Model:** Durable return record store with item history and disposition audit trail.
- **Dependencies:** `orders`, `inventory`, `payments`, `shipping`, `notifications`, `audit_log`.
- **Errors:** `RETURN_NOT_FOUND`, `RETURN_NOT_APPROVABLE`, `RETURN_ALREADY_CLOSED`, `INVALID_RETURN_ITEM`, `RETURN_WINDOW_EXPIRED`, `DISPOSITION_INVALID`.
