# 📖 GRACIA 2026 Admin User Manual & Role Operations Guide
## Jesus Youth Singapore - 25th Silver Jubilee Celebration & Musical Concert

---

### 1. Introduction & Admin Access Roles
The **GRACIA 2026 Admin Portal** is designed with clear role-based access control (RBAC) to ensure security, data integrity, and operational efficiency during the 25th Jubilee Celebration.

#### **Role Permissions Matrix**

| Operational Feature | Super Admin | General Admin | Scanner Volunteer |
| :--- | :---: | :---: | :---: |
| View Attendee List & Search | ✅ | ✅ | ❌ (Restricted) |
| Verify Payments & Upload Receipts | ✅ | ✅ | ❌ |
| Send Pass Email Reminders | ✅ | ✅ | ❌ |
| Edit Attendee Details & Seats | ✅ | ✅ | ❌ |
| Venue QR Camera Check-In | ✅ | ✅ | ✅ |
| Assign Prayer Groups & Intercessions | ✅ | ✅ | ❌ |
| Manage Site Content & Announcements | ✅ | ❌ | ❌ |
| Manage Admin User Accounts & Roles | ✅ | ❌ | ❌ |
| Go Live Test Data Wipe | ✅ | ❌ | ❌ |
| Full Database Backup & JSON Restore | ✅ | ❌ | ❌ |

---

### 2. User Interface & Feature Walkthrough

#### **2.1 Navigation Sub-Tabs**
Once logged into the Admin Panel, administrators can navigate between 9 primary management views via the top tab bar:

1. **Messages (`Inbox`):** View, reply to, and archive contact form inquiries submitted by delegates on the public website.
2. **Registrations (`Users`):** Main control center for all attendee registrations, payment verification, pass re-issuance, CSV exports, backup sync, and Go Live clearing.
3. **Admins (`ShieldCheck`):** Add, edit, or revoke admin privileges and assign operational roles.
4. **Site Content (`FileText`):** Update public website banners, program schedule timelines, speakers list, and event details without touching code.
5. **Sheets & Export (`Table`):** Live synchronization status with Google Sheets for offline committee reporting.
6. **Tickets & Seating (`Ticket`):** Interactive seat grid manager for assigning VIP seats, choir blocks, and wheelchair spaces.
7. **Intercessions (`HeartHandshake`):** Review and manage spiritual bouquet prayer commitments submitted by the community.
8. **Invitations (`Key`):** Manage invitation codes for VIP delegates, clergy, and special guests.
9. **Prayer Groups (`Users`):** Group allocation engine that automatically breaks conference delegates into small prayer circles.

---

### 3. Step-by-Step Operations Guide for Admins

#### **3.1 How to Verify Delegate Payments & Issue Digital Passes**
1. Navigate to the **Registrations** tab.
2. Filter by **Conference**, **Musical**, or **All Registrations**.
3. Use the **Search Bar** to find attendees by Name, Email, or WhatsApp Phone Number.
4. Look at the **Payment Status** column:
   * **Pending:** PayNow screenshot uploaded but needs admin review.
   * **Verified:** Payment confirmed and digital pass email issued.
   * **Unpaid:** Awaiting payment proof.
5. Click **View Receipt** to inspect the delegate's PayNow transaction screenshot.
6. Click **Mark Verified** to confirm receipt. The system will automatically update the record and trigger the Nodemailer PDF Pass email dispatch to the delegate.

#### **3.2 How to Send Bulk Payment Reminder Emails**
1. In the **Registrations** tab toolbar, locate the **Send Email Reminders** button.
2. The badge count indicates the total number of unverified attendees.
3. Click the button to review the recipient list preview.
4. Click **Send Reminders** to automatically dispatch personalized payment instruction emails containing PayNow UEN details.

#### **3.3 How to Conduct Venue QR Check-In (Scanner Volunteer Role)**
1. Log into the system using a **Scanner Volunteer** account or navigate directly to the Check-In interface.
2. Grant camera permissions when prompted by your phone or scanner device.
3. Point the 250x250px viewfinder at the attendee's digital pass QR code (on their smartphone screen or printed PDF pass).
4. **Audio & Visual Indicators:**
   * **Green Screen Flash + Ascending 4-Note Chime:** Check-in successful! Pass validated.
   * **Orange Screen Flash + Low Double Tone:** Warning! Pass was already scanned and checked in previously.
   * **Red Screen Flash + Low Error Tone:** Invalid QR code or record not found in system.
5. **Manual Search Fallback:** If the attendee's phone battery died or screen is broken, type their short Pass ID (e.g. `PSALM-118:14`), Name, or Phone into the manual search box and click **Check-In**.

#### **3.4 How to Allocate Prayer Groups**
1. Navigate to the **Prayer Groups** tab.
2. Set your desired **Max Members per Group** (e.g., 15 members).
3. Click **Auto-Generate Prayer Groups**.
4. The system will automatically balance delegates by category (Youth, Working Adults) and assign group leaders.
5. Click **Export Group Roster CSV** to share assignments with team leads.

---

### 4. Super Admin Operations & Disaster Recovery

#### **4.1 Performing Pre-Event "Go Live" Test Data Clearing**
1. Ensure all pre-event test registrations have been reviewed.
2. Click the **🚀 GO LIVE (CLEAR ALL)** button on the Registrations toolbar.
3. In the Go Live Modal:
   * Review the summary stats (Total Entries, Total Attendees, Conference vs. Musical breakdown).
   * Click **Download Pre-Wipe Backup JSON** to save a copy locally or to Google Drive.
   * Check the option *"Also clear old test activity audit logs"* if desired.
   * Type the exact security lock string: `GO LIVE CLEAR`.
   * Click **PERFORM GO-LIVE WIPE**.
4. The system will create an automatic snapshot in the Firestore `audit_backups` collection and wipe active registrations.

#### **4.2 Full Database JSON Backup & One-Click Restore**
1. Click **BACKUP & SYNC** on the Registrations toolbar.
2. **To Backup:** Click **Export & Download Full JSON**. Store this file securely in Google Drive or offline storage.
3. **To Restore:** Click **Upload & Restore Backup JSON**, select a previously saved `.json` backup file, and confirm. The system will safely restore all registration records and audit logs into Firestore.

---
*GRACIA 2026 Admin User Manual & Operational Guide • Jesus Youth Singapore*
