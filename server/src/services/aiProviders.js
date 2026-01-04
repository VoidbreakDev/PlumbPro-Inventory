/**
 * Multi-Provider AI Service
 * Supports: Google Gemini, Ollama (local), OpenAI, Anthropic Claude
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize providers based on environment variables
const providers = {
  gemini: null,
  ollama: null,
  openai: null,
  anthropic: null
};

// Initialize Gemini
if (process.env.GEMINI_API_KEY) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  providers.gemini = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
}

/**
 * Generate AI completion using specified provider
 */
export const generateCompletion = async (prompt, provider = 'auto', options = {}) => {
  // Auto-select provider based on availability and configuration
  if (provider === 'auto') {
    provider = selectProvider();
  }

  console.log(`[AI] Using provider: ${provider}`);

  try {
    switch (provider) {
      case 'gemini':
        return await generateGemini(prompt, options);

      case 'ollama':
        return await generateOllama(prompt, options);

      case 'openai':
        return await generateOpenAI(prompt, options);

      case 'anthropic':
        return await generateAnthropic(prompt, options);

      default:
        throw new Error(`Unknown AI provider: ${provider}`);
    }
  } catch (error) {
    console.error(`[AI] Provider ${provider} failed:`, error.message);

    // Fallback to alternative provider if primary fails
    if (options.fallback !== false) {
      const fallbackProvider = getFallbackProvider(provider);
      if (fallbackProvider) {
        console.log(`[AI] Falling back to: ${fallbackProvider}`);
        return await generateCompletion(prompt, fallbackProvider, { ...options, fallback: false });
      }
    }

    throw error;
  }
};

/**
 * Google Gemini Provider
 */
async function generateGemini(prompt, options = {}) {
  if (!providers.gemini) {
    throw new Error('Gemini API key not configured');
  }

  const result = await providers.gemini.generateContent(prompt);
  const responseText = result.response.text();

  return parseResponse(responseText, options.format);
}

/**
 * Ollama Provider (Local)
 */
async function generateOllama(prompt, options = {}) {
  const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
  const ollamaModel = process.env.OLLAMA_MODEL || 'llama3';

  const response = await fetch(`${ollamaUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: ollamaModel,
      prompt: prompt,
      stream: false,
      options: {
        temperature: options.temperature || 0.7,
        num_predict: options.maxTokens || 2048
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Ollama request failed: ${response.statusText}`);
  }

  const data = await response.json();
  return parseResponse(data.response, options.format);
}

/**
 * OpenAI Provider
 */
async function generateOpenAI(prompt, options = {}) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }

  const openaiModel = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: openaiModel,
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
async function generateAnthropic(prompt, options = {}) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('Anthropic API key not configured');
  }

  const anthropicModel = process.env.ANTHROPIC_MODEL || 'claude-3-haiku-20240307';

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: anthropicModel,
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
 * Select provider based on configuration and availability
 */
function selectProvider() {
  // Check environment variable for provider preference
  const preferredProvider = process.env.AI_PROVIDER;

  if (preferredProvider && isProviderAvailable(preferredProvider)) {
    return preferredProvider;
  }

  // Fallback order: ollama (free) -> gemini (free tier) -> openai -> anthropic
  if (isProviderAvailable('ollama')) return 'ollama';
  if (isProviderAvailable('gemini')) return 'gemini';
  if (isProviderAvailable('openai')) return 'openai';
  if (isProviderAvailable('anthropic')) return 'anthropic';

  throw new Error('No AI provider configured. Please set up at least one provider.');
}

/**
 * Get fallback provider if primary fails
 */
function getFallbackProvider(failedProvider) {
  const fallbackOrder = {
    'ollama': 'gemini',
    'gemini': 'ollama',
    'openai': 'gemini',
    'anthropic': 'gemini'
  };

  const fallback = fallbackOrder[failedProvider];

  if (fallback && isProviderAvailable(fallback)) {
    return fallback;
  }

  // Try any available provider
  const providers = ['gemini', 'ollama', 'openai', 'anthropic'];
  for (const provider of providers) {
    if (provider !== failedProvider && isProviderAvailable(provider)) {
      return provider;
    }
  }

  return null;
}

/**
 * Check if provider is available
 */
function isProviderAvailable(provider) {
  switch (provider) {
    case 'gemini':
      return !!process.env.GEMINI_API_KEY;

    case 'ollama':
      // Ollama is available if URL is set or default localhost works
      return true; // We'll try to connect and fail gracefully

    case 'openai':
      return !!process.env.OPENAI_API_KEY;

    case 'anthropic':
      return !!process.env.ANTHROPIC_API_KEY;

    default:
      return false;
  }
}

/**
 * Get provider for specific feature
 * Allows fine-grained control over which provider handles what
 */
export const getProviderForFeature = (feature) => {
  const featureProviders = {
    // Forecasting - use cloud AI for accuracy (Gemini or OpenAI)
    'forecast': process.env.AI_PROVIDER_FORECAST || 'gemini',

    // Natural language search - can use local Ollama (fast, free)
    'search': process.env.AI_PROVIDER_SEARCH || 'ollama',

    // Template generation - can use local Ollama
    'template': process.env.AI_PROVIDER_TEMPLATE || 'ollama',

    // Anomaly detection - use cloud for accuracy
    'anomaly': process.env.AI_PROVIDER_ANOMALY || 'gemini',

    // Purchase orders - use cloud for accuracy
    'purchase_orders': process.env.AI_PROVIDER_PURCHASE_ORDERS || 'gemini',

    // Smart insights - use cloud for best analysis
    'insights': process.env.AI_PROVIDER_INSIGHTS || 'gemini',

    // Job completion check - can use local
    'job_completion': process.env.AI_PROVIDER_JOB_COMPLETION || 'ollama',

    // Default
    'default': process.env.AI_PROVIDER || 'auto'
  };

  return featureProviders[feature] || featureProviders.default;
};

/**
 * Health check for all providers
 */
export const checkProvidersHealth = async () => {
  const health = {};

  // Check Gemini
  try {
    if (providers.gemini) {
      await providers.gemini.generateContent('test');
      health.gemini = { status: 'ok', configured: true };
    } else {
      health.gemini = { status: 'not_configured', configured: false };
    }
  } catch (error) {
    health.gemini = { status: 'error', configured: true, error: error.message };
  }

  // Check Ollama
  try {
    const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
    const response = await fetch(`${ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(2000) });
    if (response.ok) {
      const data = await response.json();
      health.ollama = {
        status: 'ok',
        configured: true,
        models: data.models?.map(m => m.name) || []
      };
    } else {
      health.ollama = { status: 'error', configured: false };
    }
  } catch (error) {
    health.ollama = { status: 'offline', configured: false, error: error.message };
  }

  // Check OpenAI
  if (process.env.OPENAI_API_KEY) {
    health.openai = { status: 'configured', configured: true };
  } else {
    health.openai = { status: 'not_configured', configured: false };
  }

  // Check Anthropic
  if (process.env.ANTHROPIC_API_KEY) {
    health.anthropic = { status: 'configured', configured: true };
  } else {
    health.anthropic = { status: 'not_configured', configured: false };
  }

  return health;
};

/**
 * Get cost estimate for provider
 */
export const getCostEstimate = (provider, inputTokens = 1000, outputTokens = 500) => {
  const pricing = {
    gemini: { input: 0, output: 0, name: 'Free (60 req/min)' },
    ollama: { input: 0, output: 0, name: 'Free (Local)' },
    openai: { input: 0.15 / 1000000, output: 0.6 / 1000000, name: 'GPT-4o-mini' }, // per token
    anthropic: { input: 0.25 / 1000000, output: 1.25 / 1000000, name: 'Claude Haiku' }
  };

  const rates = pricing[provider];
  if (!rates) return null;

  const cost = (inputTokens * rates.input) + (outputTokens * rates.output);

  return {
    provider,
    name: rates.name,
    inputTokens,
    outputTokens,
    costUSD: cost,
    costGBP: cost * 0.79, // Approximate GBP conversion
    isFree: cost === 0
  };
};

export default {
  generateCompletion,
  getProviderForFeature,
  checkProvidersHealth,
  getCostEstimate
};
