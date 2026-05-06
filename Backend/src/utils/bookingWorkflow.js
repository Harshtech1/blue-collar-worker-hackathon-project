export const BOOKING_STATUS = {
  pending: 'pending',
  matched: 'matched',
  accepted: 'accepted',
  arriving: 'arriving',
  otp_verify: 'otp_verify',
  in_progress: 'in_progress',
  completed: 'completed',
  cancelled: 'cancelled',
};

export const ACTIVE_BOOKING_STATUSES = [
  BOOKING_STATUS.accepted,
  BOOKING_STATUS.arriving,
  BOOKING_STATUS.otp_verify,
  BOOKING_STATUS.in_progress,
];

const TRANSITIONS = {
  [BOOKING_STATUS.pending]: [BOOKING_STATUS.accepted, BOOKING_STATUS.cancelled],
  [BOOKING_STATUS.accepted]: [BOOKING_STATUS.arriving, BOOKING_STATUS.otp_verify, BOOKING_STATUS.cancelled],
  [BOOKING_STATUS.arriving]: [BOOKING_STATUS.otp_verify, BOOKING_STATUS.cancelled],
  [BOOKING_STATUS.otp_verify]: [BOOKING_STATUS.in_progress, BOOKING_STATUS.cancelled],
  [BOOKING_STATUS.in_progress]: [BOOKING_STATUS.completed],
  [BOOKING_STATUS.completed]: [],
  [BOOKING_STATUS.cancelled]: [],
};

export const canTransitionBookingStatus = (currentStatus, nextStatus) => {
  if (!currentStatus || !nextStatus) return false;
  if (currentStatus === nextStatus) return true;
  return (TRANSITIONS[currentStatus] || []).includes(nextStatus);
};

export const normalizePaymentStatus = (status) => {
  return status === 'paid' ? 'paid' : 'pending';
};

export const isDemoOtp = (otp) => String(otp || '').trim() === '123456';

export const appendStatusHistory = (history = [], status, actor = 'system') => {
  if (!status) return history;
  return [
    ...history,
    {
      status,
      actor,
      timestamp: new Date(),
    },
  ];
};
