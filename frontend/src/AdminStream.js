import React, { useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';

const AdminStream = () => {
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState([]);
    const [usersCount, setUsersCount] = useState(0);
    const [streamId, setStreamId] = useState('');
    const [streaming, setStreaming] = useState(false);
    const [mediaRecorder, setMediaRecorder] = useState(null);
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const socket = useRef(null);

    useEffect(() => {
        socket.current = io('http://localhost:5000');

        socket.current.on('connect', () => {
            console.log('Connected to server');
        });

        socket.current.on('stream started', (id) => {
            console.log('Stream started with ID:', id);
            setStreamId(id);
            setStreaming(true);
            navigator.mediaDevices.getUserMedia({ video: true, audio: true })
                .then(stream => {
                    streamRef.current = stream;
                    videoRef.current.srcObject = stream;
                    const recorder = new MediaRecorder(stream);
                    setMediaRecorder(recorder);
                    let recordedChunks = [];
                    recorder.ondataavailable = (event) => {
                        if (event.data.size > 0) {
                            recordedChunks.push(event.data);
                            socket.current.emit('streamData', streamId, event.data);
                        }
                    };
                    recorder.onstop = async () => {
                        const blob = new Blob(recordedChunks, { type: 'video/webm' });
                        const file = new File([blob], 'stream.webm', { type: 'video/webm' });

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
                    recorder.start(1000);
                })
                .catch(error => console.error('Error accessing media devices.', error));
        });

        socket.current.on('chat message', (msg) => {
            console.log('Received chat message:', msg);
            setMessages(prevMessages => [...prevMessages, msg]);
        });

        socket.current.on('users count', (count) => {
            console.log('Received users count:', count);
            setUsersCount(count);
        });

        socket.current.on('like', (count) => {
            console.log('Received like count:', count);
            setLikeCount(count);
        });

        socket.current.on('dislike', (count) => {
            console.log('Received dislike count:', count);
            setDislikeCount(count);
        });

        return () => {
            socket.current.disconnect();
        };
    }, []);

    const handleStartStream = () => {
        if (!streaming) {
            socket.current.emit('start stream');
        }
    };

    const stopStreaming = () => {
        if (mediaRecorder) {
            mediaRecorder.stop();
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            videoRef.current.srcObject = null;
        }
        setStreaming(false);
    };

    const sendMessage = () => {
        if (streamId && message.trim()) {
            socket.current.emit('chat message', streamId, { user: 'Admin', message });
            setMessage('');
        }
    };

    return (
        <div>
            <h2>Admin Stream</h2>
            <button onClick={handleStartStream}>
                {streaming ? 'Stream Started' : 'Start Stream'}
            </button>
            {streamId && (
                <div>
                    <p>Stream ID: <strong>{streamId}</strong></p>
                    <button onClick={() => navigator.clipboard.writeText(streamId)}>Copy Stream ID</button>
                </div>
            )}
            <p>Viewers: {usersCount}</p>
            <video ref={videoRef} autoPlay playsInline></video>
            {streaming && (
                <button onClick={stopStreaming}>Stop Streaming</button>
            )}
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
