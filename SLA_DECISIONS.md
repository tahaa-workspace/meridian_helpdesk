# SLA Decisions

The application already defines SLA targets in `server/src/config.js`:

| Priority | SLA      |
| -------- | -------- |
| P1       | 4 hours  |
| P2       | 24 hours |
| P3       | 72 hours |

## Decisions made

* SLA starts from the ticket's `created_at` time.
* SLA deadline is calculated as:

```text
created_at + SLA hours
```

* Only `open` and `pending` tickets are treated as active for SLA breach checking.
* A ticket is breached when the current time reaches or passes its SLA deadline.
* `resolved` and `closed` tickets are treated as not currently breached.

The database does not contain a separate `resolved_at` or `closed_at` field, so it is not possible to accurately calculate whether a resolved ticket had breached its SLA before resolution. Because of this, the implementation tracks the **current SLA state** only.

## API response

The ticket APIs return:

```text
sla_due_at
sla_breached
```

These values are used directly by the frontend.

## UI

The ticket list and ticket detail page display the SLA state returned by the backend.

Breached tickets are shown using a red SLA badge, while other tickets are shown as within SLA.

The ticket detail page also displays the calculated SLA deadline.

## Filtering

The ticket list is intended to support:

```text
?breached=true
?breached=false
```

The filter is applied on the backend so pagination and ticket counts can remain consistent with the filtered results.