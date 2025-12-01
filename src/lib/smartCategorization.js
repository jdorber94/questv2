// Smart categorization disabled - WebLLM removed in favor of Groq API for AI Advisor
// This feature can be re-implemented using Groq API if needed

export const initializeSmartCategorization = async (onProgress) => {
    // Disabled - return null
    return null;
};

export const categorizeWithLLM = async (description, categories) => {
    // Disabled - return null (will fall back to keyword matching)
    return null;
};

export const isLLMInitialized = () => false;

export const resetLLM = () => {
    // No-op
};
