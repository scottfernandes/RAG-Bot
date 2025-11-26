import { useState, useRef } from "react";

export default function InputBar({ onSend }) {
  const [message, setMessage] = useState("");
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);

  const handleVoiceInput = () => {
    if (!("webkitSpeechRecognition" in window)) {
      alert("Speech recognition not supported.");
      return;
    }
    if (recognitionRef.current) recognitionRef.current.stop();

    const recognition = new window.webkitSpeechRecognition();
    recognition.lang = "en-US";
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onresult = (event) =>
      setMessage(event.results[0][0].transcript);

    recognitionRef.current = recognition;
    recognition.start();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSend(message);
    setMessage("");
  };

  return (
    <form onSubmit={handleSubmit} className="input-area">
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type or speak your prompt..."
        className="text-input"
      />
      <button
        type="button"
        onClick={handleVoiceInput}
        className={`mic-btn ${listening ? "active" : ""}`}
      >
        🎙️
      </button>
      <button type="submit" className="send-btn">➤</button>
    </form>
  );
}
