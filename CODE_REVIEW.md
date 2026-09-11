# Part 1 — Code Review Findings

## Summary

I reviewed the Meridian Helpdesk starter application with focus on organisation access, user roles, authentication, pagination, ticket filtering, and navigation.

I identified seven findings and ranked them based on their impact on security, data access, and normal application functionality.

Five findings were selected, implemented, and tested. The remaining two findings are documented but were left unchanged.

---

## 1. Users can open tickets from another organisation

**Severity:** High
**Files:** `server/src/routes/tickets.js`, `server/src/services/ticketService.js`
**Lines:** (33-35)
**Status:** Fixed

### What is wrong

The ticket detail API looked up a ticket using only its ticket ID. It did not verify that the ticket belonged to the same organisation as the logged-in user.

### Why it matters

Northwind Trading and Cobalt Logistics are separate customers. A user from one organisation should not be able to access ticket details or comments belonging to another organisation.

### Fix 

The ticket detail route now checks the ticket's `org_id` against the logged-in user's `orgId`.

If the ticket does not exist or belongs to another organisation, the API returns `404`.

---

## 2. Non-admin users can delete tickets

**Severity:** High
**File:** `server/src/routes/tickets.js`
**Lines:** (Lines 75-76)
**Status:** Fixed

### What is wrong

The delete-ticket endpoint checked whether the user was logged in, but it did not check whether the user had the `admin` role.

### Why it matters

According to the application role rules, deleting tickets is an admin-only operation.

Without a backend role check, another authenticated user could manually call the delete API even if the frontend did not display a Delete button.

### Fix 

The existing role-checking middleware is now used on the delete route so that only users with the `admin` role can delete tickets.

---

## 3. Requesters can claim tickets

**Severity:** High
**Files:** `server/src/routes/tickets.js`, `client/src/features/tickets/TicketDetail.jsx`
**Lines:**  (ticket.js - Lines 62-64) and (TicketDetail.jsx - Lines 56)
**Status:** Fixed

### What is wrong

The claim-ticket endpoint only checked that the user was authenticated. It did not restrict the operation to agents or admins.

The frontend also displayed the **Claim this ticket** button without checking the logged-in user's role.

### Why it matters

The application rules state that agents can claim tickets. A requester should not be able to assign a support ticket to themselves.

### Fix

The backend claim endpoint is now restricted to `agent` and `admin` roles.

The frontend also displays the Claim button only to agents and admins.

The backend role check remains the actual security control.

---

## 4. Page 1 skips the first 20 tickets

**Severity:** Medium
**File:** `server/src/services/ticketService.js`
**Lines:** 29
**Status:** Fixed

### What is wrong

The pagination offset was calculated as:

`page * PAGE_SIZE`

With a page size of 20, requesting page 1 produced:

`1 * 20 = OFFSET 20`

However, page 1 should start from offset 0.

### Why it matters

The first 20 tickets in the ordered result were skipped instead of being displayed on the first page.

While investigating this issue, I logged the requested page, page size, calculated offset, and returned ticket IDs. I also compared the result with the same query starting from `OFFSET 0`.

### Fix

The offset calculation was changed to:

`(page - 1) * PAGE_SIZE`

This results in:

* Page 1 → offset 0
* Page 2 → offset 20
* Page 3 → offset 40

---

## 5. Search and filters do not refresh the ticket list

**Severity:** Medium
**File:** `client/src/features/tickets/TicketList.jsx`
**Lines:** 31
**Status:** Fixed

### What is wrong

The ticket-fetching `useEffect` used values such as:

* `page`
* `search`
* `status`
* `priority`
* `sortBy`

However, its dependency array contained only:

`[page]`

Because of this, changing search, status, priority, or sorting did not trigger the ticket API request again.

### Why it matters

A user could change a search or filter control, but the displayed ticket list would not immediately update using the selected value.

### Fix

The relevant search, filter, sorting, and pagination values were added to the `useEffect` dependency array.

The ticket list now fetches updated results when those values change.

---

## 6. Password is stored without hashing in invite acceptance

**Severity:** High
**File:** `server/src/routes/auth.js`
**Status:** Not selected for fix

### What is wrong

The invite-acceptance route stores the submitted password directly in the `password_hash` database column.

The normal login flow uses `bcrypt.compare()`, which expects the stored value to be a bcrypt hash.

### Why it matters

The user's original password may be stored directly in the database instead of as a one-way hash.

It can also create inconsistent authentication behaviour because the normal login flow expects a bcrypt-formatted password hash.

### Suggested fix

Hash the submitted password using `bcrypt.hash()` before updating the `password_hash` column.

### Selection note

I identified this issue during code review but did not include it in the five implemented fixes. I focused the selected fixes on issues that I reproduced directly through the current seeded application flows.

This authentication issue should be addressed in a follow-up security pass.

---

## 7. Logged-in users can still access the login page

**Severity:** Low
**Files:** `client/src/main.jsx`, `client/src/features/auth/Login.jsx`
**Status:** Not selected for fix

### What is wrong

After successfully signing in, pressing the browser Back button can return the user to the login page even though the authenticated session is still active.

### Why it matters

The user is already authenticated, so displaying the login screen again creates confusing and inconsistent navigation behaviour.

This does not bypass authentication because the user's session still exists, so its impact is lower than the other findings.

### Suggested fix

When the login page is opened, check whether an authenticated user or token already exists.

If the user is already signed in, redirect them back to the authenticated ticket area instead of displaying the login form.

---

# Selected Fixes

The five findings implemented in Part 1 are:

1. Users can open tickets from another organisation — **Fixed**
2. Non-admin users can delete tickets — **Fixed**
3. Requesters can claim tickets — **Fixed**
4. Page 1 skips the first 20 tickets — **Fixed**
5. Search and filters do not refresh the ticket list — **Fixed**

The following findings are documented but remain unchanged:

* Password is stored without hashing in invite acceptance
* Logged-in users can still access the login page
