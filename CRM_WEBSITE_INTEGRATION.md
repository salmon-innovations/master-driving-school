# CRM Website Integration Guide

## Overview

After analyzing your website, I've integrated automatic lead capture from all visitor touchpoints. This ensures no potential customer inquiry is missed.

## 🎯 Lead Capture Points Implemented

### 1. **Contact Form Integration** ✅
**Location**: [Contact Page](src/pages/Contact.jsx)

**What's Captured:**
- Full Name → Split into First/Last Name
- Email Address
- Subject (General Inquiry, Enrollment Question, Branch Information, Other)
- Message Content

**How It Works:**
1. User fills out contact form on website
2. Form submission automatically creates a lead in CRM
3. Lead is tagged with source: "Website"
4. Initial interaction is logged with the message content
5. Status set to "New" for immediate follow-up
6. Admin gets notification in CRM dashboard

**Technical Details:**
- Endpoint: `POST /api/crm/contact` (public, no auth required)
- Auto-creates lead with priority: Medium
- If email exists, adds new interaction instead
- Integrates seamlessly with existing contact form

---

### 2. **Quick Lead Capture** ✅
**Location**: CRM Dashboard → "Quick Capture" button

**Use Cases:**
- Phone call inquiries
- Walk-in visitors
- Social media messages
- WhatsApp/SMS inquiries
- Emergency lead logging

**Features:**
- Fast single-form capture
- Only essential fields required (Name, Phone, Source)
- Perfect for staff during calls
- Mobile-responsive for on-the-go

**Fields:**
- Full Name * (required)
- Phone * (required)
- Email (optional but recommended)
- Source * (dropdown: Phone Call, Walk-in, Social Media, etc.)
- Quick Notes (brief description)

---

### 3. **Course Interest Capture** ✅
**Endpoint Available**: `POST /api/crm/course-interest`

**Planned Integration Points:**
- "Request More Info" buttons on course cards
- "Call Me Back" forms
- Course detail page inquiries
- Price quote requests

**What's Captured:**
- Name, Email, Phone
- Interested Course ID (links to courses table)
- Additional message/questions
- Priority: HIGH (course interest = ready to buy)

**Implementation Ready For:**
```javascript
// Add this to course pages:
await crmAPI.submitCourseInterest({
    name: "John Doe",
    email: "john@example.com",
    phone: "0927-399-3219",
    course_id: 2,  // PDC Motorcycle
    message: "Want to know about payment plans"
});
```

---

## 📊 Dashboard Enhancements

### Stats Tracking
- **Total Leads**: All leads in system
- **New Leads**: This month's new inquiries
- **Converted Leads**: Successfully enrolled students
- **Today's Interactions**: Staff activity tracking
- **Conversion Rate**: Performance metric

### Lead Sources Available
1. ✅ Website (auto-assigned for contact forms)
2. ✅ Social Media (Facebook, Instagram)
3. ✅ Walk-in (branch visitors)
4. ✅ Referral (existing student recommendations)
5. ✅ Phone Call (direct inquiries)
6. ✅ Email (direct email inquiries)
7. ✅ Advertisement (promo campaigns)
8. ✅ Other (miscellaneous)

### Lead Statuses Flow
```
New → Contacted → Qualified → Proposal Sent → 
Negotiation → Converted (✓)
           ↘ Lost / Not Interested (✗)
```

---

## 🔧 Integration Points

### Contact Page ✅ ACTIVE
- File: `src/pages/Contact.jsx`
- Status: **LIVE** - Auto-capturing to CRM
- Test: Submit contact form → Check CRM dashboard for new lead

### Course Pages 🟡 READY TO ACTIVATE
- Files: `src/pages/Courses.jsx`, course detail views
- Endpoint: Available at `/api/crm/course-interest`
- Add "Request Info" button to course cards:

```jsx
<button onClick={async () => {
    const response = await crmAPI.submitCourseInterest({
        name: user.name || prompt("Your name:"),
        email: user.email,
        phone: user.phone,
        course_id: course.id,
        message: "Interested in more information"
    });
    if (response.success) {
        showNotification("Thanks! We'll contact you soon.", "success");
    }
}}>
    Request More Info
</button>
```

### Homepage 🟡 SUGGESTED
- Add "Get Free Quote" or "Book Consultation" widget
- Floating contact button that captures leads
- Newsletter signup integration

### Sign-Up Process 🟡 SUGGESTED
- Create lead BEFORE account creation
- Track sign-up abandonment
- Follow up with incomplete registrations

---

## 🎨 CRM Features Added

### 1. Quick Lead Capture Modal
- **Green button** in CRM header
- Fast form for immediate lead logging
- Perfect for phone calls and walk-ins
- Auto-assigns "New" status

### 2. Automatic Interaction Logging
- Contact form submissions → Email interaction
- Course interests → Web inquiry
- All timestamped and searchable
- Complete audit trail

### 3. Lead Deduplication
- Email-based duplicate detection
- If lead exists, adds new interaction
- Maintains conversation history
- Prevents duplicate records

### 4. Smart Prioritization
- Contact Form: Medium priority
- Course Interest: High priority
- Walk-in: High priority
- General inquiry: Medium priority

---

## 📈 Usage Workflow

### For Website Visitors:
1. Fill out contact form
2. **Automatically** becomes lead in CRM
3. Receives auto-response (if configured)
4. Staff sees new lead notification

### For Admin Staff:
1. Receives phone call inquiry
2. Click "Quick Capture" in CRM
3. Fill minimal info (Name, Phone, Source)
4. Lead logged instantly
5. Can add detailed notes later

### For Sales Team:
1. Check "New" leads daily
2. Call/email prospects
3. Log each interaction
4. Move through sales funnel
5. Mark as "Converted" when enrolled

---

## 🔒 Security & Privacy

### Public Endpoints (No Auth)
- `/api/crm/contact` - Contact form submission
- `/api/crm/course-interest` - Course inquiry

✅ **Rate limiting recommended** (prevent spam)
✅ **CAPTCHA integration** suggested for production
✅ **Email validation** enforced
✅ **Data sanitization** active

### Protected Endpoints (Auth Required)
- All other CRM operations require login
- Admin/HRM/Staff roles only
- Student data protected

---

## 📝 Next Steps to Enhance

### Short-term (Easy Wins)
1. ✅ **Contact Form** - DONE
2. 🔲 Add "Request Info" buttons to course cards
3. 🔲 Add floating "Chat with Us" widget
4. 🔲 Newsletter signup → Lead capture
5. 🔲 "Get Free Quote" homepage widget

### Medium-term (Value Adds)
1. 🔲 Email auto-responder for new leads
2. 🔲 SMS notifications for staff
3. 🔲 Lead scoring algorithm
4. 🔲 Auto-assignment rules
5. 🔲 Follow-up reminders

### Long-term (Advanced)
1. 🔲 Facebook Lead Ads integration
2. 🔲 WhatsApp Business API
3. 🔲 Chatbot lead capture
4. 🔲 Analytics dashboard
5. 🔲 A/B testing for forms

---

## 🧪 Testing Guide

### Test Contact Form Integration
1. Go to `http://localhost:5173/contact`
2. Fill out form with test data
3. Submit form
4. Login to admin panel
5. Go to CRM section
6. Verify new lead appears with:
   - Name split correctly
   - Source: "Website"
   - Status: "New"
   - Interaction logged with message

### Test Quick Capture
1. Login to admin panel
2. Go to CRM section
3. Click "Quick Capture" button
4. Fill minimal info
5. Submit
6. Verify lead appears immediately

### Test Course Interest (Manual)
```javascript
// Browser console on course page:
await fetch('http://localhost:5000/api/crm/course-interest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        name: "Test User",
        email: "test@example.com",
        phone: "09123456789",
        course_id: 2,
        message: "Test inquiry"
    })
});
// Check CRM for new lead
```

---

## 📞 Lead Sources Mapped to Website

| Website Action | Lead Source | Priority | Auto-Capture? |
|----------------|-------------|----------|---------------|
| Contact Form | Website | Medium | ✅ YES |
| Course "Request Info" | Website | High | 🟡 Ready |
| Phone Call | Phone Call | High | 🔘 Manual (Quick Capture) |
| Facebook Message | Social Media | Medium | 🔲 Future |
| Walk-in Inquiry | Walk-in | High | 🔘 Manual (Quick Capture) |
| Email to masterdrivingschool.ph | Email | Medium | 🔲 Future |
| Newsletter Signup | Website | Low | 🔲 Future |
| Chat Widget | Website | High | 🔲 Future |

---

## 💡 Best Practices

### For Staff:
1. **Respond within 1 hour** to new leads
2. **Log every interaction** (calls, emails, WhatsApp)
3. **Update status** as lead progresses
4. **Add notes** with specific details
5. **Set follow-up reminders**

### For Management:
1. **Review daily** new lead reports
2. **Monitor conversion rates** weekly
3. **Assign leads** to staff evenly
4. **Track response times**
5. **Analyze lead sources** monthly

### For Marketing:
1. **Test different** lead sources
2. **Track which pages** generate most leads
3. **Optimize forms** for conversions
4. **A/B test** CTAs and copy
5. **Monitor quality** vs quantity

---

## 🚨 Troubleshooting

### Contact Form Not Creating Leads
- Check browser console for errors
- Verify backend is running
- Check database connection
- Look for 500 errors in network tab
- Verify CRM migration was applied

### Duplicate Leads Created
- System should prevent by email
- Check for typos in email
- May be intentional if different interaction

### Missing Interactions
- Verify user_id = 1 exists in users table
- Check lead_interactions table directly
- May need to create system user

### Quick Capture Not Working
- Must be logged in as admin/staff/hrm
- Check role permissions
- Verify all required fields filled

---

## 📚 API Reference

### Public Endpoints

#### Create Lead from Contact Form
```http
POST /api/crm/contact
Content-Type: application/json

{
    "name": "John Doe",
    "email": "john@example.com",
    "subject": "Enrollment Question",
    "message": "I want to know about PDC courses"
}
```

**Response:**
```json
{
    "success": true,
    "lead": { ... },
    "message": "Lead created from contact form"
}
```

#### Create Lead from Course Interest
```http
POST /api/crm/course-interest
Content-Type: application/json

{
    "name": "Jane Smith",
    "email": "jane@example.com",
    "phone": "09123456789",
    "course_id": 2,
    "message": "Interested in PDC Motorcycle"
}
```

**Response:**
```json
{
    "success": true,
    "lead": { ... }
}
```

---

## 🎯 Success Metrics

Track these KPIs in CRM:

1. **Lead Volume**: Leads captured per day/week/month
2. **Response Time**: Time from lead creation to first contact
3. **Conversion Rate**: Leads → Enrolled students %
4. **Source Performance**: Which sources convert best
5. **Staff Performance**: Interactions logged, conversions made
6. **Funnel Drop-off**: Where leads get stuck

---

**Created**: February 2026
**Version**: 2.0.0 - Website Integrated
**Status**: Contact Form Live, Others Ready for Activation
