import { io as Client } from 'socket.io-client';

const API_BASE = process.env.LIVE_GATE_API_URL || 'http://localhost:5000/api';
const SOCKET_BASE = process.env.LIVE_GATE_SOCKET_URL || API_BASE.replace(/\/api\/?$/, '');
const DEMO_OTP = '123456';
const TEST_AMOUNT = 500;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const request = async (path, options = {}) => {
  let response;

  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...(options.headers || {}),
      },
    });
  } catch (error) {
    throw new Error(
      `Cannot reach backend at ${API_BASE}${path}. Start the backend first with a valid Backend/.env. ` +
      `Original error: ${error.cause?.message || error.message}`,
    );
  }

  const text = await response.text();
  const body = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(`${options.method || 'GET'} ${path} failed (${response.status}): ${body.message || body.error || text}`);
  }

  return body;
};

const withTimeout = async (promise, label, ms = 6000) => {
  let timeout;
  const timeoutPromise = new Promise((_, reject) => {
    timeout = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeout);
  }
};

const createUser = async ({ role, suffix }) => {
  const email = `live-gate-${role}-${suffix}@rahi.test`;
  const password = 'LiveGate@12345';
  const fullName = role === 'worker' ? 'Live Gate Worker' : 'Live Gate Customer';
  const phone = role === 'worker' ? `90000${suffix.slice(-5)}` : `80000${suffix.slice(-5)}`;

  await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, full_name: fullName, phone, role }),
  });

  const verification = await request('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ email, otp: DEMO_OTP, type: 'register' }),
  });

  return {
    email,
    password,
    token: verification.token,
    user: verification.user,
  };
};

const connectUserSocket = async ({ userId, role }) => {
  const socket = Client(SOCKET_BASE, { transports: ['websocket', 'polling'] });

  await withTimeout(new Promise((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
  }), `${role} socket connection`);

  socket.emit('join', { userId, role });
  await wait(300);
  return socket;
};

const onceSocketEvent = (socket, eventName, predicate = () => true) => {
  return new Promise((resolve) => {
    const handler = (payload) => {
      if (!predicate(payload)) return;
      socket.off(eventName, handler);
      resolve(payload);
    };
    socket.on(eventName, handler);
  });
};

const main = async () => {
  console.log(`Live Gate target API: ${API_BASE}`);
  console.log(`Live Gate target Socket.IO: ${SOCKET_BASE}`);

  await request('/health');
  console.log('1. Backend health check passed');

  const suffix = `${Date.now()}`;
  const customer = await createUser({ role: 'customer', suffix });
  const worker = await createUser({ role: 'worker', suffix });
  console.log('2. Demo customer and worker registered with universal OTP');

  const customerId = customer.user.id || customer.user._id;
  const workerId = worker.user.id || worker.user._id;
  const customerSocket = await connectUserSocket({ userId: customerId, role: 'customer' });
  const workerSocket = await connectUserSocket({ userId: workerId, role: 'worker' });
  console.log('3. Socket.IO handshake passed for customer and worker');

  const workerBookingPing = onceSocketEvent(workerSocket, 'new_booking');
  const booking = await request('/bookings', {
    method: 'POST',
    body: JSON.stringify({
      customer_user_id: customerId,
      worker_user_id: workerId,
      serviceName: 'Live Gate Plumbing',
      customerName: customer.user.full_name,
      customerPhone: customer.user.phone,
      address: 'Live Gate Sector 15',
      city: 'Noida',
      amount: TEST_AMOUNT,
      bookingType: 'instant',
      description: 'Automated live-gate booking',
    }),
  });

  const bookingId = booking.bookingId || booking._id;
  const newBookingEvent = await withTimeout(workerBookingPing, 'new_booking socket event');
  assert(newBookingEvent.bookingId === bookingId, 'Worker received new_booking for a different booking');
  console.log('4. Worker received real-time booking ping');

  const customerAcceptPing = onceSocketEvent(customerSocket, 'booking_updated', (payload) => payload.bookingId === bookingId && payload.status === 'accepted');
  await request(`/bookings/${bookingId}/respond`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${worker.token}` },
    body: JSON.stringify({ status: 'accepted' }),
  });
  await withTimeout(customerAcceptPing, 'accepted booking_updated socket event');
  console.log('5. Worker accept updated customer in real-time');

  await request(`/bookings/${bookingId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${worker.token}` },
    body: JSON.stringify({ status: 'otp_verify' }),
  });

  const started = await request(`/bookings/${bookingId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${worker.token}` },
    body: JSON.stringify({ status: 'in_progress', otp: DEMO_OTP }),
  });
  assert(started.status === 'in_progress', 'Start OTP did not move booking to in_progress');
  console.log('6. Start OTP 123456 moved booking to in_progress');

  const completed = await request(`/bookings/${bookingId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${worker.token}` },
    body: JSON.stringify({ status: 'completed', otp: DEMO_OTP }),
  });
  assert(completed.status === 'completed', 'Finish OTP did not move booking to completed');
  console.log('7. Finish OTP 123456 moved booking to completed');

  const payment = await request('/payments/initiate', {
    method: 'POST',
    headers: { Authorization: `Bearer ${customer.token}` },
    body: JSON.stringify({ bookingId, paymentMethod: 'upi', transactionId: `LIVE-GATE-${suffix}` }),
  });

  const expectedWorkerAmount = Number((TEST_AMOUNT * 0.8).toFixed(2));
  const actualWorkerAmount = Number(payment.payment.worker_amount);
  assert(actualWorkerAmount === expectedWorkerAmount, `worker_amount mismatch: expected ${expectedWorkerAmount}, got ${actualWorkerAmount}`);
  console.log(`8. Payment recorded and worker_amount is correct: ${actualWorkerAmount}`);

  const uploadForm = new FormData();
  uploadForm.append('file', new Blob(['RAHI live gate upload check'], { type: 'text/plain' }), `live-gate-${suffix}.txt`);
  const upload = await request('/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${worker.token}` },
    body: uploadForm,
  });
  assert(upload.url, 'Upload did not return a file URL');
  console.log(`9. Upload check passed: ${upload.url}`);

  customerSocket.disconnect();
  workerSocket.disconnect();

  console.log('\nLIVE GATE PASSED');
};

main().catch((error) => {
  console.error('\nLIVE GATE FAILED');
  console.error(error.message);
  process.exit(1);
});
