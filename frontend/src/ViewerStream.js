import React, { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';

const ViewerStream = () => {
    const videoRef = useRef(null);
    const [mediaSource, setMediaSource] = useState(null);
    const [sourceBuffer, setSourceBuffer] = useState(null);
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
            console.log('Received stream data:', data);
            appendBuffer(new Uint8Array(data));
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

    useEffect(() => {
        if (videoRef.current) {
            const ms = new MediaSource();
            videoRef.current.src = URL.createObjectURL(ms);

            ms.addEventListener('sourceopen', () => {
                console.log('MediaSource sourceopen event fired');
                const sb = ms.addSourceBuffer('video/webm; codecs="vp8, vorbis"');

                sb.addEventListener('updateend', () => {
                    console.log('SourceBuffer updateend event fired');
                    processBufferQueue();
                });

                sb.addEventListener('error', (e) => {
                    console.error('SourceBuffer error:', e);
                });

                setMediaSource(ms);
                setSourceBuffer(sb);
                console.log('MediaSource and SourceBuffer initialized');
            });

            ms.addEventListener('error', (e) => {
                console.error('MediaSource error:', e);
            });
        }
    }, [videoRef]);

    const appendBuffer = (data) => {
        if (sourceBuffer && !sourceBuffer.updating && mediaSource.readyState === 'open') {
            try {
                console.log('Appending buffer data');
                sourceBuffer.appendBuffer(data);
            } catch (e) {
                console.error('Error appending buffer:', e);
                resetMediaSource();
            }
        } else {
            console.log('Queueing buffer data');
            setBufferQueue((prevQueue) => [...prevQueue, data]);
        }
    };

    const processBufferQueue = () => {
        if (bufferQueue.length > 0 && sourceBuffer && !sourceBuffer.updating) {
            try {
                console.log('Processing buffer queue');
                const data = bufferQueue.shift();
                sourceBuffer.appendBuffer(data);
            } catch (e) {
                console.error('Error processing buffer queue:', e);
                resetMediaSource();
            }
        }
    };

    const resetMediaSource = () => {
        if (mediaSource) {
            if (mediaSource.readyState === 'open') {
                try {
                    mediaSource.endOfStream();
                } catch (e) {
                    console.error('Error ending MediaSource:', e);
                }
            }
            setMediaSource(null);
            setSourceBuffer(null);
            setBufferQueue([]);
            videoRef.current.src = '';
            console.log('MediaSource reset');
        }
    };

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
            <p>Viewers: {usersCount}</p>
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