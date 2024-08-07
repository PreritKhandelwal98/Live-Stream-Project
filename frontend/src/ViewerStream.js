import React, { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';

const ViewerStream = () => {
    const videoRef = useRef(null);
    const [mediaSource, setMediaSource] = useState(null);
    const [bufferQueue, setBufferQueue] = useState([]);
    const [usersCount, setUsersCount] = useState(0);
    const [likeCount, setLikeCount] = useState(0);
    const [dislikeCount, setDislikeCount] = useState(0);
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState([]);
    const socket = useRef(null);

    useEffect(() => {
        socket.current = io('http://localhost:5000');

        socket.current.on('connect', () => {
            console.log('Connected to server');
            socket.current.emit('join', { role: 'viewer' });
        });

        socket.current.on('streamData', (data) => {
            const blob = new Blob([data], { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            videoRef.current.src = url;
        });

        socket.current.on('chat message', (msg) => {
            setMessages((prevMessages) => [...prevMessages, msg]);
        });

        socket.current.on('users count', (count) => {
            setUsersCount(count);
        });

        socket.current.on('like', (count) => {
            setLikeCount(count);
        });

        socket.current.on('dislike', (count) => {
            setDislikeCount(count);
        });

        return () => {
            socket.current.disconnect();
        };
    }, []);

    const sendMessage = () => {
        socket.current.emit('chat message', { user: 'Viewer', message });
        setMessage('');
    };

    const handleLike = () => {
        socket.current.emit('like', socket.current.id); // Send userId (socket id) with the like event
    };

    const handleDislike = () => {
        socket.current.emit('dislike', socket.current.id); // Send userId (socket id) with the dislike event
    };

    return (
        <div>
            <h2>Viewer Stream</h2>
            <p>Users Count: {usersCount}</p>
            <video ref={videoRef} autoPlay controls></video>
            <div>
                <button onClick={handleLike}>Like</button>
                <span>Likes: {likeCount}</span>
                <button onClick={handleDislike}>Dislike</button>
                <span>Dislikes: {dislikeCount}</span>
            </div>
            <div>
                <h3>Chat</h3>
                <div id="chat">
                    {messages.map((msg, index) => (
                        <p key={index}><strong>{msg.user}:</strong> {msg.message}</p>
                    ))}
                </div>
                <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                />
                <button onClick={sendMessage}>Send</button>
            </div>
        </div>
    );
};

export default ViewerStream;
