# Proxy Servers API

A Node.js/Express proxy server that provides unified access to multiple third-party APIs including Foursquare Places, DeepSeek AI, and Google Gemini.

## Features

- **Foursquare Places Search**: Proxy endpoint for searching places using Foursquare API
- **DeepSeek Chat**: AI chat interface using DeepSeek R1 model via OpenRouter
- **Google Gemini Chat**: AI chat interface with Google Gemini 2.5 Flash Lite with Google Maps integration
- CORS enabled for cross-origin requests
- Environment-based configuration

## Prerequisites

- Node.js (v14 or higher recommended)
- npm or yarn
- API keys for:
  - Foursquare Places API
  - OpenRouter (for DeepSeek)
  - Google Gemini API

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd m6-6-proxy-servers
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with the following variables:
```env
FSQ_API_KEY=your_foursquare_api_key
FSQ_API_VERSION=2025-06-17
OPENROUTER_API_KEY=your_openrouter_api_key
GEMINI_API_KEY=your_gemini_api_key
PORT=3000
```

**Note:** `PORT` is optional and defaults to 3000 if not specified.

## Usage

Start the server:
```bash
node index.js
```

The server will run on `http://localhost:3000`

## API Endpoints

### Health Check
```
GET /live
```
Returns a simple health check message.

**Response:**
```json
{
  "message": "Hello world"
}
```

### Foursquare Places Search
```
GET /api/places/search
```
Proxy endpoint for Foursquare Places API search.

**Query Parameters:**
- Pass any valid Foursquare Places API query parameters
- Example: `?query=coffee&near=New York`

**Response:**
Returns the Foursquare API response data.

### DeepSeek Chat
```
POST /api/deepseek/chat
```
Chat with DeepSeek R1 AI model. Returns JSON-formatted responses.

**Request Body:**
```json
{
  "userMessage": "Your question here",
  "systemMessage": "Optional system context"
}
```

**Response:**
```json
{
  "reply": "AI response as JSON string"
}
```

### Google Gemini Chat
```
POST /api/gemini/chat
```
Chat with Google Gemini 2.5 Flash Lite AI with Google Maps grounding support. Optionally provide latitude and longitude for location-based grounding.

**Request Body:**
```json
{
  "userMessage": "Your question here",
  "systemMessage": "Optional system context",
  "lat": 1.3521,
  "lng": 103.8198
}
```

**Note:** `lat` and `lng` are optional. When both are provided, Google Maps grounding will use the specified location for context.

**Response:**
```json
{
  "reply": "AI response text",
  "groundingChunks": [
    {
      "web": {
        "uri": "https://maps.google.com/...",
        "title": "Place name"
      }
    }
  ]
}
```

**Example:**
```json
{
  "userMessage": "Suggest beautiful beaches in Thailand.",
  "systemMessage": "You are a professional travel advisor. Use Google Search to provide accurate, up-to-date travel information. Always respond with a JSON object containing: { \"text\": \"Helpful travel advice.\", \"locations\": [ { \"lat\": <number>, \"lng\": <number>, \"address\": \"<string>\", \"description\": \"<string>\" } ] }. Only answer travel-related questions."
}

```

## Dependencies

- **express**: Web framework
- **axios**: HTTP client for API requests
- **cors**: Enable CORS
- **dotenv**: Environment variable management
- **@google/genai**: Google Generative AI SDK

## Error Handling

The API includes comprehensive error handling:
- **502 Bad Gateway**: When upstream API is unreachable
- **500 Internal Server Error**: For unexpected server errors
- Upstream errors are passed through with their original status codes

## Security Notes

- Never commit your `.env` file to version control
- Keep your API keys secure
- Consider implementing rate limiting for production use
- Add authentication/authorization as needed for your use case

## License

ISC
