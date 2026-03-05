import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Send, Square, Bot, User, Globe } from 'lucide-react';
import './index.css';

export default function App() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hello! I am your AI Blog Assistant. What topic would you like to write about today?", id: Date.now() }
  ]);
  const [input, setInput] = useState('');
  const [language, setLanguage] = useState('English');
  const [isGenerating, setIsGenerating] = useState(false);
  const messagesEndRef = useRef(null);
  const abortControllerRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || isGenerating) return;

    const userMessage = { role: 'user', content: input, id: Date.now() };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsGenerating(true);

    const botMessageId = Date.now() + 1;
    setMessages((prev) => [...prev, { role: 'assistant', content: '', id: botMessageId }]);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch('https://blog-generation-langraph-ai-8irn.vercel.app/blogs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: input, language: language.toLowerCase() }),
        signal: controller.signal,
      });

      if (!response.body) throw new Error('No readable stream available');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let doneReading = false;
      let streamedContent = '';
      let streamBuffer = '';

      while (!doneReading) {
        const { value, done } = await reader.read();
        doneReading = done;
        if (value) {
          streamBuffer += decoder.decode(value, { stream: true });
          const lines = streamBuffer.split('\n');
          streamBuffer = lines.pop() || ''; // Keep the incomplete line for the next chunk

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('data:')) {
              const dataStr = trimmedLine.replace(/^data:\s*/, '').trim();
              if (!dataStr) continue;
              try {
                const parsed = JSON.parse(dataStr);
                if (parsed.event === 'done') {
                  doneReading = true;
                  break;
                }
                if (parsed.chunk) {
                  streamedContent += parsed.chunk;
                  setMessages((prev) => prev.map(msg =>
                    msg.id === botMessageId ? { ...msg, content: streamedContent } : msg
                  ));
                }
              } catch (e) {
                console.error('Error parsing stream chunk:', e, dataStr);
              }
            }
          }
        }
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Stream aborted by user.');
      } else {
        console.error('Error during fetch:', error);
        setMessages((prev) => [...prev, { role: 'assistant', content: 'Apologies, an error occurred while generating the blog.', id: Date.now() + 2 }]);
      }
    } finally {
      abortControllerRef.current = null;
      setIsGenerating(false);
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  // Adjust textarea height automatically
  const textareaRef = useRef(null);
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [input]);

  return (
    <div className="app-container">
      {/* Background elements */}
      <div className="bg-shape shape1"></div>
      <div className="bg-shape shape2"></div>

      <div className="chat-interface">
        <header className="chat-header">
          <div className="header-title">
            <Bot className="bot-icon animate-pulse" size={28} />
            <h1>Blog <span>AI</span></h1>
          </div>
          <div className="header-controls">
            <div className="dropdown">
              <Globe className="dropdown-icon" size={18} />
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                disabled={isGenerating}
              >
                <option value="English">English</option>
                <option value="Hindi">Hindi</option>
                <option value="French">French</option>
              </select>
            </div>
          </div>
        </header>

        <div className="chat-messages">
          {messages.map((message) => (
            <div key={message.id} className={`message-wrapper ${message.role}`}>
              <div className="avatar">
                {message.role === 'assistant' ? <Bot size={20} /> : <User size={20} />}
              </div>
              <div className="message-content">
                {message.role === 'assistant' ? (
                  <ReactMarkdown>{message.content}</ReactMarkdown>
                ) : (
                  <p>{message.content}</p>
                )}
                {message.role === 'assistant' && isGenerating && message.content === '' && (
                  <div className="typing-indicator">
                    <span></span><span></span><span></span>
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <form className="chat-input-form" onSubmit={handleSend}>
          <div className="input-wrapper">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe your blog topic..."
              rows={1}
              disabled={isGenerating}
            />
            {isGenerating ? (
              <button type="button" onClick={handleStop} className="send-btn stop-btn">
                <Square size={18} />
              </button>
            ) : (
              <button type="submit" disabled={!input.trim()} className="send-btn">
                <Send size={20} />
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
