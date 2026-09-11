# Part 1 — Code Review Findings

## Summary

I reviewed the Meridian Helpdesk starter application with focus on organisation access, user roles, authentication, pagination, ticket filtering, and navigation.

I identified seven findings. They are ranked mainly by their impact on application security, data access, and normal user functionality.

Five findings are being selected for implementation. The remaining findings are documented but left unchanged.

---

## 1. Users can open tickets from another organisation

**Severity:** High
**Files:** `server/src/routes/tickets.js`, `server/src/services/ticketService.js`
**Status:** Fixed

### What is wrong

The ticket detail API looks up a ticket using only its ticket ID. It does not verify that the ticket belongs to the same organisation as the logged-in user.

### Why it matters

Northwind Trading and Cobalt Logistics are separate customers. A user from one organisation should not be able to access ticket details or comments belonging to another organisation.

### Fix

The ticket detail route now checks the ticket's `org_id` against the logged-in user's `orgId`.

If the ticket does not exist or belongs to another organisation, the API returns `404`.

### Verification

I tested this using accounts from both organisations.

A user can still open a ticket belonging to their own organisation, but attempting to manually open a ticket ID belonging to the other organisation is now rejected.

---

## 2. Non-admin users can delete tickets

**Severity:** High
**File:** `server/src/routes/tickets.js`
**Status:** Planned for fix

### What is wrong

The delete-ticket endpoint checks whether the user is logged in, but it does not check whether the user has the `admin` role.

### Why it matters

According to the application role rules, deleting tickets is an admin-only operation. Without a backend role check, other authenticated users may be able to delete ticket data.

### Suggested fix

Use the existing role-checking middleware on the delete route and restrict the endpoint to the `admin` role.

---

## 3. Requesters can claim tickets

**Severity:** High
**Files:** `server/src/routes/tickets.js`, `client/src/features/tickets/TicketDetail.jsx`
**Status:** Planned for fix

### What is wrong

The claim-ticket endpoint only checks that the user is authenticated. It does not restrict the operation to agents or admins.

The frontend also displays the **Claim this ticket** button without checking the user's role.

### Why it matters

The application rules state that agents can claim tickets. A requester should not be able to assign a support ticket to themselves.

### Suggested fix

Restrict the backend claim endpoint to the `agent` and `admin` roles.

The frontend should also show the Claim button only when the logged-in user has one of those roles.

The backend check remains the actual security control.

---

## 4. Password is stored without hashing in invite acceptance

**Severity:** High
**File:** `server/src/routes/auth.js`
**Status:** Not selected for fix

### What is wrong

The invite-acceptance route stores the submitted password directly in the `password_hash` database column.

The normal login flow uses `bcrypt.compare()`, which expects the stored value to be a bcrypt hash.

### Why it matters

The user's original password may be stored directly in the database instead of a one-way hash.

It can also create inconsistent authentication behaviour because the login flow expects a bcrypt-formatted hash.

### Suggested fix

Run the submitted password through `bcrypt.hash()` before updating the `password_hash` column.

---

## 5. Page 1 skips the first 20 tickets

**Severity:** Medium
**File:** `server/src/services/ticketService.js`
**Status:** Planned for fix

### What is wrong

The pagination offset is calculated as:

`page * PAGE_SIZE`

With a page size of 20, requesting page 1 produces:

`1 * 20 = OFFSET 20`

Page 1 should start from offset 0.

### Why it matters

The first 20 tickets in the ordered result are skipped instead of being displayed on the first page.

I verified this by logging the requested page, page size, calculated offset, and returned ticket IDs. I also compared the result against the same query using `OFFSET 0`.

### Suggested fix

Calculate the offset as:

`(page - 1) * PAGE_SIZE`

This produces:

* Page 1 → offset 0
* Page 2 → offset 20
* Page 3 → offset 40

---

## 6. Search and filters do not refresh the ticket list

**Severity:** Medium
**File:** `client/src/features/tickets/TicketList.jsx`
**Status:** Not selected for fix

### What is wrong

The ticket-fetching `useEffect` uses values such as `search`, `status`, `priority`, `sortBy`, and `page`.

However, its dependency array only contains:

`[page]`

Therefore changing search, status, priority, or sorting does not cause the effect to run again.

### Why it matters

The user can change a search or filter control, but the displayed ticket list does not immediately reload using the new value.

### Suggested fix

Include the relevant filter values in the `useEffect` dependency array so that the ticket list is fetched again when they change.

---

## 7. Logged-in users can still access the login page

**Severity:** Low
**Files:** Client authentication/routing code
**Status:** Planned for fix

### What is wrong

After successfully signing in, pressing the browser Back button can return the user to the login page even though their authenticated session is still active.

### Why it matters

The user is already authenticated, so displaying the login screen again is confusing and creates inconsistent navigation behaviour.

This does not bypass authentication because the session still exists, so its impact is lower than the other findings.

### Suggested fix

When the login page loads, check whether an authenticated user/token already exists. If the user is already signed in, redirect them back to the authenticated ticket area instead of displaying the login form.

---

# Selected Fixes

The five findings selected for implementation are:

1. Users can open tickets from another organisation — **Fixed**
2. Non-admin users can delete tickets — **Pending**
3. Requesters can claim tickets — **Pending**
4. Page 1 skips the first 20 tickets — **Pending**
5. Logged-in users can still access the login page — **Pending**

The following findings are documented but will remain unchanged:

* Password is stored without hashing in invite acceptance
* Search and filters do not refresh the ticket list

Exact line numbers will be added after implementation is complete because the source files may change during the fixes.
