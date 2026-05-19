# Security Specification: DistroQueue Enterprise

## 1. Data Invariants
- A Job must have a valid `jobType` from the allowed enum.
- A Job status transition must be valid.
- `retryCount` cannot be negative and must be <= `maxRetries`.
- `updatedAt` must be a server timestamp on every write.
- `dead_letter_queue` is append-only for the system.

## 2. The "Dirty Dozen" Payloads (Red Team Test Cases)
1. **Identity Spoofing**: Attempt to create a job with a forged `id` injected into the payload.
2. **Type Poisoning**: Sending `retryCount` as a string instead of a number.
3. **State Shortcutting**: Directly setting a job status to `COMPLETED` from the client without going through `PROCESSING`.
4. **Massive Payload**: Injecting a 1MB string into the `errorLog` field.
5. **Unauthorized Metric Reset**: Attempting to delete documents in the `metrics` collection.
6. **ID Poisoning**: Using a 2KB string as a document ID.
7. **Timestamp Forgery**: Sending a manual `createdAt` string instead of `request.time`.
8. **Shadow Field Injection**: Adding an `isVerified: true` field to a Job document.
9. **Orphaned DLQ Write**: Creating a DLQ entry without a corresponding Job ID.
10. **Privilege Escalation**: Attempting to modify worker system fields from the client.
11. **Query Scraping**: Attempting a collection group query to bypass path-based security.
12. **Negative Balance (Count)**: Setting `retryCount` to -1.

## 3. Implementation Plan
- `isValidJob()` helper to enforce schema.
- `isActionUpdate()` pattern to restrict which fields can be updated during state transitions.
- `isValidId()` for path variable hardening.
