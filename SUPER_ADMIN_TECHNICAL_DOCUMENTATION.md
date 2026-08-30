# 📘 GRACIA 2026 Jubilee Celebration & Musical Concert
## Super Admin Technical Architecture & Systems Engineering Documentation

---

### 1. System Overview & Technology Stack
The **GRACIA 2026 Web Application** is a production-grade, full-stack event management and ticketing platform developed for **Jesus Youth Singapore**. It coordinates attendee registrations, seat reservations, payment processing via PayNow/HitPay, automated PDF pass issuance, email communications, venue check-in via hardware & camera QR scanning, Spiritual Bouquet tracking, and role-based administrative workflows.

#### **Frontend Architecture**
* **Framework:** React 18 with TypeScript 5
* **Build System:** Vite with Hot Module Reloading disabled for Cloud Run sandboxed environments
* **Styling & Icons:** Tailwind CSS with utility animations, Lucide React icons, and `motion/react` layout transitions
* **QR Rendering:** `qrcode.react` (`QRCodeSVG`) with high-contrast background padding and Error Correction Level `H`
* **Camera Scanner:** `html5-qrcode` tuned strictly for `QR_CODE` decoding format with Web Audio API harmonic chimes (C5-E5-G5-C6) and haptic feedback (`navigator.vibrate`)

#### **Backend Runtime & API Proxy**
* **Server Runtime:** Node.js Express server (`server.ts`)
* **Bundle Target:** Compiled using `esbuild` to CommonJS (`dist/server.cjs`)
* **Port Ingress:** Port `3000` bound to host `0.0.0.0`
* **PDF Pass Generator:** Server-side `pdfkit` engine (`/src/lib/pdfServerGenerator.ts`) creating vector entry passes with embedded QR codes
* **SMTP Transport:** `nodemailer` connecting to secure SMTP host with HTML email templates and attached PDF passes

#### **Database & Cloud Infrastructure**
* **Primary Database:** Google Cloud Firestore (`ai-studio-graciajysgjubile-5a9e3705-027d-4d95-b577-b02be2713722`)
* **Authentication:** Firebase Authentication (Email/Password & Google OAuth)
* **Real-time Synchronization:** On-demand queries and real-time Firestore snapshots
* **Disaster Recovery:** Pre-wipe audit backup snapshots (`audit_backups`) and full database JSON export/import

---

### 2. Comprehensive Component & Module Breakdown

#### **2.1 Public Delegate Registration (`/src/components/RegistrationForm.tsx`)**
* **Registration Types:**
  1. **Conference Delegate ($10 SGD):** Includes 2-day full conference access + complimentary $10 Musical Concert entry. Supports individual or Family Package discount calculation ($30 family flat rate for 4+ members).
  2. **Musical Concert Only ($10 SGD):** Direct concert ticket registration.
* **Fields & Validation:** Full Name, Email, Mobile/WhatsApp, Church/Parish, Category (Youth, Working Adult, Senior, Child), Dietary requirements, and Special Assistance needs.
* **Family Group Offer Engine:** Dynamically calculates total amount due based on family headcount.
* **Payment Integration:** Prominently displays PayNow QR / UEN details with screenshot upload field. Also supports HitPay online checkout redirect.

#### **2.2 Seat Allocation & Interactive Grid (`/src/components/InteractiveSeatGrid.tsx`)**
* **Layout Grid:** Interactive visual map displaying seating zones (VIP, General, Choir, Wheelchair Access).
* **Real-Time Locking:** Integrates with Firestore seat reservations to prevent double-booking.
* **Admin Override:** Super Admins can lock, reserve, or re-assign seats directly from the Admin Panel.

#### **2.3 Digital Pass & Badge Engine (`/src/components/ConferencePass.tsx` & `/src/components/DigitalConferenceBadge.tsx`)**
* **QR Code Security:** Encodes structured JSON containing `passId`, delegate name, category, and event metadata.
* **Manual Pass Reference ID:** Human-readable short ID (e.g. `PSALM-118:14` or `GRACIA-2026-8921`) for fallback search.
* **Badge Badge Copy:** Displays mandatory venue badge text:
  > *"Includes $10 Musical Concert Ticket & Full Conference Access"*
* **Digital Features:** Photo avatar upload, Apple Wallet / Google Wallet pass export, and PDF pass download.

#### **2.4 Venue Check-In & Scanner Interface (`/src/components/TicketCheckInView.tsx`)**
* **QR Camera Scanner:** Utilizes `html5-qrcode` with hardware back camera preference (`facingMode: "environment"`).
* **Instant Validation Feedback:**
  * **Success:** Green flash + 4-note ascending chime + double vibration pulse.
  * **Already Checked In:** Orange flash + 2-tone warning sound + "Already Checked In at [Time]" alert.
  * **Invalid Pass:** Red flash + low error tone.
* **USB / Handheld Barcode Scanner Support:** Listens to keyboard input stream with auto-submit on Enter key.
* **Manual Lookup Fallback:** Real-time search across Pass ID, Registrant Name, Email, or Phone Number.

#### **2.5 Spiritual Bouquet Counter (`/src/components/SpiritualBouquetSection.tsx`)**
* **Intercession Categories:** Masses offered, Rosaries recited, Eucharistic Adoration hours, Fasting days, and Acts of Charity.
* **Real-Time Global Counter:** Live Firestore aggregate totals incremented globally as delegates log prayers.

#### **2.6 Prayer Group Allocation Engine (`/src/components/AdminPanel.tsx` -> Groups Sub-Tab)**
* **Automatic Group Sizing:** Configurable max members per group (default: 15 members).
* **Intercessor Assignment:** Balances conference delegates into small prayer circles with assigned group leaders.

---

### 3. Backend Express API Endpoints

| Endpoint | Method | Functionality |
| :--- | :--- | :--- |
| `/api/register-proxy` | `POST` | Primary registration endpoint. Validates payload, writes records to Firestore, calls PDF pass generator, and sends Nodemailer confirmation email. |
| `/api/verify-payment` | `POST` | Admin endpoint to verify PayNow screenshots and mark payment status as `verified`. |
| `/api/hitpay-webhook` | `POST` | Webhook receiver for automated HitPay online card & PayNow payment confirmations. |
| `/api/send-batch-reminders` | `POST` | Batch email engine sending personalized payment reminder emails to unverified registrations. |

---

### 4. Database Schema & Firestore Collections

#### **Collection: `registrations`**
```typescript
interface RegistrationData {
  id: string;
  passId: string;
  name: string;
  email: string;
  phone: string;
  type: 'conference' | 'musical';
  churchParish?: string;
  category?: 'youth' | 'adult' | 'senior' | 'child';
  paymentStatus: 'pending' | 'verified' | 'unpaid';
  paymentAmount?: number;
  paymentScreenshotUrl?: string;
  additionalAttendees?: Array<{ name: string; age?: number; category?: string }>;
  checkedIn: boolean;
  checkedInAt?: string;
  checkedInBy?: string;
  assignedSeat?: string;
  assignedGroup?: string;
  createdAt: string;
}
```

#### **Collection: `audit_backups`**
Stores full snapshot payloads prior to Go Live data wipes or bulk deletions for complete disaster recovery.

#### **Collection: `registration_audit_logs`**
Tracks all administrative edit, deletion, bulk deletion, and restoration events with timestamp and admin email.

---

### 5. Super Admin Disaster Recovery & Operations

1. **Pre-Event Go Live Clear:**
   * Open Admin Panel → Registrations Tab → Click **🚀 GO LIVE (CLEAR ALL)**.
   * Type security confirmation `GO LIVE CLEAR`.
   * Automatically creates a pre-wipe snapshot in `audit_backups` and prompts for JSON backup download before purging test records.

2. **Full Database JSON Backup & Restore:**
   * Click **BACKUP & SYNC**.
   * **Export:** Downloads a structured JSON snapshot of all Firestore collections suitable for Google Drive storage.
   * **Restore:** Upload any previously exported JSON file to restore records instantly into Firestore.

---
*GRACIA 2026 Technical & Architecture Manual • Jesus Youth Singapore*
