# Reveno Security Specification

## Data Invariants
- A revenue record must have a valid month and a positive revenue amount.
- A revenue record or goal record must be owned by a specific user (`userId`).
- Users can only read and write their own data.
- `createdAt` is immutable after creation and set by the server.
- Document IDs must follow valid patterns.

## The "Dirty Dozen" Payloads (Attacks)
1. **Identity Spoofing**: Attempt to create a revenue record with someone else's `userId`.
2. **Identity Spoofing (Update)**: Attempt to change the `userId` of an existing revenue record.
3. **Malicious ID**: Attempt to create a document with a 1KB junk string as the ID.
4. **State Shortcutting**: Attempt to backdate `createdAt` in the future.
5. **PII Leak**: Attempt to list all revenue records without filtering by `userId`.
6. **Ghost Field Injection**: Attempt to add an `isAdmin: true` field to a revenue record.
7. **Type Poisoning**: Attempt to set `revenue` to a boolean or list.
8. **Resource Exhaustion**: Send a 1MB string in the `month` field.
9. **Orphaned Writes**: Create a goal record without a `userId`.
10. **Admin Escalation**: Attempt to write to a hypothetical `admins/` collection.
11. **Cross-User Update**: User A attempts to update User B's revenue goal.
12. **Cross-User Delete**: User A attempts to delete User B's revenue data.

## Rules Draft
(See firestore.rules for implementation)
