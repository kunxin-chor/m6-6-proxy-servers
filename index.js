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
        const deepseekModels = [
            "deepseek/deepseek-r1-distill-llama-70b:free",
            "tngtech/deepseek-r1t2-chimera:free",
            "deepseek/deepseek-r1:free"
        ]

        const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
            model: deepseekModels[1],
            response_format: {
                type: "json_object"
            },
            messages: [
                {
                    role: 'system',
                    content: `${systemMessage}. You are a helpful assistant that ONLY responds with a raw JSON object. Do not include any code fences, explanations, markdown, or additional text outside the JSON structure.`
                },
                {
                    role: 'user',
                    content: `${userMessage}. Respond with ONLY a raw JSON object, no additional text, explanations, markdown, no code fences. Do not format the reply.`
                },
            ],
        }, {
            headers: {
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json'
            },
        });

        const aiResponse = JSON.parse(response.data.choices[0].message.content)
        console.log(response.data.choices[0].message.content)
        // res.json({ 
        //     text: aiResponse.text,
        //     locations: aiResponse.locations 
        // });
        res.json({
            content: aiResponse
        })
    } catch (error) {
        console.error(error);
        res.status(error.response.status).json({ error: error.response.data });
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
            content: JSON.parse(aiResponseTextWithoutCodeFence),
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