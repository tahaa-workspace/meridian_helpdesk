import { query } from '../db/pool.js';
import { config } from '../config.js';

const PAGE_SIZE = 20;

function addSlaFields(ticket) {
  if (!ticket) return ticket;

  const slaHours = config.slaTargets[ticket.priority];

  if (!slaHours) {
    return {
      ...ticket,
      sla_due_at: null,
      sla_breached: false,
    };
  }

  const createdAt = new Date(ticket.created_at);
  const slaDueAt = new Date(
    createdAt.getTime() + slaHours * 60 * 60 * 1000
  );

  const activeStatuses = ['open', 'pending'];

  return {
    ...ticket,
    sla_due_at: slaDueAt,
    sla_breached:
      activeStatuses.includes(ticket.status) &&
      new Date() >= slaDueAt,
  };
}

function addSlaFieldsToTickets(tickets) {
  return tickets.map(addSlaFields);
}

/**
 * Paginated ticket list for the current organisation.
 *
 * Supports free-text search on subject, filtering by status and priority,
 * and sorting by any column the UI exposes in its dropdown.
 */
export async function listTickets({
  orgId,
  page = 1,
  search = '',
  status,
  priority,
  breached,
  sortBy = 'created_at',
  order = 'desc'
}) {
  const where = ['t.org_id = ?'];
  const params = [orgId];

  if (search) {
    where.push('t.subject LIKE ?');
    params.push(`%${search}%`);
  }
  if (status) {
    where.push('t.status = ?');
    params.push(status);
  }
  if (priority) {
    where.push('t.priority = ?');
    params.push(priority);
  }

  if (breached === true) {
    where.push(`
    t.status IN ('open', 'pending')
    AND (
      (t.priority = 'P1' AND t.created_at <= DATE_SUB(NOW(), INTERVAL ? HOUR))
      OR
      (t.priority = 'P2' AND t.created_at <= DATE_SUB(NOW(), INTERVAL ? HOUR))
      OR
      (t.priority = 'P3' AND t.created_at <= DATE_SUB(NOW(), INTERVAL ? HOUR))
    )
  `);

    params.push(
      config.slaTargets.P1,
      config.slaTargets.P2,
      config.slaTargets.P3
    );
  }

  if (breached === false) {
    where.push(`
    (
      t.status NOT IN ('open', 'pending')
      OR (
        (t.priority = 'P1' AND t.created_at > DATE_SUB(NOW(), INTERVAL ? HOUR))
        OR
        (t.priority = 'P2' AND t.created_at > DATE_SUB(NOW(), INTERVAL ? HOUR))
        OR
        (t.priority = 'P3' AND t.created_at > DATE_SUB(NOW(), INTERVAL ? HOUR))
      )
    )
  `);

    params.push(
      config.slaTargets.P1,
      config.slaTargets.P2,
      config.slaTargets.P3
    );
  }

  const whereSql = where.join(' AND ');
  const offset = (page - 1) * PAGE_SIZE; //First page of tickets skips the first 20 records

  const rows = await query(
    `SELECT t.id, t.subject, t.status, t.priority, t.created_at, t.updated_at,
            t.assignee_id, u.name AS assignee_name, r.name AS requester_name
       FROM tickets t
       LEFT JOIN users u ON u.id = t.assignee_id
       JOIN users r ON r.id = t.requester_id
      WHERE ${whereSql}
      ORDER BY t.${sortBy} ${order}
      LIMIT ? OFFSET ?`,
    [...params, PAGE_SIZE, offset]
  );

  // const debugRows = await query(
  //   `SELECT t.id, t.subject, t.status, t.priority, t.created_at, t.updated_at,
  //           t.assignee_id, u.name AS assignee_name, r.name AS requester_name
  //      FROM tickets t
  //      LEFT JOIN users u ON u.id = t.assignee_id
  //      JOIN users r ON r.id = t.requester_id
  //     WHERE ${whereSql}
  //     ORDER BY t.${sortBy} ${order}
  //     LIMIT 20 OFFSET 0`,
  //   [...params, PAGE_SIZE, offset]
  // );

  // console.log('EXPECTED FIRST 20 IDs:', debugRows.map(t => t.id));
  // console.log('Returned ticket IDs(wrong): ', rows.map(ticket => ticket.id));

  // Attach the comment count each row needs for the list badge.
  for (const row of rows) {
    const [{ c }] = await query('SELECT COUNT(*) AS c FROM comments WHERE ticket_id = ?', [row.id]);
    row.comment_count = c;
  }

  const [{ total }] = await query(
    `SELECT COUNT(*) AS total FROM tickets t WHERE ${whereSql}`,
    params
  );

  return {
    rows: addSlaFieldsToTickets(rows),
    total,
    page,
    pageSize: PAGE_SIZE,
  };
}

export async function getTicketById(id) {
  const rows = await query(
    `SELECT t.*, u.name AS assignee_name, r.name AS requester_name, r.email AS requester_email
       FROM tickets t
       LEFT JOIN users u ON u.id = t.assignee_id
       JOIN users r ON r.id = t.requester_id
      WHERE t.id = ?`,
    [id]
  );
  return rows[0] ? addSlaFields(rows[0]) : null;
}

export async function listComments(ticketId) {
  return query(
    `SELECT c.id, c.body, c.is_internal, c.created_at, u.name AS author_name, u.role AS author_role
       FROM comments c
       JOIN users u ON u.id = c.author_id
      WHERE c.ticket_id = ?
      ORDER BY c.created_at ASC`,
    [ticketId]
  );
}

export async function createTicket({ orgId, subject, body, priority, requesterId }) {
  const result = await query(
    `INSERT INTO tickets (org_id, subject, body, priority, requester_id)
     VALUES (?, ?, ?, ?, ?)`,
    [orgId, subject, body, priority, requesterId]
  );
  return getTicketById(result.insertId);
}

export async function assignTicket(ticketId, assigneeId) {
  const ticket = await getTicketById(ticketId);
  if (!ticket) return null;

  if (ticket.assignee_id) {
    return { conflict: true, ticket };
  }

  // Look up the agent so the response carries a display name for the toast.
  const [agent] = await query('SELECT id, name FROM users WHERE id = ?', [assigneeId]);

  await query('UPDATE tickets SET assignee_id = ?, status = ? WHERE id = ?', [assigneeId, 'pending', ticketId]);
  return { conflict: false, assignedTo: agent, ticket: await getTicketById(ticketId) };
}

export async function deleteTicket(id) {
  await query('DELETE FROM tickets WHERE id = ?', [id]);
}
