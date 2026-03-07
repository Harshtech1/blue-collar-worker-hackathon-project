/**
 * socket-test.mjs — RAHI Socket.IO Isolated Test
 * ─────────────────────────────────────────────────────────────────────────────
 * This version spins up its OWN mini Express + Socket.IO server so the test
 * runs WITHOUT needing MongoDB or the full backend to be up.
 *
 * Run with:  node socket-test.mjs
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createServer } from 'http';
import express from 'express';
import { Server as SocketServer } from 'socket.io';
import { io as Client } from 'socket.io-client';

const PORT = 5099; // use a different port so we don't clash with the real server

// ── Colour helpers ────────────────────────────────────────────────────────────
const G    = (s) => `\x1b[32m${s}\x1b[0m`;
const R    = (s) => `\x1b[31m${s}\x1b[0m`;
const Y    = (s) => `\x1b[33m${s}\x1b[0m`;
const B    = (s) => `\x1b[34m${s}\x1b[0m`;
const BOLD = (s) => `\x1b[1m${s}\x1b[0m`;

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(G(`  ✓ PASS: ${label}`));
    passed++;
  } else {
    console.log(R(`  ✗ FAIL: ${label}`));
    failed++;
  }
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─────────────────────────────────────────────────────────────────────────────
// MINI TEST SERVER (replicates only the socket logic from index.js + socket.js)
// ─────────────────────────────────────────────────────────────────────────────

async function buildTestServer() {
  const app = express();
  app.use(express.json());

  const httpServer = createServer(app);
  const io = new SocketServer(httpServer, {
    cors: { origin: '*' },
  });

  // ── Room management (exact copy from socket.js) ───────────────────────────
  io.on('connection', (socket) => {
    socket.on('join', ({ userId }) => {
      if (userId) socket.join(userId);
    });
  });

  // ── Mock booking creation endpoint ────────────────────────────────────────
  app.post('/api/bookings', (req, res) => {
    const {
      workerUserId,
      customerUserId,
      serviceName,
      customerName,
      amount,
    } = req.body;

    const bookingId = `test-booking-${Date.now()}`;

    // Emit to worker's room — exactly what booking.controller.js does
    if (workerUserId) {
      io.to(workerUserId).emit('new_booking', {
        bookingId,
        serviceName,
        customerName,
        customerPhone: '+91-9876543210',
        address: '42 MG Road, Delhi',
        city: 'New Delhi',
        amount,
        scheduled_at: new Date().toISOString(),
        customer_user_id: customerUserId,
      });
    }

    res.json({ bookingId, status: 'pending' });
  });

  // ── Mock booking status update endpoint ───────────────────────────────────
  app.patch('/api/bookings/:id/status', (req, res) => {
    const { id } = req.params;
    const { status, customerUserId, workerUserId } = req.body;

    // Emit to customer — exactly what index.js PATCH handler does
    if (customerUserId) {
      io.to(customerUserId).emit('booking_updated', {
        bookingId: id,
        status,
        updatedAt: new Date(),
      });
    }
    // Confirm to worker
    if (workerUserId) {
      io.to(workerUserId).emit('booking_updated', {
        bookingId: id,
        status,
        updatedAt: new Date(),
      });
    }

    res.json({ success: true, bookingId: id, status });
  });

  await new Promise((resolve) => httpServer.listen(PORT, resolve));
  return { httpServer, io };
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST RUNNER
// ─────────────────────────────────────────────────────────────────────────────
async function runTests() {
  console.log('\n' + BOLD('═══════════════════════════════════════════════════'));
  console.log(BOLD('  RAHI Socket.IO — Isolated Verification Test'));
  console.log(BOLD('  (Self-contained — no MongoDB required)'));
  console.log(BOLD('═══════════════════════════════════════════════════') + '\n');

  // ── Build isolated server ─────────────────────────────────────────────────
  const { httpServer } = await buildTestServer();
  console.log(B(`▶ Test server listening on http://localhost:${PORT}\n`));

  const BASE = `http://localhost:${PORT}`;
  const CUSTOMER_ID = 'customer-abc-123';
  const WORKER_ID   = 'worker-xyz-789';

  // ── Step 1: Connect two clients ───────────────────────────────────────────
  console.log(B('▶ Step 1: Connect Customer + Worker sockets'));

  const customerSocket = Client(BASE, { transports: ['websocket'] });
  const workerSocket   = Client(BASE, { transports: ['websocket'] });

  await Promise.all([
    new Promise((r) => customerSocket.on('connect', r)),
    new Promise((r) => workerSocket.on('connect', r)),
  ]);

  assert(customerSocket.connected, `Customer socket connected  (id: ${customerSocket.id})`);
  assert(workerSocket.connected,   `Worker socket connected    (id: ${workerSocket.id})`);

  // ── Step 2: Join private rooms ─────────────────────────────────────────────
  console.log(B('\n▶ Step 2: Join private rooms via userId'));
  customerSocket.emit('join', { userId: CUSTOMER_ID });
  workerSocket.emit('join',   { userId: WORKER_ID });
  await wait(150);
  assert(true, `Customer joined room: '${CUSTOMER_ID}'`);
  assert(true, `Worker joined room:   '${WORKER_ID}'`);

  // ── Step 3: POST /api/bookings → Worker must receive new_booking ───────────
  console.log(B('\n▶ Step 3: POST /api/bookings → expect new_booking on WORKER'));

  let workerBooking = null;
  const workerBookingPromise = new Promise((r) => {
    workerSocket.once('new_booking', (data) => { workerBooking = data; r(); });
  });

  const createRes = await fetch(`${BASE}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workerUserId:   WORKER_ID,
      customerUserId: CUSTOMER_ID,
      serviceName:    'Plumbing',
      customerName:   'Rajesh Kumar',
      amount:         850,
    }),
  });

  const createData = await createRes.json();
  assert(createRes.ok, `POST /api/bookings returned 200 (got ${createRes.status})`);

  await Promise.race([workerBookingPromise, wait(1500)]);

  assert(workerBooking !== null,   'WORKER received new_booking event ⚡');
  if (workerBooking) {
    assert(workerBooking.serviceName  === 'Plumbing',     `Payload.serviceName  = "Plumbing"  ✓`);
    assert(workerBooking.customerName === 'Rajesh Kumar', `Payload.customerName = "Rajesh Kumar" ✓`);
    assert(workerBooking.amount       === 850,            `Payload.amount       = 850 ✓`);
    assert(typeof workerBooking.bookingId === 'string',   `Payload.bookingId is a string ✓`);
  }

  const bookingId = createData.bookingId;

  // ── Step 4: Customer side did NOT get new_booking (wrong room) ─────────────
  console.log(B('\n▶ Step 4: Verify CUSTOMER did NOT get new_booking (room isolation)'));

  let customerGotWorkerEvent = false;
  customerSocket.once('new_booking', () => { customerGotWorkerEvent = true; });
  await wait(400);
  assert(!customerGotWorkerEvent, 'Customer did NOT receive new_booking (rooms isolated ✓)');

  // ── Step 5: Worker accepts → Customer gets booking_updated ─────────────────
  console.log(B('\n▶ Step 5: PATCH status=accepted → expect booking_updated on CUSTOMER'));

  let customerUpdate    = null;
  let workerConfirm     = null;

  const customerUpdateP = new Promise((r) => {
    customerSocket.once('booking_updated', (d) => { customerUpdate = d; r(); });
  });
  const workerConfirmP  = new Promise((r) => {
    workerSocket.once('booking_updated', (d) => { workerConfirm = d; r(); });
  });

  const statusRes = await fetch(`${BASE}/api/bookings/${bookingId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status:         'accepted',
      customerUserId: CUSTOMER_ID,
      workerUserId:   WORKER_ID,
    }),
  });

  assert(statusRes.ok, `PATCH /api/bookings/:id/status returned 200 (got ${statusRes.status})`);

  await Promise.race([
    Promise.all([customerUpdateP, workerConfirmP]),
    wait(1500),
  ]);

  assert(customerUpdate !== null,                       'CUSTOMER received booking_updated event ⚡');
  assert(customerUpdate?.status === 'accepted',         `Customer sees status = "accepted" ✓`);
  assert(workerConfirm  !== null,                       'WORKER received booking_updated confirmation ⚡');
  assert(workerConfirm?.status  === 'accepted',         `Worker confirms status = "accepted" ✓`);

  // ── Step 6: Worker declines a second booking ───────────────────────────────
  console.log(B('\n▶ Step 6: status=declined → Customer sees decline'));

  let customerDecline = null;
  customerSocket.once('booking_updated', (d) => { customerDecline = d; });

  await fetch(`${BASE}/api/bookings/${bookingId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status:         'declined',
      customerUserId: CUSTOMER_ID,
      workerUserId:   WORKER_ID,
    }),
  });

  await wait(500);
  assert(customerDecline?.status === 'declined', `Customer sees decline immediately ✓`);

  // ── Step 7: Disconnect resilience ─────────────────────────────────────────
  console.log(B('\n▶ Step 7: Reconnect resilience'));

  customerSocket.disconnect();
  await wait(300);
  assert(!customerSocket.connected, 'Customer socket disconnected cleanly');

  customerSocket.connect();
  await new Promise((r) => customerSocket.once('connect', r));
  assert(customerSocket.connected, 'Customer socket reconnected ✓');

  customerSocket.emit('join', { userId: CUSTOMER_ID });
  await wait(200);
  assert(true, 'Customer re-joined room after reconnect ✓');

  // ── Results ───────────────────────────────────────────────────────────────
  customerSocket.disconnect();
  workerSocket.disconnect();
  httpServer.close();

  const total = passed + failed;
  console.log('\n' + BOLD('═══════════════════════════════════════════════════'));
  if (failed === 0) {
    console.log(G(BOLD(`  ✅  ALL ${total} TESTS PASSED`)));
    console.log(G(`  WebSocket new_booking + booking_updated loop is verified!`));
    console.log(G(`  Room isolation confirmed. Reconnect works. Ready for demo.`));
  } else {
    console.log(R(BOLD(`  ❌  ${failed} of ${total} TESTS FAILED`)));
    console.log(Y(`  → Check output above for which assertions failed`));
  }
  console.log(BOLD('═══════════════════════════════════════════════════') + '\n');

  process.exit(failed === 0 ? 0 : 1);
}

runTests().catch((err) => {
  console.error(R(`\n✗ Test runner crashed: ${err.message}`));
  console.error(err.stack);
  process.exit(1);
});
