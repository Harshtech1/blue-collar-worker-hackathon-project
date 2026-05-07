import { getDb } from '../config/db.js';

const toNumber = (value, fallback = 0) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
};

const startOfDay = (date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const buildDemandForecast = (bookings) => {
  const today = startOfDay(new Date());
  return Array.from({ length: 7 }).map((_, index) => {
    const day = new Date(today);
    day.setDate(today.getDate() - (6 - index));
    const nextDay = new Date(day);
    nextDay.setDate(day.getDate() + 1);

    const actual = bookings.filter((booking) => {
      const createdAt = new Date(booking.createdAt || booking.date || 0);
      return createdAt >= day && createdAt < nextDay;
    }).length;

    const rollingBoost = index >= 5 ? 1.18 : 1.08;
    const predicted = Math.max(actual, Math.round((actual || 2) * rollingBoost));

    return {
      label: day.toLocaleDateString('en-US', { weekday: 'short' }),
      actual,
      predicted,
    };
  });
};

export const getInvestorAnalytics = async (_req, res) => {
  try {
    const db = getDb();
    const [bookings, users, workers] = await Promise.all([
      db.collection('bookings').find({}).sort({ createdAt: -1 }).limit(500).toArray(),
      db.collection('users').find({ role: 'customer' }).project({ password: 0, otp: 0 }).toArray(),
      db.collection('worker_profiles').find({}).limit(250).toArray(),
    ]);

    const completed = bookings.filter((booking) => booking.status === 'completed');
    const cancelled = bookings.filter((booking) => booking.status === 'cancelled');
    const escalated = bookings.filter((booking) => booking.assignment_status === 'admin_review_required');
    const repeatCustomerIds = new Set();
    const customerBookingCounts = new Map();

    bookings.forEach((booking) => {
      const customerId = booking.customer_user_id?.toString?.() || booking.customer_user_id;
      if (!customerId) return;
      customerBookingCounts.set(customerId, (customerBookingCounts.get(customerId) || 0) + 1);
    });

    customerBookingCounts.forEach((count, customerId) => {
      if (count > 1) repeatCustomerIds.add(customerId);
    });

    const churnRate = users.length > 0
      ? Number((((users.length - repeatCustomerIds.size) / users.length) * 100).toFixed(1))
      : 0;

    const cancellationReasons = cancelled.reduce((acc, booking) => {
      const reason = booking.cancelReason || booking.cancellationReason || 'Reason not captured';
      acc[reason] = (acc[reason] || 0) + 1;
      return acc;
    }, {});

    const revenue = completed.reduce((sum, booking) => sum + toNumber(booking.amount ?? booking.total_price), 0);
    const platformCommission = Math.round(revenue * 0.15);
    const workerEarnings = Math.max(0, revenue - platformCommission);

    const workerQuality = workers
      .map((worker) => {
        const rating = Math.min(5, Math.max(0, toNumber(worker.rating, 4)));
        const completedJobs = toNumber(worker.completed_jobs_count ?? worker.completedJobs, 0);
        const punctualityRate = Math.min(1, Math.max(0, toNumber(worker.punctuality_rate ?? worker.punctualityRate, 0.78)));
        const photoAuditRate = Math.min(1, Math.max(0, toNumber(worker.photo_audit_rate ?? worker.photoAuditRate, 0.82)));
        const qualityScore = Math.round(
          ((rating / 5) * 45) + (Math.min(completedJobs, 100) / 100 * 20) + (punctualityRate * 20) + (photoAuditRate * 15),
        );

        return {
          id: worker._id?.toString?.() || worker._id,
          name: worker.name || worker.full_name || worker.bio || 'RAHI worker',
          service: worker.profession || worker.bio || 'Service professional',
          qualityScore,
          rating,
          completedJobs,
          punctualityRate,
          photoAuditRate,
        };
      })
      .sort((a, b) => b.qualityScore - a.qualityScore)
      .slice(0, 5);

    res.json({
      data: {
        summary: {
          totalBookings: bookings.length,
          completionRate: bookings.length > 0 ? Number(((completed.length / bookings.length) * 100).toFixed(1)) : 0,
          cancellationRate: bookings.length > 0 ? Number(((cancelled.length / bookings.length) * 100).toFixed(1)) : 0,
          churnRate,
          escalatedBookings: escalated.length,
          revenue,
          workerEarnings,
          platformCommission,
        },
        demandForecast: buildDemandForecast(bookings),
        cancellationReasons: Object.entries(cancellationReasons).map(([reason, count]) => ({ reason, count })),
        assignmentEscalations: escalated.slice(0, 10).map((booking) => ({
          bookingId: booking._id?.toString?.() || booking._id,
          serviceName: booking.serviceName || 'Service',
          areaId: booking.areaId || booking.city || 'unknown',
          suggestedPriceMultiplier: booking.fulfillmentEscalation?.suggestedPriceMultiplier || 1.1,
          reason: booking.fulfillmentEscalation?.reason || 'Needs operations review',
          escalatedAt: booking.fulfillmentEscalation?.escalatedAt || booking.updatedAt,
        })),
        workerQuality,
      },
    });
  } catch (err) {
    console.error('Investor analytics error:', err);
    res.status(500).json({ message: 'Unable to calculate investor analytics' });
  }
};
