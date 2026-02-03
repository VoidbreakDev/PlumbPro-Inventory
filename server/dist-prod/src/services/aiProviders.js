/**
 * Cloud AI Provider Service
 * Supports tier-based access to: Google Gemini, OpenAI, Anthropic Claude
 * Local LLM (Ollama) has been removed to simplify user experience
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

// Subscription tiers and their AI model access
const TIER_MODELS = {
  solo: {
    name: 'Solo',
    models: {
      gemini: ['gemini-2.0-flash-exp'],
      openai: [], // Solo tier doesn't get OpenAI
      anthropic: [] // Solo tier doesn't get Anthropic
    },
    dailyQuota: 100,
    features: ['forecast', 'search', 'template', 'anomaly', 'purchase_orders', 'insights']
  },
  team: {
    name: 'Team',
    models: {
      gemini: ['gemini-2.0-flash-exp', 'gemini-1.5-pro'],
      openai: ['gpt-4o-mini'],
      anthropic: ['claude-3-haiku-20240307']
    },
    dailyQuota: 500,
    features: ['forecast', 'search', 'template', 'anomaly', 'purchase_orders', 'insights', 'job_completion']
  },
  business: {
    name: 'Business',
    models: {
      gemini: ['gemini-2.0-flash-exp', 'gemini-1.5-pro', 'gemini-1.5-flash-8b'],
      openai: ['gpt-4o-mini', 'gpt-4o'],
      anthropic: ['claude-3-haiku-20240307', 'claude-3-sonnet-20240229']
    },
    dailyQuota: null, // Unlimited
    features: ['forecast', 'search', 'template', 'anomaly', 'purchase_orders', 'insights', 'job_completion', 'custom']
  }
};

// Model quality/priority ranking (higher = better)
const MODEL_PRIORITY = {
  // Gemini models
  'gemini-2.0-flash-exp': 3,
  'gemini-1.5-pro': 4,
  'gemini-1.5-flash-8b': 2,
  // OpenAI models
  'gpt-4o': 5,
  'gpt-4o-mini': 3,
  // Anthropic models
  'claude-3-sonnet-20240229': 4,
  'claude-3-haiku-20240307': 2
};

// Initialize providers
const providers = {
  gemini: null,
  openai: null,
  anthropic: null
};

// Initialize Gemini
if (process.env.GEMINI_API_KEY) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  providers.gemini = genAI;
}

/**
 * Generate AI completion using user's available models based on tier
 */
export const generateCompletion = async (userId, tier = 'solo', prompt, options = {}) => {
  const { preferredProvider, preferredModel } = options;
  
  // Get available models for user's tier
  const availableModels = getAvailableModelsForTier(tier);
  
  if (availableModels.length === 0) {
    throw new Error('No AI models available for your subscription tier');
  }

  // Select best model based on preference or auto-select
  let selectedModel;
  if (preferredProvider && preferredModel) {
    selectedModel = availableModels.find(m => 
      m.provider === preferredProvider && m.model === preferredModel
    );
  }
  
  // Auto-select if no preference or preference not available
  if (!selectedModel) {
    selectedModel = selectBestModel(availableModels, options.task);
  }

  console.log(`[AI] User ${userId} (${tier}): Using ${selectedModel.provider}/${selectedModel.model}`);

  try {
    const result = await generateWithModel(selectedModel, prompt, options);
    
    // Log usage for analytics
    await logAIUsage(userId, tier, selectedModel, prompt, result);
    
    return result;
  } catch (error) {
    console.error(`[AI] ${selectedModel.provider} failed:`, error.message);
    
    // Try fallback model
    const fallbackModel = getFallbackModel(availableModels, selectedModel);
    if (fallbackModel) {
      console.log(`[AI] Falling back to ${fallbackModel.provider}/${fallbackModel.model}`);
      return await generateWithModel(fallbackModel, prompt, options);
    }
    
    throw error;
  }
};

/**
 * Get available models for a subscription tier
 */
function getAvailableModelsForTier(tier) {
  const tierConfig = TIER_MODELS[tier] || TIER_MODELS.solo;
  const available = [];

  // Check each provider's models
  for (const [provider, models] of Object.entries(tierConfig.models)) {
    if (!isProviderConfigured(provider)) continue;
    
    for (const model of models) {
      available.push({ provider, model });
    }
  }

  // Sort by priority (best first)
  return available.sort((a, b) => 
    (MODEL_PRIORITY[b.model] || 0) - (MODEL_PRIORITY[a.model] || 0)
  );
}

/**
 * Select best model for a specific task
 */
function selectBestModel(availableModels, task) {
  // Task-specific model preferences
  const taskPreferences = {
    forecast: ['gemini-1.5-pro', 'gpt-4o', 'claude-3-sonnet-20240229'],
    search: ['gemini-2.0-flash-exp', 'gpt-4o-mini'],
    template: ['gemini-2.0-flash-exp', 'gpt-4o-mini'],
    anomaly: ['gemini-1.5-pro', 'gpt-4o'],
    insights: ['gemini-1.5-pro', 'gpt-4o', 'claude-3-sonnet-20240229']
  };

  if (task && taskPreferences[task]) {
    for (const preferredModel of taskPreferences[task]) {
      const match = availableModels.find(m => m.model === preferredModel);
      if (match) return match;
    }
  }

  // Return highest priority available model
  return availableModels[0];
}

/**
 * Get fallback model (different from failed one)
 */
function getFallbackModel(availableModels, failedModel) {
  return availableModels.find(m => 
    m.provider !== failedModel.provider || m.model !== failedModel.model
  );
}

/**
 * Check if provider is configured
 */
function isProviderConfigured(provider) {
  switch (provider) {
    case 'gemini':
      return !!process.env.GEMINI_API_KEY;
    case 'openai':
      return !!process.env.OPENAI_API_KEY;
    case 'anthropic':
      return !!process.env.ANTHROPIC_API_KEY;
    default:
      return false;
  }
}

/**
 * Generate completion with specific model
 */
async function generateWithModel({ provider, model }, prompt, options = {}) {
  switch (provider) {
    case 'gemini':
      return await generateGemini(model, prompt, options);
    case 'openai':
      return await generateOpenAI(model, prompt, options);
    case 'anthropic':
      return await generateAnthropic(model, prompt, options);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

/**
 * Google Gemini Provider
 */
async function generateGemini(model, prompt, options = {}) {
  if (!providers.gemini) {
    throw new Error('Gemini API key not configured');
  }

  const genModel = providers.gemini.getGenerativeModel({ model });
  const result = await genModel.generateContent(prompt);
  const responseText = result.response.text();

  return parseResponse(responseText, options.format);
}

/**
 * OpenAI Provider
 */
async function generateOpenAI(model, prompt, options = {}) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 2048,
      ...(options.format === 'json' && { response_format: { type: 'json_object' } })
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`OpenAI request failed: ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const responseText = data.choices[0].message.content;

  return parseResponse(responseText, options.format);
}

/**
 * Anthropic Claude Provider
 */
async function generateAnthropic(model, prompt, options = {}) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('Anthropic API key not configured');
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: options.maxTokens || 2048,
      temperature: options.temperature || 0.7
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Anthropic request failed: ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const responseText = data.content[0].text;

  return parseResponse(responseText, options.format);
}

/**
 * Parse and extract response based on format
 */
function parseResponse(text, format = 'json') {
  if (format === 'text') {
    return text;
  }

  // Extract JSON from markdown code blocks if present
  let jsonText = text;
  if (text.includes('```json')) {
    jsonText = text.split('```json')[1].split('```')[0].trim();
  } else if (text.includes('```')) {
    jsonText = text.split('```')[1].split('```')[0].trim();
  }

  try {
    return JSON.parse(jsonText);
  } catch (error) {
    console.error('[AI] Failed to parse JSON response:', error);
    console.error('[AI] Raw response:', text);
    throw new Error('Failed to parse AI response as JSON');
  }
}

/**
 * Log AI usage for analytics and quota tracking
 */
async function logAIUsage(userId, tier, model, prompt, result) {
  // This would typically save to database
  // For now, just log to console
  console.log(`[AI Usage] User: ${userId}, Tier: ${tier}, Model: ${model.provider}/${model.model}`);
}

/**
 * Get AI configuration for a user based on their tier
 */
export const getUserAIConfig = (tier = 'solo') => {
  const tierConfig = TIER_MODELS[tier] || TIER_MODELS.solo;
  const availableModels = getAvailableModelsForTier(tier);

  return {
    tier: tierConfig.name,
    dailyQuota: tierConfig.dailyQuota,
    availableFeatures: tierConfig.features,
    availableModels: availableModels.map(m => ({
      provider: m.provider,
      model: m.model,
      priority: MODEL_PRIORITY[m.model] || 0
    })),
    recommendedModel: availableModels[0] || null
  };
};

/**
 * Check if user has quota remaining
 */
export const checkUserQuota = async (userId, tier) => {
  const tierConfig = TIER_MODELS[tier] || TIER_MODELS.solo;
  
  if (!tierConfig.dailyQuota) {
    return { hasQuota: true, remaining: null, total: null }; // Unlimited
  }

  // This would query database for today's usage
  // Placeholder implementation
  const usageToday = 0; // Would be fetched from DB
  const remaining = tierConfig.dailyQuota - usageToday;

  return {
    hasQuota: remaining > 0,
    remaining,
    total: tierConfig.dailyQuota,
    resetTime: '24:00 UTC'
  };
};

/**
 * Health check for all configured providers
 */
export const checkProvidersHealth = async () => {
  const health = {};

  // Check Gemini
  try {
    if (providers.gemini) {
      const model = providers.gemini.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
      await model.generateContent('test');
      health.gemini = { 
        status: 'ok', 
        configured: true,
        availableModels: ['gemini-2.0-flash-exp', 'gemini-1.5-pro', 'gemini-1.5-flash-8b']
      };
    } else {
      health.gemini = { status: 'not_configured', configured: false };
    }
  } catch (error) {
    health.gemini = { status: 'error', configured: true, error: error.message };
  }

  // Check OpenAI
  if (process.env.OPENAI_API_KEY) {
    health.openai = { 
      status: 'configured', 
      configured: true,
      availableModels: ['gpt-4o-mini', 'gpt-4o']
    };
  } else {
    health.openai = { status: 'not_configured', configured: false };
  }

  // Check Anthropic
  if (process.env.ANTHROPIC_API_KEY) {
    health.anthropic = { 
      status: 'configured', 
      configured: true,
      availableModels: ['claude-3-haiku-20240307', 'claude-3-sonnet-20240229']
    };
  } else {
    health.anthropic = { status: 'not_configured', configured: false };
  }

  return health;
};

/**
 * Get cost estimate for a model (for Business tier cost tracking)
 */
export const getCostEstimate = (provider, model, inputTokens = 1000, outputTokens = 500) => {
  const pricing = {
    gemini: { 
      'gemini-2.0-flash-exp': { input: 0, output: 0, name: 'Free (60 req/min)' },
      'gemini-1.5-pro': { input: 0, output: 0, name: 'Free (60 req/min)' },
      'gemini-1.5-flash-8b': { input: 0, output: 0, name: 'Free (60 req/min)' }
    },
    openai: {
      'gpt-4o-mini': { input: 0.15 / 1000000, output: 0.6 / 1000000, name: 'GPT-4o Mini' },
      'gpt-4o': { input: 2.5 / 1000000, output: 10 / 1000000, name: 'GPT-4o' }
    },
    anthropic: {
      'claude-3-haiku-20240307': { input: 0.25 / 1000000, output: 1.25 / 1000000, name: 'Claude Haiku' },
      'claude-3-sonnet-20240229': { input: 3 / 1000000, output: 15 / 1000000, name: 'Claude Sonnet' }
    }
  };

  const rates = pricing[provider]?.[model];
  if (!rates) return null;

  const cost = (inputTokens * rates.input) + (outputTokens * rates.output);

  return {
    provider,
    model,
    name: rates.name,
    inputTokens,
    outputTokens,
    costUSD: cost,
    costGBP: cost * 0.79,
    isFree: cost === 0
  };
};

/**
 * Get the best provider for a specific feature
 * Returns provider name based on feature type and available providers
 */
export const getProviderForFeature = (feature) => {
  // Feature-specific provider preferences
  const featureProviders = {
    forecast: 'gemini',
    search: 'gemini',
    template: 'gemini',
    anomaly: 'gemini',
    insights: 'gemini',
    purchase_orders: 'gemini',
    job_completion: 'gemini'
  };

  const preferredProvider = featureProviders[feature] || 'gemini';
  
  // Check if preferred provider is configured, fallback to available
  if (isProviderConfigured(preferredProvider)) {
    return preferredProvider;
  }
  
  // Fallback chain
  if (isProviderConfigured('gemini')) return 'gemini';
  if (isProviderConfigured('openai')) return 'openai';
  if (isProviderConfigured('anthropic')) return 'anthropic';
  
  return null;
};

export default {
  generateCompletion,
  getProviderForFeature,
  getUserAIConfig,
  checkUserQuota,
  checkProvidersHealth,
  getCostEstimate,
  TIER_MODELS
};
