const pool = require('../config/db');

// Get all leads with filters
const getAllLeads = async (req, res) => {
  try {
    const { status, source, assigned_to, search, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT 
        l.*,
        ls.name as source_name,
        lst.name as status_name,
        lst.color as status_color,
        u.first_name || ' ' || u.last_name as assigned_to_name,
        c.name as interest_course_name,
        b.name as interest_branch_name,
        (SELECT COUNT(*) FROM lead_interactions WHERE lead_id = l.id) as interaction_count,
        (SELECT MAX(created_at) FROM lead_interactions WHERE lead_id = l.id) as last_interaction
      FROM leads l
      LEFT JOIN lead_sources ls ON l.lead_source_id = ls.id
      LEFT JOIN lead_statuses lst ON l.lead_status_id = lst.id
      LEFT JOIN users u ON l.assigned_to = u.id
      LEFT JOIN courses c ON l.interest_course_id = c.id
      LEFT JOIN branches b ON l.interest_branch_id = b.id
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 1;

    if (status) {
      query += ` AND l.lead_status_id = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    if (source) {
      query += ` AND l.lead_source_id = $${paramCount}`;
      params.push(source);
      paramCount++;
    }

    if (assigned_to) {
      query += ` AND l.assigned_to = $${paramCount}`;
      params.push(assigned_to);
      paramCount++;
    }

    if (search) {
      query += ` AND (
        l.first_name ILIKE $${paramCount} OR 
        l.last_name ILIKE $${paramCount} OR 
        l.email ILIKE $${paramCount} OR 
        l.phone ILIKE $${paramCount}
      )`;
      params.push(`%${search}%`);
      paramCount++;
    }

    query += ` ORDER BY l.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM leads WHERE 1=1';
    const countParams = [];
    let countParamCount = 1;

    if (status) {
      countQuery += ` AND lead_status_id = $${countParamCount}`;
      countParams.push(status);
      countParamCount++;
    }

    if (source) {
      countQuery += ` AND lead_source_id = $${countParamCount}`;
      countParams.push(source);
      countParamCount++;
    }

    if (assigned_to) {
      countQuery += ` AND assigned_to = $${countParamCount}`;
      countParams.push(assigned_to);
      countParamCount++;
    }

    if (search) {
      countQuery += ` AND (
        first_name ILIKE $${countParamCount} OR 
        last_name ILIKE $${countParamCount} OR 
        email ILIKE $${countParamCount} OR 
        phone ILIKE $${countParamCount}
      )`;
      countParams.push(`%${search}%`);
    }

    const countResult = await pool.query(countQuery, countParams);

    res.json({
      success: true,
      leads: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Get all leads error:', error);
    res.status(500).json({ error: 'Server error while fetching leads' });
  }
};

// Get single lead by ID
const getLeadById = async (req, res) => {
  try {
    const { id } = req.params;

    const leadQuery = `
      SELECT 
        l.*,
        ls.name as source_name,
        lst.name as status_name,
        lst.color as status_color,
        u.first_name || ' ' || u.last_name as assigned_to_name,
        c.name as interest_course_name,
        b.name as interest_branch_name
      FROM leads l
      LEFT JOIN lead_sources ls ON l.lead_source_id = ls.id
      LEFT JOIN lead_statuses lst ON l.lead_status_id = lst.id
      LEFT JOIN users u ON l.assigned_to = u.id
      LEFT JOIN courses c ON l.interest_course_id = c.id
      LEFT JOIN branches b ON l.interest_branch_id = b.id
      WHERE l.id = $1
    `;

    const interactionsQuery = `
      SELECT 
        li.*,
        u.first_name || ' ' || u.last_name as user_name
      FROM lead_interactions li
      LEFT JOIN users u ON li.user_id = u.id
      WHERE li.lead_id = $1
      ORDER BY li.created_at DESC
    `;

    const [leadResult, interactionsResult] = await Promise.all([
      pool.query(leadQuery, [id]),
      pool.query(interactionsQuery, [id])
    ]);

    if (leadResult.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    res.json({
      success: true,
      lead: leadResult.rows[0],
      interactions: interactionsResult.rows
    });
  } catch (error) {
    console.error('Get lead by ID error:', error);
    res.status(500).json({ error: 'Server error while fetching lead' });
  }
};

// Create new lead
const createLead = async (req, res) => {
  try {
    const {
      first_name,
      middle_name,
      last_name,
      email,
      phone,
      address,
      city,
      province,
      postal_code,
      lead_source_id,
      lead_status_id,
      assigned_to,
      interest_course_id,
      interest_branch_id,
      priority,
      notes,
      tags
    } = req.body;

    // Validate required fields
    if (!first_name || !last_name) {
      return res.status(400).json({ error: 'First name and last name are required' });
    }

    const query = `
      INSERT INTO leads (
        first_name, middle_name, last_name, email, phone,
        address, city, province, postal_code,
        lead_source_id, lead_status_id, assigned_to,
        interest_course_id, interest_branch_id,
        priority, notes, tags
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *
    `;

    const values = [
      first_name, middle_name, last_name, email, phone,
      address, city, province, postal_code,
      lead_source_id, lead_status_id, assigned_to,
      interest_course_id, interest_branch_id,
      priority || 'medium', notes, tags
    ];

    const result = await pool.query(query, values);

    res.status(201).json({
      success: true,
      lead: result.rows[0]
    });
  } catch (error) {
    console.error('Create lead error:', error);
    if (error.code === '23505') { // Unique violation
      res.status(400).json({ error: 'Email already exists' });
    } else {
      res.status(500).json({ error: 'Server error while creating lead' });
    }
  }
};

// Update lead
const updateLead = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      first_name,
      middle_name,
      last_name,
      email,
      phone,
      address,
      city,
      province,
      postal_code,
      lead_source_id,
      lead_status_id,
      assigned_to,
      interest_course_id,
      interest_branch_id,
      lead_score,
      priority,
      notes,
      tags
    } = req.body;

    const query = `
      UPDATE leads SET
        first_name = COALESCE($1, first_name),
        middle_name = COALESCE($2, middle_name),
        last_name = COALESCE($3, last_name),
        email = COALESCE($4, email),
        phone = COALESCE($5, phone),
        address = COALESCE($6, address),
        city = COALESCE($7, city),
        province = COALESCE($8, province),
        postal_code = COALESCE($9, postal_code),
        lead_source_id = COALESCE($10, lead_source_id),
        lead_status_id = COALESCE($11, lead_status_id),
        assigned_to = COALESCE($12, assigned_to),
        interest_course_id = COALESCE($13, interest_course_id),
        interest_branch_id = COALESCE($14, interest_branch_id),
        lead_score = COALESCE($15, lead_score),
        priority = COALESCE($16, priority),
        notes = COALESCE($17, notes),
        tags = COALESCE($18, tags),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $19
      RETURNING *
    `;

    const values = [
      first_name, middle_name, last_name, email, phone,
      address, city, province, postal_code,
      lead_source_id, lead_status_id, assigned_to,
      interest_course_id, interest_branch_id,
      lead_score, priority, notes, tags, id
    ];

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    res.json({
      success: true,
      lead: result.rows[0]
    });
  } catch (error) {
    console.error('Update lead error:', error);
    res.status(500).json({ error: 'Server error while updating lead' });
  }
};

// Delete lead
const deleteLead = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query('DELETE FROM leads WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    res.json({
      success: true,
      message: 'Lead deleted successfully'
    });
  } catch (error) {
    console.error('Delete lead error:', error);
    res.status(500).json({ error: 'Server error while deleting lead' });
  }
};

// Convert lead to student
const convertLead = async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const query = `
      UPDATE leads SET
        is_converted = true,
        converted_to_user_id = $1,
        converted_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;

    const result = await pool.query(query, [user_id, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    res.json({
      success: true,
      lead: result.rows[0]
    });
  } catch (error) {
    console.error('Convert lead error:', error);
    res.status(500).json({ error: 'Server error while converting lead' });
  }
};

// Add interaction to lead
const addInteraction = async (req, res) => {
  try {
    const { lead_id } = req.params;
    const {
      interaction_type,
      subject,
      notes,
      outcome,
      requires_followup,
      followup_date
    } = req.body;

    const user_id = req.user.id; // From auth middleware

    if (!interaction_type) {
      return res.status(400).json({ error: 'Interaction type is required' });
    }

    const query = `
      INSERT INTO lead_interactions (
        lead_id, user_id, interaction_type, subject, notes,
        outcome, requires_followup, followup_date, completed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
      RETURNING *
    `;

    const values = [
      lead_id, user_id, interaction_type, subject, notes,
      outcome, requires_followup || false, followup_date
    ];

    const result = await pool.query(query, values);

    // Update last_contacted_at on the lead
    await pool.query(
      'UPDATE leads SET last_contacted_at = CURRENT_TIMESTAMP WHERE id = $1',
      [lead_id]
    );

    res.status(201).json({
      success: true,
      interaction: result.rows[0]
    });
  } catch (error) {
    console.error('Add interaction error:', error);
    res.status(500).json({ error: 'Server error while adding interaction' });
  }
};

// Get all lead sources
const getLeadSources = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM lead_sources ORDER BY name'
    );

    res.json({
      success: true,
      sources: result.rows
    });
  } catch (error) {
    console.error('Get lead sources error:', error);
    res.status(500).json({ error: 'Server error while fetching lead sources' });
  }
};

// Create lead source
const createLeadSource = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Source name is required' });

    const result = await pool.query(
      'INSERT INTO lead_sources (name) VALUES ($1) RETURNING *',
      [name]
    );

    res.status(201).json({ success: true, source: result.rows[0] });
  } catch (error) {
    console.error('Create source error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Update lead source
const updateLeadSource = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, is_active } = req.body;

    const result = await pool.query(
      'UPDATE lead_sources SET name = COALESCE($1, name), is_active = COALESCE($2, is_active), updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
      [name, is_active, id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Source not found' });
    res.json({ success: true, source: result.rows[0] });
  } catch (error) {
    console.error('Update source error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Delete lead source
const deleteLeadSource = async (req, res) => {
  try {
    const { id } = req.params;
    // Check if source is in use
    const checkUse = await pool.query('SELECT id FROM leads WHERE lead_source_id = $1 LIMIT 1', [id]);
    if (checkUse.rows.length > 0) {
      return res.status(400).json({ error: 'Cannot delete source as it is being used by leads. Deactivate it instead.' });
    }

    const result = await pool.query('DELETE FROM lead_sources WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Source not found' });
    res.json({ success: true, message: 'Source deleted' });
  } catch (error) {
    console.error('Delete source error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get all lead statuses
const getLeadStatuses = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM lead_statuses ORDER BY sort_order'
    );

    res.json({
      success: true,
      statuses: result.rows
    });
  } catch (error) {
    console.error('Get lead statuses error:', error);
    res.status(500).json({ error: 'Server error while fetching lead statuses' });
  }
};

// Create lead status
const createLeadStatus = async (req, res) => {
  try {
    const { name, color, sort_order } = req.body;
    if (!name) return res.status(400).json({ error: 'Status name is required' });

    const result = await pool.query(
      'INSERT INTO lead_statuses (name, color, sort_order) VALUES ($1, $2, $3) RETURNING *',
      [name, color || '#2563eb', sort_order || 0]
    );

    res.status(201).json({ success: true, status: result.rows[0] });
  } catch (error) {
    console.error('Create status error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Update lead status
const updateLeadStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, color, sort_order, is_active } = req.body;

    const result = await pool.query(
      'UPDATE lead_statuses SET name = COALESCE($1, name), color = COALESCE($2, color), sort_order = COALESCE($3, sort_order), is_active = COALESCE($4, is_active), updated_at = CURRENT_TIMESTAMP WHERE id = $5 RETURNING *',
      [name, color, sort_order, is_active, id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Status not found' });
    res.json({ success: true, status: result.rows[0] });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Delete lead status
const deleteLeadStatus = async (req, res) => {
  try {
    const { id } = req.params;
    // Check if status is in use
    const checkUse = await pool.query('SELECT id FROM leads WHERE lead_status_id = $1 LIMIT 1', [id]);
    if (checkUse.rows.length > 0) {
      return res.status(400).json({ error: 'Cannot delete status as it is being used by leads. Deactivate it instead.' });
    }

    const result = await pool.query('DELETE FROM lead_statuses WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Status not found' });
    res.json({ success: true, message: 'Status deleted' });
  } catch (error) {
    console.error('Delete status error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get all lead interactions (global feed)
const getAllInteractions = async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const query = `
      SELECT 
        li.*,
        u.first_name || ' ' || u.last_name as user_name,
        l.first_name || ' ' || l.last_name as lead_name
      FROM lead_interactions li
      LEFT JOIN users u ON li.user_id = u.id
      LEFT JOIN leads l ON li.lead_id = l.id
      ORDER BY li.created_at DESC
      LIMIT $1 OFFSET $2
    `;

    const result = await pool.query(query, [limit, offset]);

    res.json({
      success: true,
      interactions: result.rows
    });
  } catch (error) {
    console.error('Get all interactions error:', error);
    res.status(500).json({ error: 'Server error while fetching interactions' });
  }
};

// Get CRM dashboard stats
const getCRMStats = async (req, res) => {
  try {
    const [
      totalLeadsResult,
      newLeadsResult,
      convertedLeadsResult,
      todayInteractionsResult,
      conversionRateResult
    ] = await Promise.all([
      pool.query('SELECT COUNT(*) as total FROM leads'),
      pool.query(`
        SELECT COUNT(*) as total FROM leads 
        WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)
      `),
      pool.query(`
        SELECT COUNT(*) as total FROM leads 
        WHERE is_converted = true 
        AND converted_at >= DATE_TRUNC('month', CURRENT_DATE)
      `),
      pool.query(`
        SELECT COUNT(*) as total FROM lead_interactions 
        WHERE created_at >= CURRENT_DATE AND created_at < CURRENT_DATE + INTERVAL '1 day'
      `),
      pool.query(`
        SELECT 
          COUNT(CASE WHEN is_converted = true THEN 1 END) as converted,
          COUNT(*) as total
        FROM leads
        WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month'
      `)
    ]);

    const totalLeads = parseInt(totalLeadsResult.rows[0].total);
    const newLeads = parseInt(newLeadsResult.rows[0].total);
    const convertedLeads = parseInt(convertedLeadsResult.rows[0].total);
    const todayInteractions = parseInt(todayInteractionsResult.rows[0].total);

    const conversionData = conversionRateResult.rows[0];
    const conversionRate = conversionData.total > 0
      ? ((conversionData.converted / conversionData.total) * 100).toFixed(1)
      : 0;

    res.json({
      success: true,
      stats: {
        totalLeads,
        newLeads,
        convertedLeads,
        todayInteractions,
        conversionRate: parseFloat(conversionRate)
      }
    });
  } catch (error) {
    console.error('Get CRM stats error:', error);
    res.status(500).json({ error: 'Server error while fetching CRM stats' });
  }
};

// Create lead from contact form submission
const createLeadFromContact = async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    // Split name into first and last name
    const nameParts = name.trim().split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

    // Get "Website" source ID
    const sourceResult = await pool.query(
      "SELECT id FROM lead_sources WHERE name = 'Website' LIMIT 1"
    );
    const websiteSourceId = sourceResult.rows[0]?.id;

    // Get "New" status ID
    const statusResult = await pool.query(
      "SELECT id FROM lead_statuses WHERE name = 'New' LIMIT 1"
    );
    const newStatusId = statusResult.rows[0]?.id;

    // Create the lead
    const query = `
      INSERT INTO leads (
        first_name, last_name, email, lead_source_id, lead_status_id,
        priority, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const notes = `Contact Form Inquiry - Subject: ${subject}\n\nMessage: ${message}`;

    const values = [
      firstName,
      lastName,
      email,
      websiteSourceId,
      newStatusId,
      'medium',
      notes
    ];

    const result = await pool.query(query, values);

    // Auto-create an interaction for the contact form submission
    if (result.rows[0]) {
      await pool.query(
        `INSERT INTO lead_interactions (
          lead_id, user_id, interaction_type, subject, notes, completed_at
        ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
        [
          result.rows[0].id,
          1, // System user (you may want to create a system user)
          'email',
          `Website Contact Form: ${subject}`,
          message
        ]
      );
    }

    res.status(201).json({
      success: true,
      lead: result.rows[0],
      message: 'Lead created from contact form'
    });
  } catch (error) {
    console.error('Create lead from contact error:', error);
    // If email already exists, just log the interaction
    if (error.code === '23505') {
      try {
        const existingLead = await pool.query(
          'SELECT id FROM leads WHERE email = $1',
          [req.body.email]
        );

        if (existingLead.rows[0]) {
          await pool.query(
            `INSERT INTO lead_interactions (
              lead_id, user_id, interaction_type, subject, notes, completed_at
            ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
            [
              existingLead.rows[0].id,
              1,
              'email',
              `Website Contact Form: ${req.body.subject}`,
              req.body.message
            ]
          );

          return res.json({
            success: true,
            message: 'Interaction logged for existing lead'
          });
        }
      } catch (innerError) {
        console.error('Error logging interaction:', innerError);
      }
    }
    res.status(500).json({ error: 'Server error while creating lead from contact form' });
  }
};

// Create lead from course interest
const createLeadFromCourseInterest = async (req, res) => {
  try {
    const { name, email, phone, course_id, message } = req.body;

    // Split name
    const nameParts = name.trim().split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

    const sourceResult = await pool.query(
      "SELECT id FROM lead_sources WHERE name = 'Website' LIMIT 1"
    );
    const websiteSourceId = sourceResult.rows[0]?.id;

    const statusResult = await pool.query(
      "SELECT id FROM lead_statuses WHERE name = 'New' LIMIT 1"
    );
    const newStatusId = statusResult.rows[0]?.id;

    const query = `
      INSERT INTO leads (
        first_name, last_name, email, phone, lead_source_id, lead_status_id,
        interest_course_id, priority, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const values = [
      firstName,
      lastName,
      email,
      phone || null,
      websiteSourceId,
      newStatusId,
      course_id || null,
      'high', // Course interest is higher priority
      message || 'Interested in course information'
    ];

    const result = await pool.query(query, values);

    res.status(201).json({
      success: true,
      lead: result.rows[0]
    });
  } catch (error) {
    console.error('Create lead from course interest error:', error);
    if (error.code === '23505') {
      res.status(400).json({ error: 'Lead with this email already exists' });
    } else {
      res.status(500).json({ error: 'Server error while creating lead' });
    }
  }
};

module.exports = {
  getAllLeads,
  getLeadById,
  createLead,
  updateLead,
  deleteLead,
  convertLead,
  addInteraction,
  getAllInteractions,
  getLeadSources,
  createLeadSource,
  updateLeadSource,
  deleteLeadSource,
  getLeadStatuses,
  createLeadStatus,
  updateLeadStatus,
  deleteLeadStatus,
  getCRMStats,
  createLeadFromContact,
  createLeadFromCourseInterest
};
