# Hoarding_Management

Hoarding Management System - Complete Database Schema
System Overview
This system manages the workflow between different user types for hoarding/billboard advertising:

SuperAdmin: System administrator
HoardingOwner: Owns hoardings/billboards
BannerUser: Wants to display advertisements on hoardings
Worker: Performs installation/maintenance work

Complete Workflow
1. HoardingOwner creates Hoarding → Status: Available
2. BannerUser browses available Hoardings
3. BannerUser creates BannerRequest → sent to HoardingOwner for approval
4. HoardingOwner approves/rejects BannerRequest
5. If approved → BannerUser creates WorkAssignment for Worker
6. Worker receives Task in their panel
7. Worker accepts/rejects Task
8. If accepted → Worker completes the installation work
9. Task marked as completed → BannerUser verifies
10. Campaign goes live
Database Models
1. User Model (User.js)
Purpose: Stores all user types with role-specific fields
Key Fields:

userType: Enum ["SuperAdmin", "HoardingOwner", "BannerUser", "Worker"]
HoardingOwner fields: business, hoardingLicense, gstNumber, etc.
Worker fields: workerType, experience, skills, availability
Common fields: email, password, address, accountStatus, etc.

Changes Made:

Fixed typo: alternateMobliNumber → alternateMobileNumber
Added worker-specific fields: workerType, experience, skills, availability
Added rating system: averageRating, totalRatings
Added street and pincode to address


2. Hoarding Model (Hoarding.js)
Purpose: Stores individual hoardings/billboards owned by HoardingOwners
Key Fields:

owner: Reference to User (HoardingOwner)
hoardingCode: Unique identifier
location: Complete address with coordinates
dimensions: Width, height, calculated area
type: Billboard, Pole, Digital, etc.
pricePerMonth, pricePerDay: Rental pricing
availability: Available, Booked, Reserved
features: Lighting type, facing direction, traffic count

Relationships:

One HoardingOwner → Many Hoardings
One Hoarding → Many BannerRequests


3. CompanyHoarding Model (CompanyHoarding.js)
Purpose: For companies that manage multiple hoardings as a business entity
Key Fields:

owner: Reference to User (HoardingOwner)
companyName, registrationNumber
hoardings: Array of Hoarding references
totalHoardings: Auto-calculated count
documents: Registration, GST, PAN certificates
verificationStatus: Pending, Verified, Rejected

Use Case:

Large advertising companies with multiple locations
Centralized management of hoarding portfolio


4. BannerRequest Model (BannerRequest.js) ⭐ NEW
Purpose: BannerUser requests approval from HoardingOwner to display banner
Key Fields:

requestNumber: Unique identifier
bannerUser: Reference to User (BannerUser)
hoarding: Reference to Hoarding
hoardingOwner: Reference to User (HoardingOwner)
campaignName, bannerDetails: Campaign information
duration: startDate, endDate, totalDays
pricing: basePrice, discount, totalAmount
requestStatus: Pending, Approved, Rejected, Cancelled
ownerResponse: Approval/rejection details
paymentStatus, paymentDetails: Payment tracking
workAssignment: Link to WorkAssignment once approved

Workflow:

BannerUser creates request
HoardingOwner reviews and approves/rejects
If approved → payment processed
WorkAssignment created for installation


5. WorkAssignment Model (WorkAssignment.js) ⭐ NEW
Purpose: BannerUser assigns work to Worker for installation/maintenance
Key Fields:

assignmentNumber: Unique identifier
bannerRequest: Reference to approved BannerRequest
bannerUser: Who needs the work done
worker: Who will do the work
hoarding: Where the work will be done
workType: Installation, Maintenance, Removal, Replacement
workDetails: Title, description, materials needed
scheduledDate: When the work should be done
assignmentStatus: Pending, WorkerApproved, InProgress, Completed
workerResponse: Acceptance/rejection by worker
payment: Worker fee and payment status
workProgress: Array of progress updates with images
completionDetails: Before/after images, signatures
rating: Mutual ratings between BannerUser and Worker

Workflow:

After BannerRequest approval, BannerUser creates WorkAssignment
Worker receives notification
Worker accepts/rejects
If accepted → Work begins → Progress updates
Work completed → Verification → Payment


6. Task Model (Task.js) ⭐ NEW
Purpose: Individual tasks shown in Worker's panel (task list)
Key Fields:

taskNumber: Unique identifier
workAssignment: Reference to WorkAssignment
worker: Assigned worker
hoarding: Work location
taskTitle, taskDescription: What needs to be done
taskType: Installation, Maintenance, Removal, etc.
priority: Low, Medium, High, Urgent
status: Assigned, Accepted, InProgress, Completed, Verified
scheduledDate, dueDate: Timeline
checklistItems: Task checklist with completion tracking
progress: Start time, end time, duration, percentage
updates: Array of progress updates
completionDetails: Completion notes, images, signature
expenses: Work-related expenses

Worker Panel Features:

View all assigned tasks
Filter by status, priority, date
Accept/reject tasks
Update progress with images
Track time and expenses
Mark tasks as complete
View task history


Database Relationships Diagram
User (HoardingOwner)
  ↓ owns
Hoarding
  ↓ referenced in
BannerRequest ←── created by ←── User (BannerUser)
  ↓ approved by
  ↓ User (HoardingOwner)
  ↓ generates
WorkAssignment
  ↓ assigned to
  ↓ User (Worker)
  ↓ creates
Task ←── shown in Worker Panel
Key Workflows
Workflow 1: Banner Display Request
1. BannerUser browses available Hoardings
2. BannerUser creates BannerRequest
   - Selects hoarding
   - Provides campaign details
   - Specifies duration
   - Submits for approval
3. HoardingOwner receives notification
4. HoardingOwner reviews request
   - Can approve or reject
   - If rejected → provides reason
   - If approved → moves to payment
5. Payment processed
6. BannerRequest status updated to "Approved"
Workflow 2: Work Assignment
1. After BannerRequest approval
2. BannerUser creates WorkAssignment
   - Selects available Worker
   - Specifies work type (Installation)
   - Provides work details
   - Sets scheduled date
   - Specifies worker fee
3. System creates Task for Worker
4. Worker receives notification in their panel
5. Worker reviews task details
   - Can accept or reject
   - If rejected → provides reason
   - If accepted → status changes to "Accepted"
6. Worker starts work → updates progress
7. Worker completes work → uploads photos
8. BannerUser verifies completion
9. Payment released to Worker
10. Both parties can rate each other
Workflow 3: Worker Panel Task Management
Worker logs in → Dashboard shows:

PENDING TASKS:
- New task assignments waiting for acceptance
- Can view details and accept/reject

ACCEPTED TASKS:
- Tasks accepted but not started
- Can start work

IN PROGRESS TASKS:
- Currently working on
- Can update progress, add photos
- Can pause/resume
- Can add expenses

COMPLETED TASKS:
- Work done, waiting for verification
- Shows completion details

TASK FILTERS:
- By priority (Urgent, High, Medium, Low)
- By date (Today, This Week, Overdue)
- By type (Installation, Maintenance, etc.)
- By location (nearby tasks)
Additional Features to Implement
1. Notification System
Create a Notification model to track:

New BannerRequests for HoardingOwner
Approval/rejection notifications for BannerUser
New task assignments for Worker
Payment notifications
Rating reminders

2. Payment System
Create a Payment model to track:

BannerUser → HoardingOwner payments
BannerUser → Worker payments
Payment gateway integration
Invoices and receipts
Refunds

3. Rating & Review System
Create a Review model for:

BannerUser rates HoardingOwner
BannerUser rates Worker
Worker rates BannerUser
Display ratings on profiles

4. Analytics & Reporting

Hoarding occupancy rates
Revenue tracking
Worker performance metrics
Campaign effectiveness

API Endpoints Structure
BannerRequest Endpoints:

POST /api/banner-requests - Create new request
GET /api/banner-requests - Get all requests (with filters)
GET /api/banner-requests/:id - Get single request
PUT /api/banner-requests/:id/approve - HoardingOwner approves
PUT /api/banner-requests/:id/reject - HoardingOwner rejects
PUT /api/banner-requests/:id/cancel - BannerUser cancels

WorkAssignment Endpoints:

POST /api/work-assignments - Create new assignment
GET /api/work-assignments - Get all assignments
GET /api/work-assignments/:id - Get single assignment
PUT /api/work-assignments/:id/accept - Worker accepts
PUT /api/work-assignments/:id/reject - Worker rejects
PUT /api/work-assignments/:id/progress - Update progress
PUT /api/work-assignments/:id/complete - Mark as complete

Task Endpoints (Worker Panel):

GET /api/tasks/my-tasks - Get all tasks for logged-in worker
GET /api/tasks/:id - Get task details
PUT /api/tasks/:id/accept - Accept task
PUT /api/tasks/:id/reject - Reject task
PUT /api/tasks/:id/start - Start working
PUT /api/tasks/:id/update-progress - Update progress
PUT /api/tasks/:id/complete - Mark complete
POST /api/tasks/:id/add-expense - Add expense

Status Flow
BannerRequest Status Flow:
Pending → Approved → Paid
        ↓
        Rejected
        ↓
        Cancelled
WorkAssignment Status Flow:
Pending → WorkerApproved → InProgress → Completed
        ↓
        WorkerRejected
        ↓
        Cancelled
Task Status Flow:
Assigned → Accepted → InProgress → Completed → Verified
         ↓          ↓
         Rejected   OnHold
                    ↓
                    Cancelled
Security Considerations

Authentication: JWT tokens for all API requests
Authorization: Role-based access control

HoardingOwner can only approve their own hoarding requests
Worker can only view/update tasks assigned to them
BannerUser can only create requests and assignments


Data Validation: Mongoose validation + express-validator
File Upload: Secure file upload for images and documents
Payment Security: PCI compliance for payment processing

Next Steps

✅ Create all models (Done)
Create controllers for each model
Create API routes
Implement authentication & authorization
Create frontend components
Implement real-time notifications (Socket.io)
Integrate payment gateway
Testing & deployment


Summary of Models Created:

User.js (Updated with worker fields)
Hoarding.js (Individual hoardings)
CompanyHoarding.js (Company portfolio)
BannerRequest.js (Approval workflow)
WorkAssignment.js (Work delegation)
Task.js (Worker task management)

Total: 6 models for complete system functionality
