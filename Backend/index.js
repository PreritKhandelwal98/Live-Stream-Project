const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const path = require('path');
const { Readable } = require('stream');
const crypto = require('crypto');
const dotenv = require('dotenv');

dotenv.config();

// Initialize Cloudinary
cloudinary.config({
    cloud_name: process.env.cloud_name,
    api_key: process.env.api_key,
    api_secret: process.env.api_secret
});

const app = express();
const server = http.createServer(app);

app.use(cors({
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
    credentials: true
}));

const io = socketIo(server, {
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
    }
});

const streams = {}; // Maps stream IDs to stream data
const userLikes = {}; // Track likes/dislikes per user

// Generate a unique stream ID
const generateStreamId = () => {
    return crypto.randomBytes(8).toString('hex'); // 16-character unique ID
};

// Multer setup for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.post('/upload', upload.single('file'), (req, res) => {
    console.log('Upload endpoint hit');
    console.log('File object:', req.file);

    if (!req.file) {
        console.log('No file uploaded');
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const bufferStream = new Readable();
    bufferStream.push(req.file.buffer);
    bufferStream.push(null); // Indicate end of stream

    const uploadStream = cloudinary.uploader.upload_stream(
        { resource_type: 'video', public_id: path.basename(req.file.originalname, path.extname(req.file.originalname)) },
        (error, result) => {
            if (error) {
                console.error('Cloudinary upload error:', error);
                return res.status(500).json({ error: error.message });
            }
            console.log('Cloudinary upload result:', result);
            res.json({ url: result.secure_url });
        }
    );

    bufferStream.pipe(uploadStream);
});

io.on('connection', (socket) => {
    console.log('A user connected', socket.id);

    socket.on('start stream', () => {
        const streamId = generateStreamId();
        console.log('Stream started:', streamId);
        streams[streamId] = {
            userCount: 0,
            likeCount: 0,
            dislikeCount: 0
        };
        socket.emit('stream started', streamId);
    });

    socket.on('join stream', (streamId) => {
        console.log('User joined stream:', streamId);
        if (streams[streamId]) {
            streams[streamId].userCount++;
            socket.join(streamId);
            io.to(streamId).emit('users count', streams[streamId].userCount);
        }
    });

    socket.on('chat message', (streamId, msg) => {
        console.log('Chat message received for stream', streamId, ':', msg);
        io.to(streamId).emit('chat message', msg);
    });

    socket.on('like', (streamId, userId) => {
        console.log('Like received for stream', streamId, 'from', userId);
        if (!streams[streamId]) return;

        if (userLikes[userId] === streamId) {
            streams[streamId].likeCount++;
        } else if (userLikes[userId] === 'dislike') {
            streams[streamId].dislikeCount--;
            streams[streamId].likeCount++;
        } else {
            userLikes[userId] = 'like';
            streams[streamId].likeCount++;
        }

        io.to(streamId).emit('like', streams[streamId].likeCount);
        io.to(streamId).emit('dislike', streams[streamId].dislikeCount);
    });

    socket.on('dislike', (streamId, userId) => {
        console.log('Dislike received for stream', streamId, 'from', userId);
        if (!streams[streamId]) return;

        if (userLikes[userId] === streamId) {
            streams[streamId].dislikeCount++;
        } else if (userLikes[userId] === 'like') {
            streams[streamId].likeCount--;
            streams[streamId].dislikeCount++;
        } else {
            userLikes[userId] = 'dislike';
            streams[streamId].dislikeCount++;
        }

        io.to(streamId).emit('like', streams[streamId].likeCount);
        io.to(streamId).emit('dislike', streams[streamId].dislikeCount);
    });

    socket.on('streamData', (streamId, data) => {
        console.log('Receiving stream data for stream', streamId);
        io.to(streamId).emit('streamData', data);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected', socket.id);
        Object.keys(streams).forEach(streamId => {
            if (io.sockets.adapter.rooms.get(streamId)) {
                streams[streamId].userCount--;
                io.to(streamId).emit('users count', streams[streamId].userCount);
            }
        });
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
