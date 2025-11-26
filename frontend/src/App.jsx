import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { askQuestion, uploadFiles, voiceInput, voiceOutput } from "./utils/api";
import "./App.css";

export default function App() {
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState([]);
  const [files, setFiles] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fileUpload, setFileUpload] = useState(false);
  const inputRef = useRef();
  const messagesEndRef = useRef(null);
  const audioRef = useRef(null);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  useEffect(() => {
    if (audioUrl && audioRef.current) {
      audioRef.current.play();
    }
  }, [audioUrl]);

  const sendQuery = async () => {
    if (!query.trim()) return;
    
    const userMessage = { who: "user", text: query };
    setMessages((m) => [...m, userMessage]);
    const currentQuery = query;
    setQuery(""); // Clear input immediately for better UX
    setIsLoading(true);
    
    // Add a placeholder message for AI that will be updated
    const aiMessageIndex = messages.length + 1; // +1 because we just added user message
    setMessages((m) => [...m, { who: "ai", text: "" }]);
    
    try {
      const response = await fetch('http://localhost:8000/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: currentQuery })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.content) {
                accumulatedText += data.content;
                
                // Update the AI message in real-time
                setMessages((m) => {
                  const newMessages = [...m];
                  newMessages[aiMessageIndex] = { 
                    who: "ai", 
                    text: accumulatedText 
                  };
                  return newMessages;
                });
              }
              
              if (data.done) {
                console.log('Stream complete');
              }
              
              if (data.error) {
                console.error('Stream error:', data.error);
                setMessages((m) => {
                  const newMessages = [...m];
                  newMessages[aiMessageIndex] = { 
                    who: "ai", 
                    text: `Error: ${data.error}` 
                  };
                  return newMessages;
                });
              }
            } catch (parseError) {
              console.error('Failed to parse SSE data:', parseError);
            }
          }
        }
      }
      
      // If no content was received, show error
      if (!accumulatedText) {
        setMessages((m) => {
          const newMessages = [...m];
          newMessages[aiMessageIndex] = { 
            who: "ai", 
            text: "No response received from server" 
          };
          return newMessages;
        });
      }
      
    } catch (err) {
      const errorMsg = err.response?.data?.detail || err.message || "Unknown error occurred";
      setMessages((m) => {
        const newMessages = [...m];
        newMessages[aiMessageIndex] = { 
          who: "ai", 
          text: `Error: ${errorMsg}` 
        };
        return newMessages;
      });
      console.error("Query error:", err);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleFilesUpload = async () => {
    if (!files || files.length === 0) {
      alert("Please select files first");
      return;
    }
    
    try {
      setFileUpload(true);
      const res = await uploadFiles(files);
      const uploadedFiles = res.data.uploaded_files?.join(", ") || "Files uploaded successfully";
      alert("Uploaded: " + uploadedFiles);
      
      setFiles(null);
      // Clear file input
      document.querySelector('input[type="file"]').value = "";
    } catch (err) {
      const errorMsg = err.response?.data?.detail || err.message || "Upload failed";
      alert("Upload failed: " + errorMsg);
      console.error("Upload error:", err);
    } finally {
      setFileUpload(false);
    }
  };

  // ----------------------------
  // Voice Input (Microphone)
  // ----------------------------
  const handleMicToggle = async () => {
    if (isRecording) {
      if (mediaRecorder) {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
      }
      setIsRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Try to use WAV format first (no conversion needed), fallback to webm
      let mimeType = 'audio/wav';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
      }
      
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: mimeType });
        console.log(blob);
        
        const extension = mimeType.includes('wav') ? 'wav' : 'webm';
        console.log(extension);
        
        const file = new File([blob], `voice-input.${extension}`, { type: mimeType });
        console.log(file);
        
        console.log(`Recorded audio: ${file.name}, size: ${file.size}, type: ${file.type}`);

        try {
          setIsLoading(true);
          const res = await voiceInput(file);
          console.log(res);
          
          const transcript = res.data?.transcript ?? "Could not transcribe audio";
          setQuery(transcript);
        } catch (err) {
          console.error("Transcription error:", err);
          alert("Voice transcription failed: " + (err.response?.data?.detail || err.message));
        } finally {
          setIsLoading(false);
          // Stop all tracks
          stream.getTracks().forEach(track => track.stop());
        }
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone access denied:", err);
      alert("Please allow microphone access to use voice input");
    }
  };

  const handleVoiceOutput = async () => {
    const lastAiMessage = [...messages].reverse().find(m => m.who === "ai");
    
    if (!lastAiMessage?.text) {
      alert("No AI response to convert to speech");
      return;
    }

    try {
      setIsLoading(true);
      const res = await voiceOutput(lastAiMessage.text);
      
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      
      const url = URL.createObjectURL(res.data);
      setAudioUrl(url);
    } catch (err) {
      console.error("TTS error:", err);
      alert("Text-to-speech failed: " + (err.response?.data?.detail || err.message));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mybot-shell">
      <div className="card">
        <header className="card-header">
          <div className="logo">MyBot</div>
          <div className="subtitle">Agentic Intelligence Protocol</div>
        </header>

        <main className="chat-area">
          {messages.length === 0 && (
            <div className="placeholder">Type or speak your prompt...</div>
          )}
          <div className="messages">
            {messages.map((m, i) => (
              <div 
                key={i} 
                className={`msg ${
                  m.who === "user" 
                    ? "msg-user" 
                    : m.who === "system"
                    ? "msg-system"
                    : "msg-ai"
                }`}
              >
                {m.who === "ai" ? (
                  <div className="markdown-content">
                    <ReactMarkdown
                      components={{
                        h1: ({node, ...props}) => <h1 className="md-h1" {...props} />,
                        h2: ({node, ...props}) => <h2 className="md-h2" {...props} />,
                        h3: ({node, ...props}) => <h3 className="md-h3" {...props} />,
                        p: ({node, ...props}) => <p className="md-p" {...props} />,
                        ul: ({node, ...props}) => <ul className="md-ul" {...props} />,
                        ol: ({node, ...props}) => <ol className="md-ol" {...props} />,
                        li: ({node, ...props}) => <li className="md-li" {...props} />,
                        strong: ({node, ...props}) => <strong className="md-strong" {...props} />,
                        em: ({node, ...props}) => <em className="md-em" {...props} />,
                        code: ({node, inline, ...props}) => 
                          inline ? (
                            <code className="md-code-inline" {...props} />
                          ) : (
                            <code className="md-code-block" {...props} />
                          ),
                        pre: ({node, ...props}) => <pre className="md-pre" {...props} />,
                        blockquote: ({node, ...props}) => <blockquote className="md-blockquote" {...props} />,
                        a: ({node, ...props}) => <a className="md-link" target="_blank" rel="noopener noreferrer" {...props} />,
                      }}
                    >
                      {m.text}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div>{m.text}</div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="msg msg-ai loading">
                <span className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </main>

        <footer className="composer">
          <input
            ref={inputRef}
            className="composer-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type or speak your prompt..."
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendQuery();
              }
            }}
            disabled={isLoading}
          />
          <button
            className={`mic-btn ${isRecording ? "recording" : ""}`}
            onClick={handleMicToggle}
            title={isRecording ? "Stop Recording" : "Start Recording"}
            disabled={isLoading}
          >
            {isRecording ? "⏹️" : "🎤"}
          </button>
          <button
            className="tts-btn"
            onClick={handleVoiceOutput}
            title="Listen to last response"
            disabled={isLoading || messages.filter(m => m.who === "ai").length === 0}
          >
            🔊
          </button>
          <button 
            className="send-btn" 
            onClick={sendQuery}
            disabled={isLoading || !query.trim()}
          >
            ▶
          </button>
        </footer>
      </div>

      <aside className="panel">
        <div className="panel-section">
          <label className="label">Upload documents (multiple)</label>
          <input 
            type="file" 
            multiple 
            onChange={(e) => setFiles(e.target.files)}
            accept=".pdf,.txt,.doc,.docx"
            disabled={fileUpload}
          />
          <button 
            className="panel-btn" 
            onClick={handleFilesUpload}
            disabled={fileUpload || !files || files.length === 0}
          >
            {fileUpload ? "Uploading..." : "Upload"}
          </button>
        </div>

        {audioUrl && (
          <div className="panel-section">
            <label className="label">Audio Output</label>
            <audio ref={audioRef} controls src={audioUrl} />
          </div>
        )}
      </aside>
    </div>
  );
}