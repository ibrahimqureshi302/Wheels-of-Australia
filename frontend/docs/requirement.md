EPIC 1: Core System & Access Control

🎫 Ticket 1.1
Title: Implement Role-Based Access Control (RBAC) for All User Roles
Description:
 Develop and enforce a role-based access control system supporting Admin, Driver, Rental, and future Mechanic roles. Each role must only access permitted modules and actions.
Acceptance Criteria:
Roles defined: Admin, Driver, Rental, Mechanic (future-ready).


Access restrictions enforced at API and UI level.


Unauthorized access attempts blocked.


Permission violations logged with timestamp and user ID.


Admin has unrestricted access.



🎫 Ticket 1.2
Title: Implement System-Wide Audit Logging Framework
Description:
 Create a centralised logging mechanism to track all critical actions across the system for compliance and traceability.
Acceptance Criteria:
 System logs:
Driver approvals/rejections


Face verification attempts


GPS disable events


Suspensions


Admin record modifications


Payment transactions (future phase)
 Each log must include:


Timestamp


User ID


Action type


Related entity reference



👤 EPIC 2: Driver Registration & KYC

🎫 Ticket 2.1
Title: Implement Driver Registration with OTP Verification
Description:
 Allow drivers to register using email, mobile number, and password. Mobile number must be verified via OTP before activation.
Acceptance Criteria:
Email + mobile + password required.


OTP sent to mobile.


Account inactive until OTP verified.


OTP expiry enforced.


Failed OTP attempts handled.


Registration event logged.



🎫 Ticket 2.2
Title: Implement Driver Document Upload for KYC
Description:
 Enable upload of passport, driving licence, and visa (if applicable) during onboarding.
Acceptance Criteria:
Accept PDF, JPG, PNG.


Files encrypted at rest.


Documents linked to driver profile.


Upload failures handled gracefully.


Upload action logged.



🎫 Ticket 2.3
Title: Implement OCR Extraction for Identity Documents
Description:
 Extract identity information from uploaded documents and auto-populate profile fields.
Acceptance Criteria:
 System extracts:
Full name


Date of birth


Document number


Expiry date


Nationality
 Driver can edit extracted data before confirmation.
 Extraction success/failure logged.



🎫 Ticket 2.4
Title: Implement Face Recognition Verification with Threshold & Retry Logic
Description:
 Perform biometric verification using live selfie and compare with passport/licence image.
Acceptance Criteria:
Explicit biometric consent required.


Live selfie capture supported.


Confidence score calculated.


If score ≥ threshold → Verified.


If score < threshold → Retry allowed.


Max 3 failed attempts.


After 3 failures → Account locked.


Lock flagged for admin review.


All attempts logged.



🎫 Ticket 2.5
Title: Implement Biometric Data Security & Retention Controls
Description:
 Ensure biometric processing complies with Australian Privacy Act requirements.
Acceptance Criteria:
Biometric templates encrypted.


Raw images auto-deleted after verification (unless legally required).


Data encrypted in transit.


Access restricted to authorised services.


User consent stored with timestamp.


Biometric deletion request supported.


All biometric events logged.



🚗 EPIC 3: Rental Registration & Fleet Management

🎫 Ticket 3.1
Title: Implement Rental Registration (Company & Individual)
Description:
 Allow rental accounts to register as company (with certificate upload) or individual.
Acceptance Criteria:
Registration type selectable.


Company requires certificate upload.


Certificate securely stored.


Admin approval status supported.


Registration logged.



🎫 Ticket 3.2
Title: Implement Fleet Management Module
Description:
 Allow rentals to add and manage vehicles.
Acceptance Criteria:
 Rental can add:
Car model


Car images


Colour


Number plate


Odometer


Last oil change date


Rego expiry date


Insurance details


Vehicle updates logged.

🎫 Ticket 3.3
Title: Implement Vehicle Browsing & Rental Request Workflow
Description:
 Allow drivers to browse vehicles and submit rental requests.
Acceptance Criteria:
Driver can view rentals.


Driver can view vehicles per rental.


Driver can submit request.


Rental can approve, reject, or request more info.


Driver notified of decision.


All actions logged.


🎫 Ticket 3.4
Title: Implement Rental Portal Staff (Sub-Users with Configurable Menus)
Description:
 Allow main rental accounts to create and manage rental staff (sub-users). Each staff member has their own login and sees only the menus the main rental assigns. Main rental retains full access and a dedicated "Rental staff" management section.
Acceptance Criteria:
 Main rental can:
List all staff created by their account.


Add staff with first name, last name, email, phone, and initial password.


Edit staff details (first name, last name, email, phone) and allowed menus.


Delete (remove) staff; removed staff can no longer sign in.


 Assign per-staff allowed menus (e.g. Dashboard, Vehicle, Rental requests, Live map); staff see only those items plus Dashboard.
 Staff accounts use same role as main rental but are distinguished by allowed_nav_paths; main rental has no path restriction and sees "Rental staff" in the sidebar.
 Form layout: fields (first name, last name, email, phone, password on add) in responsive rows (same pattern as drivers/vehicle forms).
 All staff management actions logged (future backend).



📍 EPIC 4: GPS Tracking & Enforcement

🎫 Ticket 4.1
Title: Implement Continuous GPS Tracking via Driver Mobile
Description:
 Enable real-time tracking of vehicle location using driver mobile device.
Acceptance Criteria:
Location permission required at onboarding.


Continuous tracking during rental.


Rental can view live location.


Location logs stored with timestamp.


Temporary GPS loss handled gracefully.



🎫 Ticket 4.2
Title: Implement Location Disable Detection & Suspension Logic
Description:
 Detect when driver disables location tracking and enforce warning policy.
Acceptance Criteria:
System detects disable event.


Driver receives warning.


Rental notified.


Warning count stored.


After 3 warnings → Automatic suspension.


Suspension logged.


Admin override supported.



🎫 Ticket 4.3
Title: Implement GPS-Based Distance Calculation
Description:
 Aggregate GPS logs to calculate total distance travelled per vehicle.
Acceptance Criteria:
Distance aggregated from GPS data.


Rental can view total distance.


Calculation accuracy verified.


Distance records stored.



🔧 EPIC 5: Maintenance & Compliance Management

🎫 Ticket 5.1
Title: Implement Oil Change & Rego Expiry Notification Logic
Description:
 Trigger alerts based on oil change schedule and rego expiry date.
Acceptance Criteria:
Oil reminder triggered by date or odometer threshold.


Rego expiry reminder triggered before expiry date.


Notifications stored in system.


Events logged.



🎫 Ticket 5.2
Title: Implement Weekly Odometer Photo Upload Requirement
Description:
 Require drivers to upload weekly odometer photo for verification.
Acceptance Criteria:
Weekly reminder generated.


Driver uploads odometer image.


Odometer value stored.


Rental can view submission.


Missed submission flagged.



🎫 Ticket 5.3
Title: Implement Service Slip Upload & OCR Extraction
Description:
 Allow driver to upload oil service receipt and extract maintenance data.
Acceptance Criteria:
 System extracts:
Odometer


Oil type


Service date


Workshop name


Data saved to vehicle record.
 Upload logged.

🔔 EPIC 6: Notification Engine

🎫 Ticket 6.1
Title: Implement Centralised In-App Notification System
Description:
 Develop a notification engine supporting system alerts.
Acceptance Criteria:
 Supports:
Oil due


Rego expiry


Payment due


Rental decision


Location disabled


Suspension


Notifications:
Stored in database


Markable as read


Timestamped



🛠 EPIC 7: Mechanic Module (Future Phase)

🎫 Ticket 7.1
Title: Implement Mechanic Registration with Admin Approval
Description:
 Allow workshops to register and upload certificate for approval.
Acceptance Criteria:
Workshop registration form.


Certificate upload required.


Admin approval required.


Status visible to mechanic.



🎫 Ticket 7.2
Title: Implement Digital Oil Change Approval Workflow
Description:
 Allow mechanic to confirm oil change digitally, replacing receipt upload.
Acceptance Criteria:
Mechanic receives oil change notification.


Mechanic updates odometer, oil type, service date.


Rental approves service.


Receipt upload no longer required after mechanic confirmation.


All events logged.



💳 EPIC 8: Payment Module (Future Phase)

🎫 Ticket 8.1
Title: Implement Advance Rent & Oil Payment Handling
Description:
 Allow driver to pay advance rent and oil charges.
Acceptance Criteria:
Support bank transfer and card.


Payment status stored.


Payment history accessible.


Failed payment handled gracefully.


Transaction logged.



🎫 Ticket 8.2
Title: Implement Weekly Settlement to Rental
Description:
 Transfer weekly rent to rental after system processing.
Acceptance Criteria:
Weekly settlement job executes.


Transfer record stored.


Rental can view payment history.


Settlement logs maintained.



🎨 EPIC 9: Admin Theme & System Control

🎫 Ticket 9.1
Title: Implement Admin-Controlled Theme & Branding Settings
Description:
 Allow admin to change system logo, colour scheme, and theme.
Acceptance Criteria:
Admin can upload logo.


Admin can change primary colour.


Admin can change theme settings.


Changes reflected across system.


Changes logged.



📊 EPIC 10: Performance & Availability

🎫 Ticket 10.1
Title: Implement Performance Monitoring & SLA Enforcement
Description:
Ensure system meets defined performance benchmarks.
Acceptance Criteria:
Vehicle list loads < 3 seconds under normal load.


GPS updates near real-time.


Monitoring system implemented.


Performance logs stored.


Coverage Confirmation
This ticket set now covers:
✔ Registration
 ✔ KYC + OCR
 ✔ Face Recognition
 ✔ Retry + Lock Logic
 ✔ Biometric compliance
 ✔ Fleet management
 ✔ Rental workflow
 ✔ Rental portal staff (sub-users, configurable menus)
 ✔ GPS tracking
 ✔ Distance calculation
 ✔ Location disable suspension
 ✔ Weekly odometer
 ✔ Oil + rego notifications
 ✔ Service OCR
 ✔ Mechanic future workflow
 ✔ Payment future phase
 ✔ Admin theme control
 ✔ Audit logging
 ✔ Performance monitoring
100% aligned with your SRS.

