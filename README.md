# RAHI - Density-Optimized Blue-Collar Service Marketplace

RAHI is a full-stack service marketplace for blue-collar and home-service workers. It connects customers, workers, contractors, and admins through one operational platform, then adds a density-based intelligence layer to help the business decide where to use salaried staff versus freelancers.

The project has moved beyond a simple booking app. It now demonstrates a practical logistics engine for Tier-2 and Tier-3 service operations: customer booking, worker acceptance, OTP-controlled job lifecycle, payment tracking, admin visibility, and a predictive density console for workforce planning.

![React](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-2563eb)
![Backend](https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-111827)
![Database](https://img.shields.io/badge/Database-MongoDB-16a34a)
![AI](https://img.shields.io/badge/AI-Random%20Forest%20POC-059669)
![Status](https://img.shields.io/badge/Status-Prototype%20Hardening-f59e0b)

## What RAHI Does

RAHI is designed around one core workflow:

1. Customer signs up or logs in.
2. Customer books a service.
3. Worker receives and accepts the booking.
4. Customer tracks the worker.
5. Job starts with OTP verification.
6. Job completes with OTP verification.
7. Payment is recorded.
8. Customer, worker, and admin see the correct status/history.

This workflow is the foundation for a trusted local services platform.

## Why This Project Matters

Most gig-service platforms struggle with the same problem: too many orders and not enough reliable workers, or too many paid workers and not enough demand.

RAHI introduces a density-based operating model:

```text
Density = Predicted Orders in an Area / Active Workers in that Area
```

High density means the area needs a reliable salaried core team. Low density means the area should stay freelancer-led to reduce fixed salary burn.

This gives RAHI a business logic layer that can support growth decisions, investor conversations, and city-by-city expansion planning.

## Density Intelligence Engine

The admin portal includes a RAHI Density Intelligence Console. It is built to explain the operational, predictive, and proof-of-concept logic behind RAHI's workforce model.

It shows:

- Predicted service demand.
- Active worker capacity.
- Density score.
- Recommended workforce mix.
- Salaried-to-freelancer ratio.
- Sector portfolio comparison.
- 12-week demand pressure curve.
- Demo fallback model for investor presentations.

The intelligence layer currently supports:

- Node.js fallback density logic.
- Python FastAPI analytics microservice.
- Random Forest-based demand prediction POC.
- Admin UI demo mode when backend services are unavailable.

## Architecture

```text
blue-collar-worker-hackathon-project/
├── Backend/
│   ├── src/
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── models/
│   │   ├── utils/
│   │   ├── config/
│   │   └── index.js
│   ├── scripts/
│   └── tests/
├── react/app/
│   ├── src/
│   │   ├── components/
│   │   ├── contexts/
│   │   ├── pages/
│   │   ├── hooks/
│   │   └── integrations/
│   └── microservices/
│       └── analytics-service/
├── render.yaml
├── vercel.json
└── .env.example
```

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18, Vite, TypeScript, Tailwind CSS, Radix UI |
| Backend | Node.js, Express, MongoDB Native Driver, Socket.IO |
| AI/Analytics | Python, FastAPI, scikit-learn, Random Forest Regressor |
| Auth | JWT, role-based access, OTP demo flow |
| Realtime | Socket.IO |
| Deployment | Vercel frontend, Render backend/Docker blueprint |
| Testing | Node test runner, Vitest, TypeScript type-check |

## Key Features

### Customer

- Register/login flow.
- Service browsing.
- Booking flow.
- Booking history.
- Worker tracking UI.
- Payment flow.

### Worker

- Worker profile and settings.
- Availability/job request handling.
- Earnings page.
- Schedule and booking status flow.
- OTP-based job start/completion.

### Admin

- Hidden admin portal at `/admin-portal-2026`.
- User, worker, booking, finance, heatmap, system, and bug-monitoring sections.
- Demo admin bypass for presentations.
- Density Intelligence Console.
- Multi-admin email support.
- Admin recovery request flow.

### Intelligence

- Density Rule implementation.
- Random Forest analytics microservice.
- Fallback recommendation logic if Python service is unavailable.
- Demo-safe density model for investor walkthroughs.
- Sector-based workforce allocation recommendation.

## Local Setup

### 1. Clone the Repository

```bash
git clone https://github.com/Harshtech1/blue-collar-worker-hackathon-project.git
cd blue-collar-worker-hackathon-project
```

### 2. Configure Environment Variables

Create local `.env` files from `.env.example`.

Important variables:

```env
PORT=5000
MONGO_URI=
JWT_SECRET=
SMTP_EMAIL=
SMTP_PASSWORD=
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
CLIENT_URL=http://localhost:5173
ADMIN_EMAIL=
ADMIN_EMAILS=
ADMIN_PASSWORD=
ANALYTICS_SERVICE_URL=http://localhost:8000
VITE_API_URL=http://localhost:5000/api
VITE_BACKEND_API_URL=http://localhost:5000
```

Cloud connector values used by the current Vercel/Render setup:

```env
VITE_API_URL=https://blue-collar-worker-hackathon-project.onrender.com/api
VITE_BACKEND_API_URL=https://blue-collar-worker-hackathon-project.onrender.com
ANALYTICS_SERVICE_URL=<Render analytics service private hostport or http://localhost:8000 locally>
```

Never commit real `.env` files. They are intentionally ignored.

### 3. Install Backend Dependencies

```bash
cd Backend
npm install
```

### 4. Install Frontend Dependencies

```bash
cd ../react/app
npm install
```

### 5. Install Analytics Service Dependencies

```bash
cd microservices/analytics-service
python -m pip install -r requirements.txt
```

## Running Locally

Start the backend:

```bash
cd Backend
npm start
```

Start the frontend:

```bash
cd react/app
npm run dev -- --host 0.0.0.0
```

Start the analytics microservice:

```bash
cd react/app/microservices/analytics-service
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

Open:

```text
http://localhost:5173
```

Admin portal:

```text
http://localhost:5173/admin-portal-2026
```

Analytics API docs:

```text
http://localhost:8000/docs
```

## Demo Mode

The admin portal includes a local presentation bypass:

```text
Open Demo Density Console
```

Use this when the backend, MongoDB, or Python analytics service is unavailable. It opens a local demo version of the Density Intelligence Console and uses realistic synthetic density data for presentation.

This is intended only for demos. It does not unlock production data.

## Testing

Backend tests:

```bash
cd Backend
npm test
```

Frontend type-check:

```bash
cd react/app
npm run type-check
```

Frontend production build:

```bash
cd react/app
npm run build
```

Live gate workflow check:

```bash
cd Backend
npm run live-gate
```

The live gate script expects the backend to be running and environment variables such as:

```env
LIVE_GATE_API_URL=http://localhost:5000/api
LIVE_GATE_SOCKET_URL=http://localhost:5000
```

## Production Notes

Before treating this as a production deployment, verify:

- MongoDB Atlas connectivity and IP access list.
- JWT secret is strong and set in the server environment.
- SMTP credentials are configured safely.
- Admin credentials are stored only in environment variables.
- Real OTP provider replaces demo-only universal OTP behavior.
- Cloudinary/S3 upload keys are configured if image upload is enabled.
- Payment gateway is connected to a real provider.
- Frontend bundle size is optimized with code-splitting.
- Observability/logging is configured for backend errors and failed payments.

## Current Milestone

RAHI is currently in a prototype-hardening and investor-demo stage.

Completed milestone areas:

- Core booking workflow hardening.
- Backend model validation tests.
- Safer admin auth configuration.
- Admin demo bypass.
- Density intelligence dashboard.
- Python Random Forest analytics service.
- Dependency vulnerability cleanup.
- Frontend build/type-check stabilization.

## Roadmap

### Phase 1: Solid Core Workflow

- Customer registration/login.
- Service booking.
- Worker accept/decline.
- Worker tracking.
- OTP job start and completion.
- Payment recording.
- Role-specific history/status views.

### Phase 2: Intelligence Layer

- Live Random Forest model using real booking data.
- Sector-level density reports.
- Worker availability forecasting.
- Burn/churn simulation.
- Admin decision recommendations.

### Phase 3: Production Readiness

- Real OTP provider.
- Real payment gateway.
- File upload pipeline.
- Monitoring and audit logs.
- CI/CD checks.
- Scalable deployment architecture.

## Pitch Summary

RAHI is not only a service booking app. It is a density-optimized workforce logistics platform for the Indian blue-collar economy.

The core idea:

```text
Use data to decide where quality needs salaried reliability
and where cost control needs freelancer flexibility.
```

That makes RAHI easier to demo, easier to explain to mentors, and stronger as an investor-facing startup prototype.

## Repository

GitHub:

```text
https://github.com/Harshtech1/blue-collar-worker-hackathon-project
```

## License

This repository is currently marked as ISC in the backend package metadata. Review and update licensing before commercial use.
