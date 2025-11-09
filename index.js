require('dotenv').config()
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { GoogleGenAI } = require("@google/genai");

// .env configuration
const FSQ_BASE = "https://places-api.foursquare.com/places/search";
const FSQ_API_KEY = process.env.FSQ_API_KEY;
const FSQ_API_VERSION = process.env.FSQ_API_VERSION || "2025-06-17";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// setup Google Gemini SDK
const genAI = new GoogleGenAI(process.env.GEMINI_API_KEY);

let app = express();
app.use(express.json());
app.use(cors());

// add routes here
app.get('/live', function (req, res) {
    res.json({
        'message': 'Hello world'
    })
})

app.get("/api/places/search", async (req, res) => {
    try {
        const params = req.query;

        const response = await axios.get(FSQ_BASE, {
            params,
            headers: {
                Authorization: 'Bearer ' + FSQ_API_KEY,
                Accept: "application/json",
                "X-Places-Api-Version": FSQ_API_VERSION
            }
        });

        res.status(response.status).json(response.data);
    } catch (err) {
        console.error("Error:", err.message);

        if (err.response) {
            res
                .status(err.response.status)
                .json(err.response.data || { error: "Upstream error" });
        } else if (err.request) {
            res.status(502).json({
                error: "bad_gateway",
                message: "No response from Foursquare API.",
            });
        } else {
            res.status(500).json({
                error: "internal_error",
                message: "Unexpected server error.",
            });
        }
    }
});

app.post('/api/deepseek/chat', async (req, res) => {
    try {
        let { userMessage, systemMessage } = req.body;

        systemMessage = systemMessage || '';

        const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
            model: 'deepseek/deepseek-r1:free',
            response_format: {
                type: "json_object"
            },
            messages: [
                {
                    role: 'system',
                    content: `${systemMessage}. You are a helpful assistant that ONLY responds with a raw JSON object. Do not include any explanations, markdown, or additional text outside the JSON structure.`
                },
                {
                    role: 'user',
                    content: `${userMessage}. Respond with ONLY a raw JSON object, no additional text, explanations, markdown. Do not format the reply.`
                },
            ],
        }, {
            headers: {
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json'
            },
        });

        const aiResponse = response.data.choices[0].message.content;
        console.log(aiResponse)
        res.json({ reply: aiResponse });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while processing your request.' });
    }
});

app.get('/api/og-image', async (req, res) => {
    try {
        const { url } = req.query;

        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        const response = await axios.get(url, {
            timeout: 10000,
            maxRedirects: 5,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        const html = response.data;
        
        // Try multiple patterns for og:image
        const patterns = [
            /<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i,
            /<meta\s+content=["']([^"']+)["']\s+property=["']og:image["']/i,
            /<meta\s+name=["']og:image["']\s+content=["']([^"']+)["']/i,
            /<meta\s+property=["']og:image:secure_url["']\s+content=["']([^"']+)["']/i,
            /<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/i
        ];
        
        for (const pattern of patterns) {
            const match = html.match(pattern);
            if (match && match[1]) {
                return res.json({ ogImage: match[1] });
            }
        }
        
        res.json({ ogImage: null });
    } catch (error) {
        console.error(`Failed to fetch og:image from ${req.body.url}:`, error.message);
        res.status(500).json({ error: 'Failed to fetch Open Graph image', ogImage: null });
    }
});

app.post('/api/gemini/chat', async (req, res) => {
    try {

        let { userMessage, systemMessage, lat, lng } = req.body;
        systemMessage = systemMessage || '';


        // Combine system + user message context
        const prompt = `${systemMessage}. Respond ONLY with a raw JSON object. Do not include any code fences. Do not include any explanations, markdown, or text outside the JSON.  User says: "${userMessage}. Reply to me as a travel advisor near where I am. Always include latitude and longitude in the JSON object"`;

        // configure google map grounding
        const config = {
            tools: [{ googleMaps: {} }],          
        }

        // only set lat and lng if both are provided
        if (lat && lng) {
            config.toolConfig = {
                retrievalConfig: {
                    latLng:{
                        latitude:lat,
                        longitude:lng
                    }
                }
            }
        }

        const response = await genAI.models.generateContent({
            model: "gemini-2.5-flash-lite",
            contents: prompt,
            config
        });

        const aiResponse = response;
        
        // check for code fence in replies and remove them
        const aiResponseText = aiResponse.candidates[0].content.parts[0].text;
        const aiResponseTextWithoutCodeFence = aiResponseText.replace(/```\w*\n?/g, '');

        res.json({
            reply: JSON.parse(aiResponseTextWithoutCodeFence),
            groundingChunks: aiResponse.candidates[0].groundingMetadata.groundingChunks
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while processing your request.' });
    }
});

// IMPORTANT: no routes after this
app.listen(process.env.PORT || 3000, () => {
    console.log("Server started")
})