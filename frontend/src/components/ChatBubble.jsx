export default function ChatBubble({ msg }) {
  return (
    <div className={`message ${msg.sender}`}>
      <p>{msg.text}</p>
    </div>
  );
}
