// server.js - Node.js backend with ElevenLabs integration
const express = require('express');
const WebSocket = require('ws');
const cors = require('cors');
const http = require('http');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json());

// WebSocket server for real-time communication
const wss = new WebSocket.Server({ server });

// ElevenLabs API configuration
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'your-voice-id';
// Store active conversations
const activeConversations = new Map();

class ElevenLabsConversation {
    constructor(conversationId) {
        this.conversationId = conversationId;
        this.wsConnection = null;
        this.isConnected = false;
        this.messageQueue = [];
    }

    async connect() {
        try {
            // Connect to ElevenLabs WebSocket
            this.wsConnection = new WebSocket('wss://api.elevenlabs.io/v1/convai/conversation', {
                headers: {
                    'Authorization': `Bearer ${ELEVENLABS_API_KEY}`
                }
            });

            return new Promise((resolve, reject) => {
                this.wsConnection.on('open', () => {
                    console.log('Connected to ElevenLabs');
                    this.isConnected = true;
                    
                    // Send initial configuration
                    this.wsConnection.send(JSON.stringify({
                        type: 'conversation_initiation_metadata',
                        conversation_config_override: {
                            agent: {
                                prompt: {
                                    prompt: "You are a helpful AI assistant. Be conversational and friendly."
                                },
                                first_message: "Hello! How can I help you today?",
                                language: "en"
                            }
                        }
                    }));
                    
                    resolve();
                });

                this.wsConnection.on('error', (error) => {
                    console.error('ElevenLabs WebSocket error:', error);
                    reject(error);
                });

                this.wsConnection.on('message', (data) => {
                    this.handleElevenLabsMessage(data);
                });

                this.wsConnection.on('close', () => {
                    console.log('ElevenLabs connection closed');
                    this.isConnected = false;
                });
            });
        } catch (error) {
            console.error('Failed to connect to ElevenLabs:', error);
            throw error;
        }
    }

    handleElevenLabsMessage(data) {
        try {
            const message = JSON.parse(data);
            
            // Forward message to client
            if (this.clientWs && this.clientWs.readyState === WebSocket.OPEN) {
                this.clientWs.send(JSON.stringify({
                    type: 'elevenlabs_message',
                    data: message
                }));
            }
        } catch (error) {
            console.error('Error handling ElevenLabs message:', error);
        }
    }

    sendMessage(message) {
        if (this.isConnected && this.wsConnection.readyState === WebSocket.OPEN) {
            this.wsConnection.send(JSON.stringify(message));
        } else {
            console.error('Not connected to ElevenLabs');
        }
    }

    setClientWebSocket(clientWs) {
        this.clientWs = clientWs;
    }

    disconnect() {
        if (this.wsConnection) {
            this.wsConnection.close();
        }
        this.isConnected = false;
    }
}

// WebSocket connection handler
wss.on('connection', async (ws) => {
    console.log('Client connected');
    
    let conversationId = null;
    let elevenLabsConversation = null;

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            console.log({data})
            switch (data.type) {
                case 'start_conversation':
                    conversationId = data.conversationId || generateConversationId();
                    
                    // Create new ElevenLabs conversation
                    elevenLabsConversation = new ElevenLabsConversation(conversationId);
                    elevenLabsConversation.setClientWebSocket(ws);
                    
                    await elevenLabsConversation.connect();
                    activeConversations.set(conversationId, elevenLabsConversation);
                    
                    ws.send(JSON.stringify({
                        type: 'conversation_started',
                        conversationId: conversationId
                    }));
                    break;

                case 'send_audio':
                    console.log({data, connedted:elevenLabsConversation.isConnected})
                    if (elevenLabsConversation && elevenLabsConversation.isConnected) {
                        elevenLabsConversation.sendMessage({
                            type: 'audio',
                            audio: data.audio
                        });
                    }
                    break;

                case 'send_text':
                    console.log("RUN", data )
                    if (elevenLabsConversation && elevenLabsConversation.isConnected) {
                        elevenLabsConversation.sendMessage({
                            type: 'text',
                            text: data.text
                        });
                    }
                    break;

                case 'end_conversation':
                    if (elevenLabsConversation) {
                        elevenLabsConversation.disconnect();
                        activeConversations.delete(conversationId);
                    }
                    break;
            }
        } catch (error) {
            console.error('Error handling client message:', error);
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Failed to process message'
            }));
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        if (elevenLabsConversation) {
            elevenLabsConversation.disconnect();
            if (conversationId) {
                activeConversations.delete(conversationId);
            }
        }
    });
});

// REST API endpoints
app.get('/api/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.get('/api/conversations/active', (req, res) => {
    res.json({
        activeConversations: Array.from(activeConversations.keys()),
        count: activeConversations.size
    });
});

app.post('/api/conversations/:id/end', (req, res) => {
    const conversationId = req.params.id;
    const conversation = activeConversations.get(conversationId);
    
    if (conversation) {
        conversation.disconnect();
        activeConversations.delete(conversationId);
        res.json({ message: 'Conversation ended successfully' });
    } else {
        res.status(404).json({ error: 'Conversation not found' });
    }
});

// Utility function to generate conversation ID
function generateConversationId() {
    return 'conv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('Shutting down gracefully...');
    
    // Close all active conversations
    activeConversations.forEach(conversation => {
        conversation.disconnect();
    });
    
    server.close(() => {
        process.exit(0);
    });
});

module.exports = app;