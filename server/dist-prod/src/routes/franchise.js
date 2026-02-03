import express from 'express';
import pool from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Helper for database queries
const db = {
  query: (text, params) => pool.query(text, params)
};

// ============================================
// FRANCHISE NETWORKS
// ============================================

// Get all networks (admin only)
router.get('/networks', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        n.*,
        COUNT(DISTINCT l.id) as location_count,
        COUNT(DISTINCT t.id) as territory_count,
        COALESCE(SUM(l.monthly_revenue), 0) as total_monthly_revenue
      FROM franchise_networks n
      LEFT JOIN franchise_locations l ON n.id = l.network_id AND l.status = 'active'
      LEFT JOIN franchise_territories t ON n.id = t.network_id
      WHERE n.is_active = true
      GROUP BY n.id
      ORDER BY n.name
    `);

    res.json({ networks: result.rows });
  } catch (error) {
    console.error('Error fetching franchise networks:', error);
    res.status(500).json({ error: 'Failed to fetch franchise networks' });
  }
});

// Get single network with details
router.get('/networks/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const networkResult = await db.query(
      'SELECT * FROM franchise_networks WHERE id = $1',
      [id]
    );

    if (networkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Network not found' });
    }

    const locationsResult = await db.query(`
      SELECT l.*, t.name as territory_name
      FROM franchise_locations l
      LEFT JOIN franchise_territories t ON l.territory_id = t.id
      WHERE l.network_id = $1
      ORDER BY l.name
    `, [id]);

    const territoriesResult = await db.query(`
      SELECT t.*, l.name as assigned_location_name
      FROM franchise_territories t
      LEFT JOIN franchise_locations l ON t.assigned_to_location_id = l.id
      WHERE t.network_id = $1
      ORDER BY t.name
    `, [id]);

    res.json({
      network: networkResult.rows[0],
      locations: locationsResult.rows,
      territories: territoriesResult.rows
    });
  } catch (error) {
    console.error('Error fetching network:', error);
    res.status(500).json({ error: 'Failed to fetch network' });
  }
});

// Create network
router.post('/networks', async (req, res) => {
  try {
    const {
      name,
      code,
      legalName,
      logoUrl,
      primaryColor,
      secondaryColor,
      accentColor,
      headquartersAddress,
      headquartersCity,
      headquartersState,
      headquartersPostalCode,
      headquartersCountry,
      phone,
      email,
      website,
      defaultCurrency,
      defaultTimezone,
      fiscalYearStart,
      royaltyType,
      royaltyPercentage,
      royaltyFixedAmount,
      royaltyTiers,
      whiteLabelConfig
    } = req.body;

    const result = await db.query(`
      INSERT INTO franchise_networks (
        name, code, legal_name, logo_url, primary_color, secondary_color, accent_color,
        headquarters_address, headquarters_city, headquarters_state, headquarters_postal_code, headquarters_country,
        phone, email, website, default_currency, default_timezone, fiscal_year_start,
        royalty_type, royalty_percentage, royalty_fixed_amount, royalty_tiers, white_label_config
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
      RETURNING *
    `, [
      name, code, legalName, logoUrl, primaryColor, secondaryColor, accentColor,
      headquartersAddress, headquartersCity, headquartersState, headquartersPostalCode, headquartersCountry || 'United Kingdom',
      phone, email, website, defaultCurrency || 'GBP', defaultTimezone || 'Europe/London', fiscalYearStart || 1,
      royaltyType || 'percentage', royaltyPercentage, royaltyFixedAmount,
      royaltyTiers ? JSON.stringify(royaltyTiers) : null,
      whiteLabelConfig ? JSON.stringify(whiteLabelConfig) : null
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating network:', error);
    res.status(500).json({ error: 'Failed to create network' });
  }
});

// Update network
router.put('/networks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const fields = [];
    const values = [];
    let paramCount = 1;

    const fieldMapping = {
      name: 'name',
      code: 'code',
      legalName: 'legal_name',
      logoUrl: 'logo_url',
      primaryColor: 'primary_color',
      secondaryColor: 'secondary_color',
      accentColor: 'accent_color',
      headquartersAddress: 'headquarters_address',
      headquartersCity: 'headquarters_city',
      headquartersState: 'headquarters_state',
      headquartersPostalCode: 'headquarters_postal_code',
      headquartersCountry: 'headquarters_country',
      phone: 'phone',
      email: 'email',
      website: 'website',
      defaultCurrency: 'default_currency',
      defaultTimezone: 'default_timezone',
      fiscalYearStart: 'fiscal_year_start',
      royaltyType: 'royalty_type',
      royaltyPercentage: 'royalty_percentage',
      royaltyFixedAmount: 'royalty_fixed_amount',
      royaltyTiers: 'royalty_tiers',
      whiteLabelConfig: 'white_label_config',
      isActive: 'is_active'
    };

    for (const [key, value] of Object.entries(updates)) {
      if (fieldMapping[key]) {
        fields.push(`${fieldMapping[key]} = $${paramCount}`);
        values.push(key === 'royaltyTiers' || key === 'whiteLabelConfig' ? JSON.stringify(value) : value);
        paramCount++;
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    values.push(id);

    const result = await db.query(`
      UPDATE franchise_networks
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramCount}
      RETURNING *
    `, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Network not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating network:', error);
    res.status(500).json({ error: 'Failed to update network' });
  }
});

// ============================================
// FRANCHISE LOCATIONS
// ============================================

// Get locations for a network
router.get('/networks/:networkId/locations', async (req, res) => {
  try {
    const { networkId } = req.params;
    const { status } = req.query;

    let query = `
      SELECT
        l.*,
        t.name as territory_name,
        u.email as owner_email,
        u.full_name as owner_name
      FROM franchise_locations l
      LEFT JOIN franchise_territories t ON l.territory_id = t.id
      LEFT JOIN users u ON l.user_id = u.id
      WHERE l.network_id = $1
    `;
    const params = [networkId];

    if (status) {
      query += ` AND l.status = $2`;
      params.push(status);
    }

    query += ` ORDER BY l.name`;

    const result = await db.query(query, params);
    res.json({ locations: result.rows });
  } catch (error) {
    console.error('Error fetching locations:', error);
    res.status(500).json({ error: 'Failed to fetch locations' });
  }
});

// Get single location
router.get('/locations/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const locationResult = await db.query(`
      SELECT
        l.*,
        t.name as territory_name,
        n.name as network_name,
        n.code as network_code
      FROM franchise_locations l
      LEFT JOIN franchise_territories t ON l.territory_id = t.id
      LEFT JOIN franchise_networks n ON l.network_id = n.id
      WHERE l.id = $1
    `, [id]);

    if (locationResult.rows.length === 0) {
      return res.status(404).json({ error: 'Location not found' });
    }

    // Get recent royalties
    const royaltiesResult = await db.query(`
      SELECT * FROM franchise_royalties
      WHERE location_id = $1
      ORDER BY period_start DESC
      LIMIT 12
    `, [id]);

    // Get compliance status
    const complianceResult = await db.query(`
      SELECT
        r.id,
        r.name,
        r.category,
        r.is_critical,
        s.status as submission_status,
        s.score,
        s.submitted_at
      FROM franchise_compliance_requirements r
      LEFT JOIN franchise_compliance_submissions s ON r.id = s.requirement_id AND s.location_id = $1
      WHERE r.network_id = (SELECT network_id FROM franchise_locations WHERE id = $1)
        AND r.is_active = true
      ORDER BY r.is_critical DESC, r.category, r.name
    `, [id]);

    res.json({
      location: locationResult.rows[0],
      royalties: royaltiesResult.rows,
      compliance: complianceResult.rows
    });
  } catch (error) {
    console.error('Error fetching location:', error);
    res.status(500).json({ error: 'Failed to fetch location' });
  }
});

// Create location
router.post('/networks/:networkId/locations', async (req, res) => {
  try {
    const { networkId } = req.params;
    const {
      userId,
      name,
      code,
      legalEntityName,
      businessRegistrationNumber,
      vatNumber,
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      country,
      lat,
      lng,
      phone,
      email,
      website,
      territoryId,
      currency,
      openedDate,
      settings
    } = req.body;

    const result = await db.query(`
      INSERT INTO franchise_locations (
        network_id, user_id, name, code, legal_entity_name, business_registration_number, vat_number,
        address_line1, address_line2, city, state, postal_code, country, lat, lng,
        phone, email, website, territory_id, currency, opened_date, settings
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
      RETURNING *
    `, [
      networkId, userId, name, code, legalEntityName, businessRegistrationNumber, vatNumber,
      addressLine1, addressLine2, city, state, postalCode, country || 'United Kingdom', lat, lng,
      phone, email, website, territoryId, currency || 'GBP', openedDate,
      settings ? JSON.stringify(settings) : null
    ]);

    // Update territory assignment if provided
    if (territoryId) {
      await db.query(`
        UPDATE franchise_territories
        SET assigned_to_location_id = $1, is_available = false
        WHERE id = $2
      `, [result.rows[0].id, territoryId]);
    }

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating location:', error);
    res.status(500).json({ error: 'Failed to create location' });
  }
});

// Update location
router.put('/locations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const fields = [];
    const values = [];
    let paramCount = 1;

    const fieldMapping = {
      name: 'name',
      code: 'code',
      legalEntityName: 'legal_entity_name',
      businessRegistrationNumber: 'business_registration_number',
      vatNumber: 'vat_number',
      addressLine1: 'address_line1',
      addressLine2: 'address_line2',
      city: 'city',
      state: 'state',
      postalCode: 'postal_code',
      country: 'country',
      lat: 'lat',
      lng: 'lng',
      phone: 'phone',
      email: 'email',
      website: 'website',
      territoryId: 'territory_id',
      currency: 'currency',
      royaltyOverrideType: 'royalty_override_type',
      royaltyOverridePercentage: 'royalty_override_percentage',
      royaltyOverrideFixed: 'royalty_override_fixed',
      status: 'status',
      openedDate: 'opened_date',
      terminationDate: 'termination_date',
      whiteLabelOverrides: 'white_label_overrides',
      settings: 'settings'
    };

    for (const [key, value] of Object.entries(updates)) {
      if (fieldMapping[key]) {
        fields.push(`${fieldMapping[key]} = $${paramCount}`);
        values.push(key === 'whiteLabelOverrides' || key === 'settings' ? JSON.stringify(value) : value);
        paramCount++;
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    values.push(id);

    const result = await db.query(`
      UPDATE franchise_locations
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramCount}
      RETURNING *
    `, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Location not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating location:', error);
    res.status(500).json({ error: 'Failed to update location' });
  }
});

// ============================================
// TERRITORIES
// ============================================

// Get territories for a network
router.get('/networks/:networkId/territories', async (req, res) => {
  try {
    const { networkId } = req.params;
    const { available } = req.query;

    let query = `
      SELECT
        t.*,
        l.name as assigned_location_name,
        l.code as assigned_location_code
      FROM franchise_territories t
      LEFT JOIN franchise_locations l ON t.assigned_to_location_id = l.id
      WHERE t.network_id = $1
    `;
    const params = [networkId];

    if (available === 'true') {
      query += ` AND t.is_available = true`;
    }

    query += ` ORDER BY t.name`;

    const result = await db.query(query, params);
    res.json({ territories: result.rows });
  } catch (error) {
    console.error('Error fetching territories:', error);
    res.status(500).json({ error: 'Failed to fetch territories' });
  }
});

// Create territory
router.post('/networks/:networkId/territories', async (req, res) => {
  try {
    const { networkId } = req.params;
    const {
      name,
      code,
      description,
      boundaryType,
      postalCodes,
      boundaryPolygon,
      centerLat,
      centerLng,
      radiusKm,
      isExclusive,
      estimatedPopulation,
      estimatedHouseholds,
      marketPotentialScore
    } = req.body;

    const result = await db.query(`
      INSERT INTO franchise_territories (
        network_id, name, code, description, boundary_type, postal_codes, boundary_polygon,
        center_lat, center_lng, radius_km, is_exclusive, estimated_population,
        estimated_households, market_potential_score
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `, [
      networkId, name, code, description, boundaryType || 'postal_codes',
      postalCodes, boundaryPolygon ? JSON.stringify(boundaryPolygon) : null,
      centerLat, centerLng, radiusKm, isExclusive !== false,
      estimatedPopulation, estimatedHouseholds, marketPotentialScore
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating territory:', error);
    res.status(500).json({ error: 'Failed to create territory' });
  }
});

// Update territory
router.put('/territories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const fields = [];
    const values = [];
    let paramCount = 1;

    const fieldMapping = {
      name: 'name',
      code: 'code',
      description: 'description',
      boundaryType: 'boundary_type',
      postalCodes: 'postal_codes',
      boundaryPolygon: 'boundary_polygon',
      centerLat: 'center_lat',
      centerLng: 'center_lng',
      radiusKm: 'radius_km',
      assignedToLocationId: 'assigned_to_location_id',
      isExclusive: 'is_exclusive',
      isAvailable: 'is_available',
      estimatedPopulation: 'estimated_population',
      estimatedHouseholds: 'estimated_households',
      marketPotentialScore: 'market_potential_score'
    };

    for (const [key, value] of Object.entries(updates)) {
      if (fieldMapping[key]) {
        fields.push(`${fieldMapping[key]} = $${paramCount}`);
        values.push(key === 'boundaryPolygon' ? JSON.stringify(value) : value);
        paramCount++;
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    values.push(id);

    const result = await db.query(`
      UPDATE franchise_territories
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramCount}
      RETURNING *
    `, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Territory not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating territory:', error);
    res.status(500).json({ error: 'Failed to update territory' });
  }
});

// ============================================
// LEADS
// ============================================

// Get leads for a network
router.get('/networks/:networkId/leads', async (req, res) => {
  try {
    const { networkId } = req.params;
    const { status, locationId, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT
        l.*,
        t.name as matched_territory_name,
        loc.name as assigned_location_name
      FROM franchise_leads l
      LEFT JOIN franchise_territories t ON l.matched_territory_id = t.id
      LEFT JOIN franchise_locations loc ON l.assigned_location_id = loc.id
      WHERE l.network_id = $1
    `;
    const params = [networkId];
    let paramCount = 2;

    if (status) {
      query += ` AND l.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    if (locationId) {
      query += ` AND l.assigned_location_id = $${paramCount}`;
      params.push(locationId);
      paramCount++;
    }

    query += ` ORDER BY l.received_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await db.query(query, params);
    res.json({ leads: result.rows });
  } catch (error) {
    console.error('Error fetching leads:', error);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

// Create lead
router.post('/networks/:networkId/leads', async (req, res) => {
  try {
    const { networkId } = req.params;
    const {
      customerName,
      customerEmail,
      customerPhone,
      addressLine1,
      addressLine2,
      city,
      postalCode,
      country,
      lat,
      lng,
      serviceType,
      description,
      urgency,
      estimatedValue,
      source,
      sourceDetails,
      campaignId,
      expiresAt
    } = req.body;

    // Try to match to a territory based on postal code
    let matchedTerritoryId = null;
    if (postalCode) {
      const territoryMatch = await db.query(`
        SELECT id FROM franchise_territories
        WHERE network_id = $1 AND $2 = ANY(postal_codes)
        LIMIT 1
      `, [networkId, postalCode]);

      if (territoryMatch.rows.length > 0) {
        matchedTerritoryId = territoryMatch.rows[0].id;
      }
    }

    const result = await db.query(`
      INSERT INTO franchise_leads (
        network_id, customer_name, customer_email, customer_phone,
        address_line1, address_line2, city, postal_code, country, lat, lng,
        service_type, description, urgency, estimated_value,
        source, source_details, campaign_id, matched_territory_id, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      RETURNING *
    `, [
      networkId, customerName, customerEmail, customerPhone,
      addressLine1, addressLine2, city, postalCode, country || 'United Kingdom', lat, lng,
      serviceType, description, urgency || 'normal', estimatedValue,
      source, sourceDetails ? JSON.stringify(sourceDetails) : null, campaignId,
      matchedTerritoryId, expiresAt
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating lead:', error);
    res.status(500).json({ error: 'Failed to create lead' });
  }
});

// Assign lead to location
router.put('/leads/:id/assign', async (req, res) => {
  try {
    const { id } = req.params;
    const { locationId, assignmentMethod } = req.body;

    const result = await db.query(`
      UPDATE franchise_leads
      SET
        assigned_location_id = $1,
        assigned_at = CURRENT_TIMESTAMP,
        assignment_method = $2,
        status = 'assigned',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *
    `, [locationId, assignmentMethod || 'manual', id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error assigning lead:', error);
    res.status(500).json({ error: 'Failed to assign lead' });
  }
});

// Update lead status
router.put('/leads/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, outcomeNotes, quoteAmount, finalAmount, jobId } = req.body;

    let query = `
      UPDATE franchise_leads
      SET status = $1, updated_at = CURRENT_TIMESTAMP
    `;
    const params = [status];
    let paramCount = 2;

    if (status === 'contacted' && !req.body.firstResponseAt) {
      query += `, first_response_at = CURRENT_TIMESTAMP`;
    }

    if (outcomeNotes !== undefined) {
      query += `, outcome_notes = $${paramCount}`;
      params.push(outcomeNotes);
      paramCount++;
    }

    if (quoteAmount !== undefined) {
      query += `, quote_amount = $${paramCount}`;
      params.push(quoteAmount);
      paramCount++;
    }

    if (finalAmount !== undefined) {
      query += `, final_amount = $${paramCount}`;
      params.push(finalAmount);
      paramCount++;
    }

    if (jobId !== undefined) {
      query += `, job_id = $${paramCount}`;
      params.push(jobId);
      paramCount++;
    }

    query += ` WHERE id = $${paramCount} RETURNING *`;
    params.push(id);

    const result = await db.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating lead status:', error);
    res.status(500).json({ error: 'Failed to update lead status' });
  }
});

// ============================================
// ROYALTIES
// ============================================

// Get royalties for a network
router.get('/networks/:networkId/royalties', async (req, res) => {
  try {
    const { networkId } = req.params;
    const { status, locationId, periodStart, periodEnd } = req.query;

    let query = `
      SELECT
        r.*,
        l.name as location_name,
        l.code as location_code
      FROM franchise_royalties r
      JOIN franchise_locations l ON r.location_id = l.id
      WHERE r.network_id = $1
    `;
    const params = [networkId];
    let paramCount = 2;

    if (status) {
      query += ` AND r.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    if (locationId) {
      query += ` AND r.location_id = $${paramCount}`;
      params.push(locationId);
      paramCount++;
    }

    if (periodStart) {
      query += ` AND r.period_start >= $${paramCount}`;
      params.push(periodStart);
      paramCount++;
    }

    if (periodEnd) {
      query += ` AND r.period_end <= $${paramCount}`;
      params.push(periodEnd);
      paramCount++;
    }

    query += ` ORDER BY r.period_start DESC, l.name`;

    const result = await db.query(query, params);
    res.json({ royalties: result.rows });
  } catch (error) {
    console.error('Error fetching royalties:', error);
    res.status(500).json({ error: 'Failed to fetch royalties' });
  }
});

// Calculate and create royalty for a location
router.post('/locations/:locationId/royalties/calculate', async (req, res) => {
  try {
    const { locationId } = req.params;
    const { periodStart, periodEnd, periodType } = req.body;

    // Get location and network details
    const locationResult = await db.query(`
      SELECT l.*, n.royalty_type, n.royalty_percentage, n.royalty_fixed_amount, n.royalty_tiers
      FROM franchise_locations l
      JOIN franchise_networks n ON l.network_id = n.id
      WHERE l.id = $1
    `, [locationId]);

    if (locationResult.rows.length === 0) {
      return res.status(404).json({ error: 'Location not found' });
    }

    const location = locationResult.rows[0];

    // Calculate gross revenue for the period (from invoices)
    const revenueResult = await db.query(`
      SELECT COALESCE(SUM(total), 0) as gross_revenue
      FROM invoices
      WHERE user_id = $1
        AND status = 'paid'
        AND paid_date >= $2
        AND paid_date <= $3
    `, [location.user_id, periodStart, periodEnd]);

    const grossRevenue = parseFloat(revenueResult.rows[0].gross_revenue) || 0;
    const deductions = 0; // Could add logic for deductions
    const taxableRevenue = grossRevenue - deductions;

    // Calculate royalty amount
    let royaltyType = location.royalty_override_type || location.royalty_type;
    let royaltyRate = location.royalty_override_percentage || location.royalty_percentage;
    let royaltyAmount = 0;

    switch (royaltyType) {
      case 'percentage':
        royaltyAmount = taxableRevenue * (royaltyRate / 100);
        break;
      case 'fixed':
        royaltyAmount = location.royalty_override_fixed || location.royalty_fixed_amount || 0;
        break;
      case 'tiered':
        // Calculate tiered royalty
        const tiers = location.royalty_tiers || [];
        let remainingRevenue = taxableRevenue;
        for (const tier of tiers) {
          const tierAmount = Math.min(remainingRevenue, tier.upTo - (tier.from || 0));
          royaltyAmount += tierAmount * (tier.rate / 100);
          remainingRevenue -= tierAmount;
          if (remainingRevenue <= 0) break;
        }
        break;
      default:
        royaltyAmount = 0;
    }

    // Additional fees (could be configurable)
    const marketingFundAmount = taxableRevenue * 0.02; // 2% marketing fund
    const technologyFee = 0;
    const otherFees = 0;
    const totalDue = royaltyAmount + marketingFundAmount + technologyFee + otherFees;

    // Create royalty record
    const result = await db.query(`
      INSERT INTO franchise_royalties (
        network_id, location_id, period_start, period_end, period_type,
        gross_revenue, deductions, taxable_revenue,
        royalty_type, royalty_rate, royalty_amount,
        marketing_fund_amount, technology_fee, other_fees, total_due,
        due_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      ON CONFLICT (location_id, period_start, period_end)
      DO UPDATE SET
        gross_revenue = EXCLUDED.gross_revenue,
        taxable_revenue = EXCLUDED.taxable_revenue,
        royalty_amount = EXCLUDED.royalty_amount,
        marketing_fund_amount = EXCLUDED.marketing_fund_amount,
        total_due = EXCLUDED.total_due,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [
      location.network_id, locationId, periodStart, periodEnd, periodType || 'monthly',
      grossRevenue, deductions, taxableRevenue,
      royaltyType, royaltyRate, royaltyAmount,
      marketingFundAmount, technologyFee, otherFees, totalDue,
      new Date(new Date(periodEnd).getTime() + 15 * 24 * 60 * 60 * 1000) // Due 15 days after period end
    ]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error calculating royalty:', error);
    res.status(500).json({ error: 'Failed to calculate royalty' });
  }
});

// Update royalty payment status
router.put('/royalties/:id/payment', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, paidAmount, paymentMethod, paymentReference, invoiceNumber } = req.body;

    const updates = ['status = $1', 'updated_at = CURRENT_TIMESTAMP'];
    const params = [status];
    let paramCount = 2;

    if (status === 'paid') {
      updates.push(`paid_date = CURRENT_TIMESTAMP`);
    }

    if (paidAmount !== undefined) {
      updates.push(`paid_amount = $${paramCount}`);
      params.push(paidAmount);
      paramCount++;
    }

    if (paymentMethod) {
      updates.push(`payment_method = $${paramCount}`);
      params.push(paymentMethod);
      paramCount++;
    }

    if (paymentReference) {
      updates.push(`payment_reference = $${paramCount}`);
      params.push(paymentReference);
      paramCount++;
    }

    if (invoiceNumber) {
      updates.push(`invoice_number = $${paramCount}`);
      params.push(invoiceNumber);
      paramCount++;
    }

    params.push(id);

    const result = await db.query(`
      UPDATE franchise_royalties
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Royalty not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating royalty payment:', error);
    res.status(500).json({ error: 'Failed to update royalty payment' });
  }
});

// ============================================
// COMPLIANCE
// ============================================

// Get compliance requirements for a network
router.get('/networks/:networkId/compliance/requirements', async (req, res) => {
  try {
    const { networkId } = req.params;
    const { category } = req.query;

    let query = `
      SELECT * FROM franchise_compliance_requirements
      WHERE network_id = $1 AND is_active = true
    `;
    const params = [networkId];

    if (category) {
      query += ` AND category = $2`;
      params.push(category);
    }

    query += ` ORDER BY is_critical DESC, category, name`;

    const result = await db.query(query, params);
    res.json({ requirements: result.rows });
  } catch (error) {
    console.error('Error fetching compliance requirements:', error);
    res.status(500).json({ error: 'Failed to fetch compliance requirements' });
  }
});

// Create compliance requirement
router.post('/networks/:networkId/compliance/requirements', async (req, res) => {
  try {
    const { networkId } = req.params;
    const {
      name,
      category,
      description,
      frequency,
      evidenceType,
      evidenceTemplate,
      weight,
      isCritical
    } = req.body;

    const result = await db.query(`
      INSERT INTO franchise_compliance_requirements (
        network_id, name, category, description, frequency,
        evidence_type, evidence_template, weight, is_critical
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      networkId, name, category, description, frequency || 'annual',
      evidenceType, evidenceTemplate ? JSON.stringify(evidenceTemplate) : null,
      weight || 1, isCritical || false
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating compliance requirement:', error);
    res.status(500).json({ error: 'Failed to create compliance requirement' });
  }
});

// Get compliance status for a location
router.get('/locations/:locationId/compliance', async (req, res) => {
  try {
    const { locationId } = req.params;

    const result = await db.query(`
      SELECT
        r.*,
        s.id as submission_id,
        s.status as submission_status,
        s.score,
        s.submitted_at,
        s.reviewed_at,
        s.review_notes
      FROM franchise_compliance_requirements r
      LEFT JOIN franchise_compliance_submissions s
        ON r.id = s.requirement_id AND s.location_id = $1
      WHERE r.network_id = (SELECT network_id FROM franchise_locations WHERE id = $1)
        AND r.is_active = true
      ORDER BY r.is_critical DESC, r.category, r.name
    `, [locationId]);

    // Calculate overall compliance score
    let totalWeight = 0;
    let weightedScore = 0;
    let hasCriticalFailure = false;

    for (const item of result.rows) {
      totalWeight += item.weight;
      if (item.submission_status === 'approved' && item.score !== null) {
        weightedScore += item.score * item.weight;
      } else if (item.is_critical && item.submission_status !== 'approved') {
        hasCriticalFailure = true;
      }
    }

    const overallScore = hasCriticalFailure ? 0 : (totalWeight > 0 ? weightedScore / totalWeight : 100);

    res.json({
      items: result.rows,
      overallScore,
      hasCriticalFailure
    });
  } catch (error) {
    console.error('Error fetching compliance status:', error);
    res.status(500).json({ error: 'Failed to fetch compliance status' });
  }
});

// Submit compliance evidence
router.post('/locations/:locationId/compliance/:requirementId/submit', async (req, res) => {
  try {
    const { locationId, requirementId } = req.params;
    const {
      periodStart,
      periodEnd,
      evidenceData,
      documentUrls,
      notes,
      submittedByName
    } = req.body;

    const result = await db.query(`
      INSERT INTO franchise_compliance_submissions (
        requirement_id, location_id, period_start, period_end,
        evidence_data, document_urls, notes, submitted_by_name
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      requirementId, locationId, periodStart, periodEnd,
      evidenceData ? JSON.stringify(evidenceData) : null,
      documentUrls, notes, submittedByName
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error submitting compliance evidence:', error);
    res.status(500).json({ error: 'Failed to submit compliance evidence' });
  }
});

// Review compliance submission
router.put('/compliance/submissions/:id/review', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, score, reviewNotes, reviewedByName } = req.body;

    const result = await db.query(`
      UPDATE franchise_compliance_submissions
      SET
        status = $1,
        score = $2,
        review_notes = $3,
        reviewed_by_name = $4,
        reviewed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING *
    `, [status, score, reviewNotes, reviewedByName, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    // Update location compliance score
    const submission = result.rows[0];
    await db.query(`
      UPDATE franchise_locations
      SET compliance_score = (
        SELECT COALESCE(
          SUM(CASE WHEN s.status = 'approved' THEN s.score * r.weight ELSE 0 END) /
          NULLIF(SUM(r.weight), 0),
          100
        )
        FROM franchise_compliance_requirements r
        LEFT JOIN franchise_compliance_submissions s ON r.id = s.requirement_id AND s.location_id = $1
        WHERE r.network_id = (SELECT network_id FROM franchise_locations WHERE id = $1)
          AND r.is_active = true
      )
      WHERE id = $1
    `, [submission.location_id]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error reviewing compliance submission:', error);
    res.status(500).json({ error: 'Failed to review compliance submission' });
  }
});

// ============================================
// ANNOUNCEMENTS
// ============================================

// Get announcements for a network
router.get('/networks/:networkId/announcements', async (req, res) => {
  try {
    const { networkId } = req.params;
    const { category, limit = 20 } = req.query;

    let query = `
      SELECT * FROM franchise_announcements
      WHERE network_id = $1
        AND publish_at <= CURRENT_TIMESTAMP
        AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
    `;
    const params = [networkId];

    if (category) {
      query += ` AND category = $2`;
      params.push(category);
    }

    query += ` ORDER BY is_pinned DESC, priority DESC, publish_at DESC LIMIT $${params.length + 1}`;
    params.push(parseInt(limit));

    const result = await db.query(query, params);
    res.json({ announcements: result.rows });
  } catch (error) {
    console.error('Error fetching announcements:', error);
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

// Create announcement
router.post('/networks/:networkId/announcements', async (req, res) => {
  try {
    const { networkId } = req.params;
    const {
      title,
      content,
      category,
      priority,
      targetAllLocations,
      targetLocationIds,
      targetTerritoryIds,
      publishAt,
      expiresAt,
      isPinned,
      requiresAcknowledgment,
      createdByName
    } = req.body;

    const result = await db.query(`
      INSERT INTO franchise_announcements (
        network_id, title, content, category, priority,
        target_all_locations, target_location_ids, target_territory_ids,
        publish_at, expires_at, is_pinned, requires_acknowledgment, created_by_name
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `, [
      networkId, title, content, category, priority || 'normal',
      targetAllLocations !== false, targetLocationIds, targetTerritoryIds,
      publishAt || new Date(), expiresAt, isPinned || false,
      requiresAcknowledgment || false, createdByName
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating announcement:', error);
    res.status(500).json({ error: 'Failed to create announcement' });
  }
});

// Acknowledge announcement
router.post('/announcements/:id/acknowledge', async (req, res) => {
  try {
    const { id } = req.params;
    const { locationId, acknowledgedByName } = req.body;

    const result = await db.query(`
      INSERT INTO franchise_announcement_acknowledgments (
        announcement_id, location_id, acknowledged_by_name
      ) VALUES ($1, $2, $3)
      ON CONFLICT (announcement_id, location_id) DO NOTHING
      RETURNING *
    `, [id, locationId, acknowledgedByName]);

    res.json({ acknowledged: true });
  } catch (error) {
    console.error('Error acknowledging announcement:', error);
    res.status(500).json({ error: 'Failed to acknowledge announcement' });
  }
});

// ============================================
// DASHBOARD STATS
// ============================================

// Get network dashboard stats
router.get('/networks/:networkId/dashboard', async (req, res) => {
  try {
    const { networkId } = req.params;

    // Location stats
    const locationStats = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'active') as active_locations,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_locations,
        COUNT(*) FILTER (WHERE status = 'suspended') as suspended_locations,
        COALESCE(SUM(monthly_revenue), 0) as total_monthly_revenue,
        COALESCE(AVG(compliance_score), 100) as avg_compliance_score
      FROM franchise_locations
      WHERE network_id = $1
    `, [networkId]);

    // Lead stats (this month)
    const leadStats = await db.query(`
      SELECT
        COUNT(*) as total_leads,
        COUNT(*) FILTER (WHERE status = 'won') as won_leads,
        COUNT(*) FILTER (WHERE status = 'lost') as lost_leads,
        COUNT(*) FILTER (WHERE status IN ('new', 'assigned')) as pending_leads,
        COALESCE(AVG(response_time_minutes), 0) as avg_response_time
      FROM franchise_leads
      WHERE network_id = $1
        AND received_at >= date_trunc('month', CURRENT_DATE)
    `, [networkId]);

    // Royalty stats (current period)
    const royaltyStats = await db.query(`
      SELECT
        COUNT(*) as total_royalties,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_royalties,
        COUNT(*) FILTER (WHERE status = 'overdue') as overdue_royalties,
        COALESCE(SUM(total_due), 0) as total_due,
        COALESCE(SUM(paid_amount), 0) as total_paid
      FROM franchise_royalties
      WHERE network_id = $1
        AND period_start >= date_trunc('month', CURRENT_DATE) - interval '1 month'
    `, [networkId]);

    // Territory stats
    const territoryStats = await db.query(`
      SELECT
        COUNT(*) as total_territories,
        COUNT(*) FILTER (WHERE is_available = true) as available_territories
      FROM franchise_territories
      WHERE network_id = $1
    `, [networkId]);

    res.json({
      locations: locationStats.rows[0],
      leads: leadStats.rows[0],
      royalties: royaltyStats.rows[0],
      territories: territoryStats.rows[0]
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

export default router;
