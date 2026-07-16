# Outreach CRM and Approved Delivery

## Approval and delivery

Outreach drafts never send automatically. Delivery requires `APPROVED` status, an approval timestamp, and the approving user ID. The delivery service rechecks the active workspace, recipient email, contact do-not-contact state, opt-out time, and workspace suppression list immediately before calling an adapter.

When Transactional email is enabled in Settings, delivery uses the encrypted `transactional_email` credential and the configured Resend-compatible endpoint. When disabled, development and seeded tests use `mock-delivery`; records are visibly attributed to that adapter and cannot be mistaken for external delivery. Production fails closed when live delivery is disabled or incomplete.

Delivery attempts create immutable `OutreachDeliveryEvent` records. Successful sends store the provider message ID and contact activity. Failures and suppression decisions are persisted without exposing credentials or provider response bodies.

## CRM workflows

Buyer Research supports buyer creation and editing, domain association, relevance, status, notes, contact creation, do-not-contact controls, and chronological activity history. Outreach supports campaigns, a reusable template library, personalized drafts, explicit and bulk approval, scheduled follow-ups, tasks, reminders, responses, and offer creation.

Supported placeholders are `{{first_name}}`, `{{company}}`, and `{{domain}}`. Personalization occurs when the draft is created so reviewers approve the exact content that will be delivered.

## Privacy and suppression

Suppression is workspace scoped and normalized by lowercase email. Manual suppression and recipient opt-outs update the contact, add an audit event, record CRM activity, and mark every unsent draft, approved message, or scheduled follow-up as `SUPPRESSED`. Removing or bypassing suppression is intentionally not available in the standard outreach UI.

## Deployment and rollback

Migration `20260716010000_outreach_crm_delivery` backfills workspace ownership for existing contacts and approval ownership for campaigns. Existing approved seed messages remain historical but cannot be delivered until linked to an eligible contact and explicitly re-approved under the new attribution policy.

Before rollback, disable live transactional email in Settings. Preserve delivery, suppression, response, and audit tables for compliance history. Do not restore a code path that sends directly through `sendTransactionalEmail`; all outreach delivery must pass through `deliverApprovedOutreach`.
