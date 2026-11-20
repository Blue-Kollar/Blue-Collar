# Triage: background job module for webhooks (#1825)

## Checked

- `src/controllers/webhooks.ts` builds its responses inline and does not call a delivery function.
- `src/services/channels/NotificationChannel.ts` defines a `webhook` channel alongside email and push.
- `src/jobs/horizon-poller.job.ts` is the existing background job.

## Not verified

- Where webhook deliveries run, and whether any of them happen inside a request.

## Not changed

No code change was made. Moving delivery into a job needs a decision about the job runner and retry policy.
