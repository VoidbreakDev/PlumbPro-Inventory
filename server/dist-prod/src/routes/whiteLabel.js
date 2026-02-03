import express from 'express';
import crypto from 'crypto';
import pool from '../config/database.js';

const router = express.Router();

// Helper for database queries
const db = {
  query: (text, params) => pool.query(text, params)
};

// Get white-label configuration
router.get('/config', async (req, res) => {
  try {
    const { networkId } = req.query;
    const userId = req.user?.id;

    let config = null;

    if (networkId) {
      // Get network-specific config
      const result = await db.query(
        'SELECT white_label_config FROM franchise_networks WHERE id = $1',
        [networkId]
      );
      if (result.rows.length > 0) {
        config = result.rows[0].white_label_config;
      }
    } else if (userId) {
      // Get user's organization config
      const result = await db.query(
        'SELECT white_label_config FROM organizations WHERE id = (SELECT organization_id FROM users WHERE id = $1)',
        [userId]
      );
      if (result.rows.length > 0) {
        config = result.rows[0].white_label_config;
      }
    }

    res.json(config || {});
  } catch (error) {
    console.error('Error fetching white-label config:', error);
    res.status(500).json({ error: 'Failed to fetch configuration' });
  }
});

// Update white-label configuration
router.put('/config', async (req, res) => {
  try {
    const { networkId } = req.query;
    const config = req.body;
    const userId = req.user?.id;

    let result;

    if (networkId) {
      // Update network config
      result = await db.query(`
        UPDATE franchise_networks
        SET white_label_config = white_label_config || $1::jsonb,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING white_label_config
      `, [JSON.stringify(config), networkId]);
    } else if (userId) {
      // Update organization config
      result = await db.query(`
        UPDATE organizations
        SET white_label_config = COALESCE(white_label_config, '{}'::jsonb) || $1::jsonb,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = (SELECT organization_id FROM users WHERE id = $2)
        RETURNING white_label_config
      `, [JSON.stringify(config), userId]);
    }

    if (!result || result.rows.length === 0) {
      return res.status(404).json({ error: 'Configuration not found' });
    }

    res.json(result.rows[0].white_label_config);
  } catch (error) {
    console.error('Error updating white-label config:', error);
    res.status(500).json({ error: 'Failed to update configuration' });
  }
});

// Delete/reset configuration
router.delete('/config', async (req, res) => {
  try {
    const { networkId } = req.query;
    const userId = req.user?.id;

    if (networkId) {
      await db.query(`
        UPDATE franchise_networks
        SET white_label_config = '{}'::jsonb,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [networkId]);
    } else if (userId) {
      await db.query(`
        UPDATE organizations
        SET white_label_config = '{}'::jsonb,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = (SELECT organization_id FROM users WHERE id = $1)
      `, [userId]);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error resetting white-label config:', error);
    res.status(500).json({ error: 'Failed to reset configuration' });
  }
});

// Get public branding (for login pages, etc.)
router.get('/branding', async (req, res) => {
  try {
    const host = req.get('host');
    const userId = req.user?.id;

    // Try to find branding by custom domain
    let config = null;

    if (host) {
      // Check for custom domain mapping
      const domainResult = await db.query(`
        SELECT n.white_label_config, n.name, n.logo_url, n.primary_color, n.secondary_color, n.accent_color
        FROM franchise_networks n
        WHERE n.white_label_config->>'customDomain' = $1
          OR n.white_label_config->>'customSubdomain' = $1
      `, [host]);

      if (domainResult.rows.length > 0) {
        const row = domainResult.rows[0];
        config = {
          companyName: row.white_label_config?.companyName || row.name,
          logoUrl: row.white_label_config?.logoUrl || row.logo_url,
          faviconUrl: row.white_label_config?.faviconUrl,
          primaryColor: row.white_label_config?.primaryColor || row.primary_color || '#2563eb',
          secondaryColor: row.white_label_config?.secondaryColor || row.secondary_color || '#1e40af',
          accentColor: row.white_label_config?.accentColor || row.accent_color || '#3b82f6',
          supportEmail: row.white_label_config?.customSupportEmail,
          supportPhone: row.white_label_config?.customSupportPhone,
          termsUrl: row.white_label_config?.customTermsUrl,
          privacyUrl: row.white_label_config?.customPrivacyUrl,
          hidePoweredBy: row.white_label_config?.hidePoweredBy || false,
        };
      }
    }

    // Fallback to user's organization branding
    if (!config && userId) {
      const orgResult = await db.query(`
        SELECT o.name, o.white_label_config
        FROM organizations o
        JOIN users u ON u.organization_id = o.id
        WHERE u.id = $1
      `, [userId]);

      if (orgResult.rows.length > 0) {
        const row = orgResult.rows[0];
        const wlConfig = row.white_label_config || {};
        config = {
          companyName: wlConfig.companyName || row.name || 'PlumbPro',
          logoUrl: wlConfig.logoUrl,
          faviconUrl: wlConfig.faviconUrl,
          primaryColor: wlConfig.primaryColor || '#2563eb',
          secondaryColor: wlConfig.secondaryColor || '#1e40af',
          accentColor: wlConfig.accentColor || '#3b82f6',
          supportEmail: wlConfig.customSupportEmail,
          supportPhone: wlConfig.customSupportPhone,
          termsUrl: wlConfig.customTermsUrl,
          privacyUrl: wlConfig.customPrivacyUrl,
          hidePoweredBy: wlConfig.hidePoweredBy || false,
        };
      }
    }

    // Default branding
    if (!config) {
      config = {
        companyName: 'PlumbPro',
        logoUrl: null,
        faviconUrl: null,
        primaryColor: '#2563eb',
        secondaryColor: '#1e40af',
        accentColor: '#3b82f6',
        supportEmail: null,
        supportPhone: null,
        termsUrl: null,
        privacyUrl: null,
        hidePoweredBy: false,
      };
    }

    res.json(config);
  } catch (error) {
    console.error('Error fetching branding:', error);
    res.status(500).json({ error: 'Failed to fetch branding' });
  }
});

// Initiate domain verification
router.post('/domains/verify', async (req, res) => {
  try {
    const { domain, method, networkId } = req.body;

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Store verification request
    const result = await db.query(`
      INSERT INTO domain_verifications (
        domain, network_id, verification_method, verification_token, status
      ) VALUES ($1, $2, $3, $4, 'pending')
      ON CONFLICT (domain) DO UPDATE SET
        verification_method = EXCLUDED.verification_method,
        verification_token = EXCLUDED.verification_token,
        status = 'pending',
        verified_at = NULL,
        error = NULL,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [domain, networkId, method, verificationToken]);

    const verification = result.rows[0];

    res.json({
      domain: verification.domain,
      status: verification.status,
      verificationMethod: verification.verification_method,
      verificationToken: verification.verification_token,
      verifiedAt: verification.verified_at,
      lastCheckedAt: verification.updated_at,
      error: verification.error,
    });
  } catch (error) {
    console.error('Error initiating domain verification:', error);
    res.status(500).json({ error: 'Failed to initiate domain verification' });
  }
});

// Check domain verification status
router.get('/domains/check', async (req, res) => {
  try {
    const { domain, networkId } = req.query;

    // Get verification record
    const result = await db.query(
      'SELECT * FROM domain_verifications WHERE domain = $1',
      [domain]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Domain verification not found' });
    }

    const verification = result.rows[0];

    // In a real implementation, you would:
    // 1. Perform DNS lookup for TXT/CNAME record
    // 2. Or check for file at well-known path
    // For now, we'll simulate verification

    // Simulate DNS check (in production, use a DNS library)
    const isVerified = false; // Would be actual DNS lookup result

    if (isVerified && verification.status !== 'verified') {
      await db.query(`
        UPDATE domain_verifications
        SET status = 'verified', verified_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE domain = $1
      `, [domain]);
      verification.status = 'verified';
      verification.verified_at = new Date().toISOString();

      // Update the network's white-label config with the verified domain
      if (networkId) {
        await db.query(`
          UPDATE franchise_networks
          SET white_label_config = jsonb_set(
            COALESCE(white_label_config, '{}'::jsonb),
            '{customDomain}',
            $1::jsonb
          ),
          updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `, [JSON.stringify(domain), networkId]);
      }
    } else {
      await db.query(`
        UPDATE domain_verifications
        SET updated_at = CURRENT_TIMESTAMP
        WHERE domain = $1
      `, [domain]);
    }

    res.json({
      domain: verification.domain,
      status: verification.status,
      verificationMethod: verification.verification_method,
      verificationToken: verification.verification_token,
      verifiedAt: verification.verified_at,
      lastCheckedAt: new Date().toISOString(),
      error: verification.error,
    });
  } catch (error) {
    console.error('Error checking domain verification:', error);
    res.status(500).json({ error: 'Failed to check domain verification' });
  }
});

// Remove domain
router.delete('/domains', async (req, res) => {
  try {
    const { domain, networkId } = req.query;

    // Remove verification record
    await db.query('DELETE FROM domain_verifications WHERE domain = $1', [domain]);

    // Remove from network config if applicable
    if (networkId) {
      await db.query(`
        UPDATE franchise_networks
        SET white_label_config = white_label_config - 'customDomain',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [networkId]);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error removing domain:', error);
    res.status(500).json({ error: 'Failed to remove domain' });
  }
});

// Upload logo/favicon (placeholder - would need file storage integration)
router.post('/upload', async (req, res) => {
  try {
    // In a real implementation, this would:
    // 1. Accept multipart form data
    // 2. Validate file type and size
    // 3. Upload to S3/CloudStorage
    // 4. Return the public URL

    // For now, return a placeholder
    res.json({
      url: '/placeholder-logo.png',
      message: 'File upload integration required',
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

export default router;
