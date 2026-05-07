import test from 'node:test';
import assert from 'node:assert/strict';

import { Booking } from '../src/models/Booking.js';
import { Payment } from '../src/models/Payment.js';
import { User } from '../src/models/User.js';
import { WorkerProfile } from '../src/models/WorkerProfile.js';
import { getDb } from '../src/config/db.js';
import {
  canTransitionBookingStatus,
  isDemoOtp,
  normalizePaymentStatus,
} from '../src/utils/bookingWorkflow.js';
import {
  buildFallbackPrediction,
  getDensityStrategy,
  getSurgeMultiplier,
} from '../src/utils/densityFramework.js';
import {
  isConfiguredAdminEmail,
  parseAdminEmails,
  validateAdminCredentials,
} from '../src/utils/adminAuth.js';

test('database access is guarded before initialization', () => {
  assert.throws(() => getDb(), /Database not initialized/);
});

test('user validation requires identity and password fields', () => {
  const errors = User.validate({ full_name: '', email: '', phone: '', password: '' });
  assert.ok(errors.includes('Full name is required'));
  assert.ok(errors.includes('Either phone or email is required'));
  assert.ok(errors.includes('Password is required'));
});

test('worker profile validation accepts a well-formed payload', () => {
  const errors = WorkerProfile.validate({
    user: 'demo-user-id',
    base_price: 500,
    serviceCategories: [],
  });
  assert.equal(errors.length, 0);
});

test('booking validation requires customer and service references', () => {
  const errors = Booking.validate({ amount: 100 });
  assert.ok(errors.includes('Customer ID is required'));
  assert.ok(errors.includes('Service details are required'));
});

test('payment validation rejects malformed amounts', () => {
  const errors = Payment.validate({ booking_id: 'booking-1', total_amount: '250' });
  assert.ok(errors.includes('Total amount is required and must be a number'));
});

test('booking workflow allows only valid phase-one transitions', () => {
  assert.equal(canTransitionBookingStatus('pending', 'accepted'), true);
  assert.equal(canTransitionBookingStatus('accepted', 'otp_verify'), true);
  assert.equal(canTransitionBookingStatus('otp_verify', 'in_progress'), true);
  assert.equal(canTransitionBookingStatus('in_progress', 'completed'), true);
  assert.equal(canTransitionBookingStatus('pending', 'completed'), false);
  assert.equal(canTransitionBookingStatus('completed', 'in_progress'), false);
});

test('payment status normalization keeps incomplete jobs unpaid', () => {
  assert.equal(normalizePaymentStatus(undefined), 'pending');
  assert.equal(normalizePaymentStatus('unpaid'), 'pending');
  assert.equal(normalizePaymentStatus('paid'), 'paid');
});

test('demo OTP can be used for live-gate job start and finish checks', () => {
  assert.equal(isDemoOtp('123456'), true);
  assert.equal(isDemoOtp(123456), true);
  assert.equal(isDemoOtp('000000'), false);
});

test('density framework recommends salaried core for high density areas', () => {
  const strategy = getDensityStrategy(2.4);
  assert.equal(strategy.allocation_strategy, 'salaried_core');
  assert.equal(strategy.salaried_ratio, 0.8);
});

test('density fallback still produces a usable allocation when analytics service is offline', () => {
  const prediction = buildFallbackPrediction({
    areaId: 'sector-15',
    currentOrders: 20,
    currentWorkers: 10,
  });

  assert.equal(prediction.density_score, 2);
  assert.equal(prediction.allocation_strategy, 'salaried_core');
  assert.equal(prediction.source, 'node_fallback');
  assert.equal(prediction.price_multiplier, 1.2);
});

test('density surge multiplier is clamped for discounts and peak demand', () => {
  assert.equal(getSurgeMultiplier(0.1), 0.85);
  assert.equal(getSurgeMultiplier(1.2), 1);
  assert.equal(getSurgeMultiplier(4), 1.5);
});

test('admin auth supports primary and secondary admin emails', () => {
  const env = {
    ADMIN_EMAIL: 'owner@rahi.local',
    ADMIN_EMAILS: 'ops@rahi.local, finance@rahi.local',
    ADMIN_PASSWORD: 'secret-pass',
  };

  assert.deepEqual(parseAdminEmails(env), [
    'owner@rahi.local',
    'ops@rahi.local',
    'finance@rahi.local',
  ]);
  assert.equal(isConfiguredAdminEmail('OPS@rahi.local', env), true);
  assert.equal(validateAdminCredentials({
    email: 'finance@rahi.local',
    password: 'secret-pass',
  }, env), true);
  assert.equal(validateAdminCredentials({
    email: 'finance@rahi.local',
    password: 'wrong-pass',
  }, env), false);
});
