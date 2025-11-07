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

app.post('/chat', async (req, res) => {
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

app.post('/gemini_chat', async (req, res) => {
    try {

        let { userMessage, systemMessage } = req.body;
        systemMessage = systemMessage || '';


        // Combine system + user message context
        const prompt = `${systemMessage}. Respond ONLY with a raw JSON object. Do not include any code fences. Do not include any explanations, markdown, or text outside the JSON. User says: ${userMessage}`;

        const response = await genAI.models.generateContent({
            model: "gemini-2.5-flash-lite",
            contents: prompt,
            config: {
                tools: [{ googleMaps: {} }],
            }
        });

        const aiResponse = response;
        console.log(aiResponse);
        res.json({
            reply: aiResponse.candidates[0].content.parts[0].text,
            groundingChunks: aiResponse.candidates[0].groundingMetadata.groundingChunks
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while processing your request.' });
    }
});

app.listen(3000, () => console.log('Server running on port 3000'));




// IMPORTANT: no routes after this
app.listen(3000, () => {
    console.log("Server started")
})