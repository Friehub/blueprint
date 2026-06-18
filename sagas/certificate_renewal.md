# Saga: `certificate_renewal`

**Version:** 0.1.0

**Modules:** secrets → jobs → notifications → credential_rotation_policy

---

## Steps

1. **validate_renewal(certificate_id, namespace)** -- Verify certificate exists, is within renewal window, and renewal is not already in progress.
   **Compensation:** none (read-only; status check is idempotent)

2. **generate_csr(certificate_id, subject, key_type)** → `CertificateSigningRequest`
   **Compensation:** `secrets.discardCSR(csr_id)` -- deletes the generated CSR

3. **submit_to_ca(csr_id, ca_endpoint)** → `SignedCertificate`
   **Compensation:** `credential_rotation_policy.revokeCACertificate(signed_certificate_id)` -- requests CA revocation

4. **store_new_certificate(certificate_id, signed_certificate, private_key)** → `CertificateVersionRef`
   **Compensation:** `secrets.rollbackCertificate(certificate_id, previous_version)` -- restores previous certificate

5. **update_service_references(certificate_id, new_version)** -- Point all dependent services to new certificate
   **Compensation:** `jobs.cancelCertificateUpdate(job_batch_id)` -- reverts service references

6. **[async] notify_expiry_monitor(certificate_id, new_expiry_date)** -- Update monitoring systems with new expiry date
   **Compensation:** none (informational; retry on failure)

---

## Failure Modes

| Step | Failure | Compensation |
|---|---|---|
| 1 | Certificate outside renewal window (too early or expired) | Return `invalid_renewal_window` error |
| 3 | CA submission timeout or rate-limited | Retry with fallback CA; extend grace period |
| 5 | Service reference update partial failure | Retry idempotently; affected services listed in alert |
| 6 | Monitoring update not acknowledged | Reschedule notification; certificate tracked in audit log |

---

## Invariants

- The old certificate must remain valid until all service references point to the new certificate
- Private keys must never be logged, transmitted in plaintext, or stored outside the secrets vault
- Certificate renewal must complete at least 7 days before the current certificate's expiry date
