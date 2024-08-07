const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const path = require('path');

// Initialize Cloudinary
cloudinary.config({
    cloud_name: 'your_cloud_name',
    api_key: 'your_api_key',
    api_secret: 'your_api_secret'
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

let usersCount = 0;
let likeCount = 0;
let dislikeCount = 0;
const userLikes = {}; // Track likes/dislikes per user

// Multer setup for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.post('/upload', upload.single('file'), async (req, res) => {
    try {
        const result = await cloudinary.uploader.upload_stream(
            { resource_type: 'video', public_id: path.basename(req.file.originalname, path.extname(req.file.originalname)) },
            (error, result) => {
                if (error) {
                    console.error('Cloudinary upload error:', error);
                    return res.status(500).json({ error: error.message });
                }
                res.json({ url: result.secure_url });
            }
        );
        req.file.stream.pipe(result);
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: error.message });
    }
});

io.on('connection', (socket) => {
    console.log('A user connected', socket.id);
    usersCount++;
    io.emit('users count', usersCount);

    socket.on('join', () => {
        console.log('User joined:', socket.id);
        socket.join('stream');
    });

    socket.on('chat message', (msg) => {
        console.log('Chat message received:', msg);
        io.to('stream').emit('chat message', msg);
    });

    socket.on('like', (userId) => {
        console.log('Like received from', userId);
        if (userLikes[userId] === 'dislike') {
            dislikeCount--;
        }
        if (userLikes[userId] !== 'like') {
            likeCount++;
            userLikes[userId] = 'like';
        }
        io.to('stream').emit('like', likeCount);
        io.to('stream').emit('dislike', dislikeCount);
    });

    socket.on('dislike', (userId) => {
        console.log('Dislike received from', userId);
        if (userLikes[userId] === 'like') {
            likeCount--;
        }
        if (userLikes[userId] !== 'dislike') {
            dislikeCount++;
            userLikes[userId] = 'dislike';
        }
        io.to('stream').emit('like', likeCount);
        io.to('stream').emit('dislike', dislikeCount);
    });

    socket.on('streamData', (data) => {
        console.log('Receiving stream data from', socket.id);
        io.to('stream').emit('streamData', data);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected', socket.id);
        usersCount--;
        io.emit('users count', usersCount);
        // Clean up userLikes for the disconnected user
        Object.keys(userLikes).forEach(userId => {
            if (userLikes[userId] && userId === socket.id) {
                if (userLikes[userId] === 'like') {
                    likeCount--;
                } else if (userLikes[userId] === 'dislike') {
                    dislikeCount--;
                }
                delete userLikes[userId];
            }
        });
        io.to('stream').emit('like', likeCount);
        io.to('stream').emit('dislike', dislikeCount);
    });
});

app.post('/like', (req, res) => {
    console.log('Like endpoint hit');
    likeCount++;
    io.emit('like', likeCount);  // Emit like count to all connected clients
    res.status(200).send('Like recorded');
});

app.post('/dislike', (req, res) => {
    console.log('Dislike endpoint hit');
    dislikeCount++;
    io.emit('dislike', dislikeCount);  // Emit dislike count to all connected clients
    res.status(200).send('Dislike recorded');
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
