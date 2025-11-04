import { tool } from 'ai';
import { z } from 'zod';
import { evaluate } from 'mathjs';

// Web Search Tool (using SearXNG)
export const webSearchTool = tool({
  description: 'Search the web for current information. Use this when you need up-to-date information or facts that may not be in your training data.',
  parameters: z.object({
    query: z.string().describe('The search query'),
  }),
  execute: async ({ query }) => {
    try {
      const searxngUrl = process.env.SEARXNG_URL || 'http://localhost:8080';
      console.log('[Web Search] Searching for:', query);

      const response = await fetch(
        `${searxngUrl}/search?q=${encodeURIComponent(query)}&format=json&categories=general`,
        {
          headers: {
            'Accept': 'application/json',
          },
        }
      );

      if (!response.ok) {
        console.error('[Web Search] Error:', response.status, response.statusText);
        return {
          results: [],
          query,
          error: `Search failed: ${response.statusText}`,
          timestamp: new Date().toISOString(),
        };
      }

      const data = await response.json();

      // SearXNG returns results in data.results
      const results = (data.results || []).slice(0, 5).map((result: any) => ({
        title: result.title,
        url: result.url,
        snippet: result.content || result.snippet || '',
        engine: result.engine,
      }));

      console.log('[Web Search] Found', results.length, 'results');

      return {
        results,
        query,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[Web Search] Exception:', error);
      return {
        results: [],
        query,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  },
});

// RAG Tool with Hybrid Search (Semantic + Keyword/BM25)
export const ragTool = tool({
  description: 'Search through your knowledge base documents using hybrid RAG (combines semantic + keyword search). Use this to find relevant information from uploaded documents. IMPORTANT: The parameter name is "query" (not "context" or "question").',
  parameters: z.object({
    query: z.string().describe('The search query - the question or topic to search for in the knowledge base. This is a REQUIRED parameter.'),
    topK: z.number().optional().default(5).describe('Number of relevant chunks to retrieve'),
    alpha: z.number().optional().default(0.6).describe('Hybrid search weight: 0-1 (higher = more semantic, lower = more keyword-based). Default 0.6 = 60% semantic, 40% keyword'),
  }),
  execute: async (params: any) => {
    try {
      // Support both 'query' and 'context' parameter names for backwards compatibility
      // Some models might use 'context' instead of 'query'
      const query = params.query || params.context || '';
      const topK = params.topK || 5;
      const alpha = params.alpha || 0.6;

      console.log('[RAG] Tool called with raw params:', params);
      console.log('[RAG] Extracted parameters:', { query, topK, alpha });

      // Validate query parameter
      if (!query || typeof query !== 'string') {
        console.error('[RAG] Invalid query parameter:', query);
        return {
          error: 'Query parameter is required and must be a string. Please provide either "query" or "context" parameter.',
          results: [],
          query: query || '',
          topK,
        };
      }

      const { auth } = await import('@/app/(auth)/auth');
      const session = await auth();

      if (!session?.user?.id) {
        console.error('[RAG] Unauthorized: No user session');
        return {
          error: 'You must be logged in to search your knowledge base',
          results: [],
          query,
          topK,
        };
      }

      const { findRelevantContent } = await import('@/db/queries');
      const results = await findRelevantContent({
        userQuery: query,
        userId: session.user.id,
        topK,
        alpha, // Pass hybrid search weight
      });

      console.log('[RAG] Hybrid search found', results.length, 'chunks for:', query);

      if (results.length === 0) {
        return {
          results: [],
          query,
          topK,
          alpha,
          message: 'No documents found in your knowledge base. Upload some documents first!',
        };
      }

      return {
        results: results.map(r => ({
          content: r.content,
          hybridScore: r.similarity, // Overall hybrid score
          semanticScore: r.semanticScore, // Pure vector similarity
          keywordScore: r.keywordScore, // BM25-like keyword score
          source: r.resourceName,
          metadata: r.resourceMetadata,
        })),
        query,
        topK,
        alpha,
        searchType: 'hybrid',
      };
    } catch (error) {
      console.error('[RAG] Error:', error);
      return {
        error: error instanceof Error ? error.message : 'Failed to search knowledge base',
        results: [],
        query,
        topK,
      };
    }
  },
});

// Calculator Tool
export const calculatorTool = tool({
  description: 'Perform mathematical calculations. Use this for precise arithmetic operations.',
  parameters: z.object({
    expression: z.string().describe('The mathematical expression to evaluate (e.g., "2 + 2", "sqrt(16)", "sin(pi/2)")'),
  }),
  execute: async ({ expression }) => {
    try {
      // Use mathjs for safe evaluation (no code injection risk)
      const result = evaluate(expression);
      return { result, expression };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Invalid expression',
        expression
      };
    }
  },
});

// Weather Tool
// Accept both lat/lon and latitude/longitude since models often abbreviate
export const getWeatherTool = tool({
  description: 'Get current weather and forecast for a location. Shows a nice weather widget with temperature, hourly forecast, and sunrise/sunset times. Use this when users ask about weather.',
  parameters: z.object({
    latitude: z.number().optional().describe('Latitude of the location (e.g., 59.91 for Oslo)'),
    longitude: z.number().optional().describe('Longitude of the location (e.g., 10.75 for Oslo)'),
    lat: z.number().optional().describe('Latitude (abbreviated form)'),
    lon: z.number().optional().describe('Longitude (abbreviated form)'),
  }).refine(
    (data) => (data.latitude !== undefined && data.longitude !== undefined) || (data.lat !== undefined && data.lon !== undefined),
    { message: "Must provide either latitude/longitude or lat/lon" }
  ),
  execute: async (params: any) => {
    // Handle both full names and abbreviations
    const latitude = params.latitude ?? params.lat;
    const longitude = params.longitude ?? params.lon;

    try {
      console.log('[Weather] Fetching weather for:', latitude, longitude);
      console.log('[Weather] Raw params:', params);

      if (latitude === undefined || longitude === undefined) {
        console.error('[Weather] Missing coordinates:', { latitude, longitude, params });
        return {
          error: 'Missing latitude or longitude coordinates',
          latitude,
          longitude,
        };
      }

      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m&hourly=temperature_2m&daily=sunrise,sunset&timezone=auto&forecast_days=5`
      );

      if (!response.ok) {
        console.error('[Weather] Error:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('[Weather] Error response:', errorText);
        return {
          error: `Weather API failed: ${response.statusText}`,
          latitude,
          longitude,
        };
      }

      const data = await response.json();
      console.log('[Weather] Successfully fetched weather data');

      return {
        ...data,
        latitude,
        longitude,
      };
    } catch (error) {
      console.error('[Weather] Exception:', error);
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
        latitude,
        longitude,
      };
    }
  },
});

// Export all tools as a collection
export const allTools = {
  webSearch: webSearchTool,
  rag: ragTool,
  calculator: calculatorTool,
  getWeather: getWeatherTool,
};

// Type for tool configurations
export type ToolConfig = {
  webSearch?: boolean;
  rag?: boolean;
  calculator?: boolean;
  weather?: boolean;
};

// Helper to get enabled tools based on config
export function getEnabledTools(config: ToolConfig) {
  const tools: Record<string, typeof webSearchTool | typeof ragTool | typeof calculatorTool | typeof getWeatherTool> = {};

  if (config.webSearch) tools.webSearch = webSearchTool;
  if (config.rag) tools.rag = ragTool;
  if (config.calculator) tools.calculator = calculatorTool;
  if (config.weather) tools.getWeather = getWeatherTool;

  return tools;
}
