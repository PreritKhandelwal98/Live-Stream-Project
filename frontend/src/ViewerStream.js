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
    const [streamId, setStreamId] = useState('');
    const [isJoined, setIsJoined] = useState(false);
    const socket = useRef(null);

    useEffect(() => {
        if (isJoined && streamId) {
            socket.current = io('http://localhost:5000');

            socket.current.on('connect', () => {
                console.log('Connected to server');
                socket.current.emit('join stream', streamId);
            });

            socket.current.on('streamData', (data) => {
                appendBuffer(new Uint8Array(data));
            });

            socket.current.on('chat message', (msg) => {
                console.log('Received chat message:', msg); // Debug log
                setMessages(prevMessages => [...prevMessages, msg]);
            });

            socket.current.on('users count', (count) => {
                console.log('Received users count:', count); // Debug log
                setUsersCount(count);
            });

            socket.current.on('like', (count) => {
                console.log('Received like count:', count); // Debug log
                setLikeCount(count);
            });

            socket.current.on('dislike', (count) => {
                console.log('Received dislike count:', count); // Debug log
                setDislikeCount(count);
            });

            return () => {
                socket.current.disconnect();
            };
        }
    }, [isJoined, streamId]);

    useEffect(() => {
        if (videoRef.current) {
            const ms = new MediaSource();
            videoRef.current.src = URL.createObjectURL(ms);

            ms.addEventListener('sourceopen', () => {
                const sb = ms.addSourceBuffer('video/webm; codecs="vp8, vorbis"');

                sb.addEventListener('updateend', () => {
                    processBufferQueue();
                });

                sb.addEventListener('error', (e) => {
                    console.error('SourceBuffer error:', e);
                });

                setMediaSource(ms);
                setSourceBuffer(sb);
            });

            ms.addEventListener('error', (e) => {
                console.error('MediaSource error:', e);
            });
        }
    }, [videoRef]);

    const appendBuffer = (data) => {
        if (sourceBuffer && !sourceBuffer.updating && mediaSource.readyState === 'open') {
            try {
                sourceBuffer.appendBuffer(data);
            } catch (e) {
                console.error('Error appending buffer:', e);
                resetMediaSource();
            }
        } else {
            setBufferQueue(prevQueue => [...prevQueue, data]);
        }
    };

    const processBufferQueue = () => {
        if (bufferQueue.length > 0 && sourceBuffer && !sourceBuffer.updating) {
            try {
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
        }
    };

    const sendMessage = () => {
        if (streamId) {
            socket.current.emit('chat message', streamId, { user: 'Viewer', message });
            setMessage('');
        }
    };

    const handleLike = () => {
        if (streamId) {
            socket.current.emit('like', streamId, socket.current.id); // Send userId (socket id) with the like event
        }
    };

    const handleDislike = () => {
        if (streamId) {
            socket.current.emit('dislike', streamId, socket.current.id); // Send userId (socket id) with the dislike event
        }
    };

    const joinStream = () => {
        if (streamId) {
            setIsJoined(true);
        }
    };

    return (
        <div>
            <h2>Viewer Stream</h2>
            <input
                type="text"
                value={streamId}
                onChange={(e) => setStreamId(e.target.value)}
                placeholder="Enter Stream ID"
            />
            <button onClick={joinStream}>Join Stream</button>
            {isJoined && (
                <>
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
                </>
            )}
        </div>
    );

};

export default ViewerStream;
