# Security Specification - Barber Management System

## Data Invariants
1. **User Identity Isolation**: A user can only write to their own profile unless they are an Admin.
2. **Role Integrity**: Roles (`admin`, `cashier`, `barber`) can only be assigned by an Admin.
3. **Chair-Area Linkage**: A chair must always be associated with a valid `areaId`.
4. **Chair State Transitions**: Only authorized personnel can update chair statuses.
5. **Ticket Atomicity**: Tickets must have a valid `barberId` and `ticketNumber`.
6. **Log Immutability**: Logs are create-only and cannot be modified or deleted.
7. **System Privacy**: Most data requires authentication (`isSignedIn`) to read. Logs require `admin` or `cashier` status.

## The "Dirty Dozen" Payloads (Anti-Tests)
Attempting these payloads must result in `PERMISSION_DENIED`.

1. **Identity Spoofing**: Regular user `user_1` tries to update `users/admin_uid` to set themselves as an admin.
2. **Chair Hijacking**: A `barber` tries to `create` a new chair. (Only Admin can create).
3. **Orphaned Chair**: Admin tries to create a chair without an `areaId`.
4. **Terminal State Bypass**: A barber tries to update a `finished` ticket back to `in-progress`.
5. **Log Tampering**: A user tries to `delete` a log entry in `/logs/`.
6. **Settings Sabotage**: A `barber` tries to update `settings/global`.
7. **Role Escalation**: A `cashier` tries to update their own role property to `admin`.
8. **Invalid ID Injection**: Trying to create a doc with a 2KB long ID string.
9. **Payload Bloating**: Trying to add a 1MB field `dummy` to a Chair document.
10. **Blind Reading**: Unauthenticated user trying to read `/areas/`.
11. **Spoofed Timestamp**: Trying to set `startTime` to a future date instead of `request.time`.
12. **Foreign Area Assignment**: User tries to update a chair to point to a non-existent `areaId` (logic check).

## The Test Runner Script
(Summary: `firestore.rules.test.ts` would implement these checks using `@firebase/rules-unit-testing`)
