# CRM Management System - Setup Guide

## Overview

A comprehensive Customer Relationship Management (CRM) system has been added to the admin panel. This allows you to:

- Track and manage leads (potential students)
- Record interactions with leads
- Monitor conversion rates
- Assign leads to staff members
- Track the sales funnel
- Manage lead sources and statuses

## Database Setup

### Apply the CRM Migration

The CRM system requires new database tables. Apply the migration:

**Option 1: Using psql**
```bash
cd booking-system-backend
psql -U postgres -d booking_system -f migrations/add_crm_system.sql
```

**Option 2: Using pgAdmin**
1. Open pgAdmin 4
2. Connect to your `booking_system` database
3. Open Query Tool
4. Load and execute: `migrations/add_crm_system.sql`

## Features

### 1. Lead Management
- Add new leads with complete contact information
- Edit existing lead details
- Delete leads
- View lead details with interaction history

### 2. Lead Tracking
- **Sources**: Track where leads come from (Website, Social Media, Walk-in, Referral, etc.)
- **Statuses**: Monitor lead progress (New, Contacted, Qualified, Converted, Lost, etc.)
- **Priority Levels**: Set priority (Low, Medium, High, Urgent)
- **Assignment**: Assign leads to staff members

### 3. Interactions
- Log all interactions with leads (calls, emails, meetings, WhatsApp, SMS, visits)
- Record outcomes and next steps
- Set follow-up reminders
- View complete interaction history

### 4. CRM Dashboard
- Total leads count
- New leads this month
- Converted leads
- Conversion rate tracking
- Today's interactions count

### 5. Filtering & Search
- Search by name, email, or phone
- Filter by status, source, or assigned staff
- Quick access to all lead information

## Tables Created

1. **leads** - Main leads table with contact and tracking info
2. **lead_sources** - Reference table for lead sources
3. **lead_statuses** - Reference table for lead statuses  
4. **lead_interactions** - Log of all interactions with leads
5. **lead_attachments** - Store documents/files related to leads

## Default Data

The migration automatically creates:

### Lead Sources
- Website
- Social Media
- Walk-in
- Referral
- Phone Call
- Email
- Advertisement
- Other

### Lead Statuses
- New
- Contacted
- Qualified
- Proposal Sent
- Negotiation
- Converted
- Lost
- Not Interested

## How to Use

### Accessing CRM
1. Log in to the admin panel
2. Click **CRM** in the sidebar menu
3. The CRM dashboard will display

### Adding a Lead
1. Click **"+ Add New Lead"** button
2. Fill in the lead information:
   - Personal details (name, contact info, address)
   - Lead source and status
   - Assign to a staff member
   - Set priority level
   - Select interested course and branch
   - Add notes
3. Click **"Create Lead"**

### Logging Interactions
1. Find the lead in the table
2. Click the **chat icon** (Log Interaction)
3. Select interaction type
4. Add subject and detailed notes
5. Record the outcome
6. Set follow-up if needed
7. Click **"Log Interaction"**

### Viewing Lead Details
1. Click the **eye icon** (View Details) on any lead
2. View complete contact information
3. See all interaction history
4. Log new interactions directly from this view

### Editing Leads
1. Click the **edit icon** on any lead
2. Update any information
3. Click **"Update Lead"**

### Converting Leads
When a lead becomes a student, they can be marked as converted:
- The system tracks conversion metrics
- Helps calculate conversion rates
- Links to the actual student user account

## API Endpoints

All CRM endpoints are under `/api/crm`:

- `GET /api/crm/stats` - Get CRM dashboard statistics
- `GET /api/crm/leads` - Get all leads (with filters)
- `GET /api/crm/leads/:id` - Get single lead details
- `POST /api/crm/leads` - Create new lead
- `PUT /api/crm/leads/:id` - Update lead
- `DELETE /api/crm/leads/:id` - Delete lead
- `POST /api/crm/leads/:id/convert` - Mark lead as converted
- `POST /api/crm/leads/:lead_id/interactions` - Log interaction
- `GET /api/crm/sources` - Get all lead sources
- `GET /api/crm/statuses` - Get all lead statuses

## Permissions

The CRM system is accessible to:
- **Admin** - Full access
- **HRM** - Full access
- **Staff** - Full access
- **Students** - No access

## Files Created/Modified

### Backend
- ✅ `migrations/add_crm_system.sql` - Database migration
- ✅ `controllers/crmController.js` - CRM business logic
- ✅ `routes/crm.js` - CRM API routes
- ✅ `server.js` - Added CRM routes

### Frontend
- ✅ `src/admin/CRM.jsx` - CRM main component
- ✅ `src/admin/css/crm.css` - CRM styling
- ✅ `src/admin/Admin.jsx` - Added CRM tab
- ✅ `src/admin/components/Sidebar.jsx` - Added CRM menu item
- ✅ `src/services/api.js` - Added CRM API calls

### Documentation
- ✅ `CRM_SETUP_GUIDE.md` - This guide

## Best Practices

1. **Regular Updates**: Keep lead information up to date
2. **Log All Interactions**: Record every contact with leads
3. **Set Priorities**: Use priority levels to focus on hot leads
4. **Follow-up**: Use the follow-up reminder feature
5. **Assign Leads**: Distribute leads among staff for better management
6. **Review Metrics**: Check the dashboard regularly to monitor performance

## Troubleshooting

### CRM menu not showing
- Ensure you're logged in as admin, hrm, or staff
- Clear browser cache and refresh

### Database errors
- Verify the migration was applied successfully
- Check PostgreSQL logs for specific errors
- Ensure all foreign key references are valid

### API errors
- Check that the backend server is running
- Verify the `/api/crm` route is registered in `server.js`
- Check browser console for specific error messages

## Future Enhancements

Possible features to add:
- Email integration for automatic interaction logging
- SMS/WhatsApp integration
- Lead scoring automation
- Custom fields for leads
- Advanced reporting and analytics
- Lead import/export functionality
- Email templates for follow-ups
- Calendar integration for scheduled follow-ups

## Support

For issues or questions about the CRM system:
1. Check this guide first
2. Review the database migration file
3. Check the browser console for errors
4. Review backend server logs

---

**Created**: February 2026
**Version**: 1.0.0
**Status**: Production Ready
