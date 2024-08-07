import React, { useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';

const AdminStream = () => {
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState([]);
    const [usersCount, setUsersCount] = useState(0);
    const [streaming, setStreaming] = useState(false);
    const [mediaRecorder, setMediaRecorder] = useState(null);
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const socket = useRef(null);

    useEffect(() => {
        socket.current = io('http://localhost:5000');

        socket.current.on('connect', () => {
            console.log('Connected to server');
            socket.current.emit('join', { role: 'admin' });
        });

        socket.current.on('chat message', (msg) => {
            setMessages((prevMessages) => [...prevMessages, msg]);
        });

        socket.current.on('users count', (count) => {
            setUsersCount(count);
        });

        socket.current.on('streamData', (data) => {
            console.log('Received stream data');
            // Handle stream data here if needed
        });

        return () => {
            socket.current.disconnect();
        };
    }, []);

    const sendMessage = () => {
        console.log('Sending message:', message);
        socket.current.emit('chat message', { user: 'Admin', message });
        setMessage('');
    };

    const startStreaming = () => {
        console.log('Starting streaming...');
        setStreaming(true);
        navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            .then(stream => {
                console.log('Media stream obtained');
                streamRef.current = stream;
                videoRef.current.srcObject = stream;
                const recorder = new MediaRecorder(stream);
                setMediaRecorder(recorder);
                let recordedChunks = [];
                recorder.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        console.log('Data available:', event.data.size);
                        recordedChunks.push(event.data);
                        socket.current.emit('streamData', event.data);
                    }
                };
                recorder.onstop = async () => {
                    console.log('Recording stopped');
                    const blob = new Blob(recordedChunks, { type: 'video/webm' });
                    const file = new File([blob], 'stream.webm', { type: 'video/webm' });

                    // Upload to backend
                    const formData = new FormData();
                    formData.append('file', file);

                    try {
                        const response = await fetch('http://localhost:5000/upload', {
                            method: 'POST',
                            body: formData
                        });
                        const result = await response.json();
                        console.log('Uploaded to Cloudinary:', result.url);
                    } catch (error) {
                        console.error('Error uploading video:', error);
                    }
                };
                recorder.start(1000); // Send data every second
                console.log('Recorder started');
            })
            .catch(error => {
                console.error('Error accessing media devices:', error);
            });
    };

    const stopStreaming = () => {
        console.log('Stopping streaming...');
        if (mediaRecorder) {
            mediaRecorder.stop();
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop()); // Stop all tracks
            videoRef.current.srcObject = null;
        }
        setStreaming(false);
    };

    return (
        <div>
            <h2>Admin Stream</h2>
            <p>Viewers: {usersCount}</p>
            <video ref={videoRef} autoPlay playsInline></video>
            <button onClick={streaming ? stopStreaming : startStreaming}>
                {streaming ? 'Stop Streaming' : 'Start Streaming'}
            </button>
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

export default AdminStream;
