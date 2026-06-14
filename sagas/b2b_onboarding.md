# Saga: `b2b_onboarding`

**Version:** 0.1.0

**Modules:** tenants → workspaces → billing → users → permissions → notifications → audit_log

---

## Steps

1. **create_tenant(company_name, owner_email, plan)** → `Tenant`
   **Compensation:** `tenants.suspendTenant(tenant_id, reason: "onboarding_failed")`

2. **provision_workspace(tenant_id, plan)** → `Workspace`
   **Compensation:** `workspaces.deprovisionWorkspace(workspace_id, reason: "onboarding_failed")`

3. **create_subscription(tenant_id, plan, payment_method)** → `Subscription`
   **Compensation:** `billing.cancelSubscription(subscription_id, at_period_end: false)`

4. **assign_admin(tenant_id, owner_email, role: "admin")** → `Membership`
   **Compensation:** `tenants.removeMember(tenant_id, admin_user_id)`

5. **setup_default_roles(tenant_id)** -- Create base RBAC roles (admin, member, viewer)
   **Compensation:** `permissions.revokePermission` for each created role

6. **send_welcome(tenant_id, owner_email)** -- Invitation email with workspace URL
   **Compensation:** async, non-blocking

7. **[async] record_audit_event("tenant.onboarded", tenant_id)** -- Compliance trail
   **Compensation:** async, non-blocking

---

## Failure Modes

| Step | Failure | Compensation |
|---|---|---|
| 2 | Workspace provisioning fails | Suspend tenant (step 1); return `provisioning_failed` |
| 3 | Payment method declined | Deprovision workspace (step 2), suspend tenant (step 1); prompt new payment |
| 4 | Admin assignment fails | Retry; fallback to invite-based assignment |
