// White-Label Configuration API Client
import api from './api';

// Types
export interface WhiteLabelConfig {
  // Branding
  enabled: boolean;
  companyName: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;

  // Domain & URLs
  customDomain: string | null;
  customSubdomain: string | null;

  // Email branding
  customEmailDomain: string | null;
  emailFromName: string | null;
  emailReplyTo: string | null;
  emailLogoUrl: string | null;
  emailFooterText: string | null;

  // Support & Contact
  customSupportEmail: string | null;
  customSupportPhone: string | null;
  customSupportUrl: string | null;

  // Legal
  customTermsUrl: string | null;
  customPrivacyUrl: string | null;
  customCookiePolicyUrl: string | null;

  // Display Options
  hideParentBranding: boolean;
  hidePoweredBy: boolean;
  customFooterHtml: string | null;
  customCss: string | null;

  // Feature toggles (per white-label tenant)
  features: {
    showDocumentation: boolean;
    showApiAccess: boolean;
    showAnalytics: boolean;
    showIntegrations: boolean;
    allowCustomReports: boolean;
  };

  // Social links
  socialLinks: {
    facebook: string | null;
    twitter: string | null;
    linkedin: string | null;
    instagram: string | null;
    youtube: string | null;
  };

  // Metadata
  metaTitle: string | null;
  metaDescription: string | null;
  metaKeywords: string | null;
}

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  preview: string;
}

export interface DomainVerification {
  domain: string;
  status: 'pending' | 'verified' | 'failed';
  verificationMethod: 'dns_txt' | 'dns_cname' | 'file';
  verificationToken: string;
  verifiedAt: string | null;
  lastCheckedAt: string;
  error: string | null;
}

// Default configuration
const defaultConfig: WhiteLabelConfig = {
  enabled: false,
  companyName: 'PlumbPro',
  logoUrl: null,
  faviconUrl: null,
  primaryColor: '#2563eb',
  secondaryColor: '#1e40af',
  accentColor: '#3b82f6',
  customDomain: null,
  customSubdomain: null,
  customEmailDomain: null,
  emailFromName: null,
  emailReplyTo: null,
  emailLogoUrl: null,
  emailFooterText: null,
  customSupportEmail: null,
  customSupportPhone: null,
  customSupportUrl: null,
  customTermsUrl: null,
  customPrivacyUrl: null,
  customCookiePolicyUrl: null,
  hideParentBranding: false,
  hidePoweredBy: false,
  customFooterHtml: null,
  customCss: null,
  features: {
    showDocumentation: true,
    showApiAccess: true,
    showAnalytics: true,
    showIntegrations: true,
    allowCustomReports: true,
  },
  socialLinks: {
    facebook: null,
    twitter: null,
    linkedin: null,
    instagram: null,
    youtube: null,
  },
  metaTitle: null,
  metaDescription: null,
  metaKeywords: null,
};

// Theme presets
const themePresets: ThemePreset[] = [
  {
    id: 'default-blue',
    name: 'Default Blue',
    description: 'Professional blue theme',
    primaryColor: '#2563eb',
    secondaryColor: '#1e40af',
    accentColor: '#3b82f6',
    preview: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)',
  },
  {
    id: 'emerald',
    name: 'Emerald',
    description: 'Fresh green theme',
    primaryColor: '#059669',
    secondaryColor: '#047857',
    accentColor: '#10b981',
    preview: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
  },
  {
    id: 'sunset',
    name: 'Sunset Orange',
    description: 'Warm orange theme',
    primaryColor: '#ea580c',
    secondaryColor: '#c2410c',
    accentColor: '#f97316',
    preview: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)',
  },
  {
    id: 'purple',
    name: 'Royal Purple',
    description: 'Elegant purple theme',
    primaryColor: '#7c3aed',
    secondaryColor: '#6d28d9',
    accentColor: '#8b5cf6',
    preview: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
  },
  {
    id: 'slate',
    name: 'Slate Gray',
    description: 'Modern neutral theme',
    primaryColor: '#475569',
    secondaryColor: '#334155',
    accentColor: '#64748b',
    preview: 'linear-gradient(135deg, #475569 0%, #334155 100%)',
  },
  {
    id: 'rose',
    name: 'Rose',
    description: 'Soft pink theme',
    primaryColor: '#e11d48',
    secondaryColor: '#be123c',
    accentColor: '#f43f5e',
    preview: 'linear-gradient(135deg, #e11d48 0%, #be123c 100%)',
  },
];

// API
export const whiteLabelAPI = {
  // Get current white-label configuration
  getConfig: async (networkId?: string): Promise<WhiteLabelConfig> => {
    try {
      const params = networkId ? { networkId } : {};
      const { data } = await api.get('/white-label/config', { params });
      return { ...defaultConfig, ...data };
    } catch {
      return defaultConfig;
    }
  },

  // Update white-label configuration
  updateConfig: async (config: Partial<WhiteLabelConfig>, networkId?: string): Promise<WhiteLabelConfig> => {
    const params = networkId ? { networkId } : {};
    const { data } = await api.put('/white-label/config', config, { params });
    return { ...defaultConfig, ...data };
  },

  // Get theme presets
  getThemePresets: (): ThemePreset[] => {
    return themePresets;
  },

  // Apply theme preset
  applyThemePreset: async (presetId: string, networkId?: string): Promise<WhiteLabelConfig> => {
    const preset = themePresets.find((p) => p.id === presetId);
    if (!preset) {
      throw new Error('Theme preset not found');
    }

    return whiteLabelAPI.updateConfig({
      primaryColor: preset.primaryColor,
      secondaryColor: preset.secondaryColor,
      accentColor: preset.accentColor,
    }, networkId);
  },

  // Upload logo
  uploadLogo: async (file: File, type: 'logo' | 'favicon' | 'emailLogo', networkId?: string): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    if (networkId) {
      formData.append('networkId', networkId);
    }

    const { data } = await api.post('/white-label/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    return data.url;
  },

  // Domain verification
  initiateDomainVerification: async (domain: string, method: 'dns_txt' | 'dns_cname' | 'file', networkId?: string): Promise<DomainVerification> => {
    const { data } = await api.post('/white-label/domains/verify', {
      domain,
      method,
      networkId,
    });
    return data;
  },

  checkDomainVerification: async (domain: string, networkId?: string): Promise<DomainVerification> => {
    const params: any = { domain };
    if (networkId) params.networkId = networkId;
    const { data } = await api.get('/white-label/domains/check', { params });
    return data;
  },

  removeDomain: async (domain: string, networkId?: string): Promise<{ success: boolean }> => {
    const params: any = { domain };
    if (networkId) params.networkId = networkId;
    const { data } = await api.delete('/white-label/domains', { params });
    return data;
  },

  // Preview configuration (generates CSS variables)
  generateCssVariables: (config: Partial<WhiteLabelConfig>): string => {
    const fullConfig = { ...defaultConfig, ...config };

    return `
:root {
  --wl-primary: ${fullConfig.primaryColor};
  --wl-secondary: ${fullConfig.secondaryColor};
  --wl-accent: ${fullConfig.accentColor};
  --wl-primary-hover: ${adjustColor(fullConfig.primaryColor, -10)};
  --wl-secondary-hover: ${adjustColor(fullConfig.secondaryColor, -10)};
  --wl-accent-hover: ${adjustColor(fullConfig.accentColor, -10)};
  --wl-primary-light: ${adjustColor(fullConfig.primaryColor, 40)};
  --wl-secondary-light: ${adjustColor(fullConfig.secondaryColor, 40)};
  --wl-accent-light: ${adjustColor(fullConfig.accentColor, 40)};
}
${fullConfig.customCss || ''}
    `.trim();
  },

  // Get branding for current context
  getBranding: async (): Promise<{
    companyName: string;
    logoUrl: string | null;
    faviconUrl: string | null;
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    supportEmail: string | null;
    supportPhone: string | null;
    termsUrl: string | null;
    privacyUrl: string | null;
    hidePoweredBy: boolean;
  }> => {
    try {
      const { data } = await api.get('/white-label/branding');
      return data;
    } catch {
      return {
        companyName: 'PlumbPro',
        logoUrl: null,
        faviconUrl: null,
        primaryColor: defaultConfig.primaryColor,
        secondaryColor: defaultConfig.secondaryColor,
        accentColor: defaultConfig.accentColor,
        supportEmail: null,
        supportPhone: null,
        termsUrl: null,
        privacyUrl: null,
        hidePoweredBy: false,
      };
    }
  },

  // Validate custom CSS (basic validation)
  validateCustomCss: (css: string): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    // Check for potentially dangerous content
    const dangerousPatterns = [
      /javascript:/i,
      /expression\s*\(/i,
      /@import/i,
      /url\s*\(\s*["']?data:/i,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(css)) {
        errors.push('Custom CSS contains potentially unsafe content');
        break;
      }
    }

    // Basic syntax check (very simple)
    try {
      const braceCount = (css.match(/{/g) || []).length - (css.match(/}/g) || []).length;
      if (braceCount !== 0) {
        errors.push('Unbalanced braces in CSS');
      }
    } catch {
      errors.push('Invalid CSS syntax');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },

  // Reset to default configuration
  resetConfig: async (networkId?: string): Promise<WhiteLabelConfig> => {
    const params = networkId ? { networkId } : {};
    await api.delete('/white-label/config', { params });
    return defaultConfig;
  },
};

// Helper function to adjust color brightness
function adjustColor(hex: string, percent: number): string {
  // Remove # if present
  hex = hex.replace(/^#/, '');

  // Parse hex
  let r = parseInt(hex.substring(0, 2), 16);
  let g = parseInt(hex.substring(2, 4), 16);
  let b = parseInt(hex.substring(4, 6), 16);

  // Adjust
  r = Math.min(255, Math.max(0, r + (percent * 255 / 100)));
  g = Math.min(255, Math.max(0, g + (percent * 255 / 100)));
  b = Math.min(255, Math.max(0, b + (percent * 255 / 100)));

  // Convert back to hex
  return `#${Math.round(r).toString(16).padStart(2, '0')}${Math.round(g).toString(16).padStart(2, '0')}${Math.round(b).toString(16).padStart(2, '0')}`;
}

export default whiteLabelAPI;
