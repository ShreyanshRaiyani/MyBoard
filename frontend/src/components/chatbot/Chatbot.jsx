import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  X,
  Send,
  Bot,
  User,
  Sparkles,
  Maximize2,
  Minimize2,
  Trash2,
  MapPin,
  Calendar,
  Clock,
  ArrowRight,
  TrendingUp,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import axiosInstance from '../../utils/axiosInstance';
import './Chatbot.css';

/**
 * Format timestamp (e.g. 10:45 AM)
 */
function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Simple, safe markdown parser for bold, headers, lists, code spans
 */
function renderMarkdown(text) {
  if (!text) return null;

  const lines = text.split('\n');
  const elements = [];

  lines.forEach((line, lineIdx) => {
    let trimmed = line.trim();

    if (!trimmed) {
      elements.push(<div key={`br-${lineIdx}`} style={{ height: '6px' }} />);
      return;
    }

    // Header 3 / 4
    if (trimmed.startsWith('### ')) {
      elements.push(
        <h3 key={`h3-${lineIdx}`}>
          {trimmed.replace('### ', '')}
        </h3>
      );
      return;
    }
    if (trimmed.startsWith('## ')) {
      elements.push(
        <h3 key={`h2-${lineIdx}`}>
          {trimmed.replace('## ', '')}
        </h3>
      );
      return;
    }

    // List item (- or *)
    const isBullet = trimmed.startsWith('- ') || trimmed.startsWith('* ');
    const isNumbered = /^\d+\.\s/.test(trimmed);

    let content = trimmed;
    if (isBullet) content = trimmed.substring(2);
    else if (isNumbered) content = trimmed.replace(/^\d+\.\s/, '');

    // Format bold (**bold**) and inline code (`code`)
    const parts = content.split(/(\*\*.*?\*\*|`.*?`)/g);
    const formattedParts = parts.map((part, pIdx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={pIdx}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={pIdx}>{part.slice(1, -1)}</code>;
      }
      return part;
    });

    if (isBullet || isNumbered) {
      elements.push(
        <div key={`li-${lineIdx}`} style={{ display: 'flex', gap: '6px', margin: '3px 0' }}>
          <span>•</span>
          <div>{formattedParts}</div>
        </div>
      );
    } else {
      elements.push(
        <p key={`p-${lineIdx}`}>
          {formattedParts}
        </p>
      );
    }
  });

  return elements;
}

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [sessionId, setSessionId] = useState(() => {
    let s = localStorage.getItem('myboard_chat_session');
    if (!s) {
      s = `mb_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem('myboard_chat_session', s);
    }
    return s;
  });

  const [userInfo, setUserInfo] = useState({
    token: localStorage.getItem('token') || '',
    userType: localStorage.getItem('userType') || 'Guest',
    firstName: localStorage.getItem('firstName') || ''
  });

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Sync user state changes (e.g. login/logout)
  useEffect(() => {
    const handleUserChange = () => {
      setUserInfo({
        token: localStorage.getItem('token') || '',
        userType: localStorage.getItem('userType') || 'Guest',
        firstName: localStorage.getItem('firstName') || ''
      });
      fetchSuggestions();
    };

    window.addEventListener('userChanged', handleUserChange);
    return () => window.removeEventListener('userChanged', handleUserChange);
  }, []);

  // Fetch quick suggestions from backend
  const fetchSuggestions = async () => {
    try {
      const res = await axiosInstance.get('/api/chat/suggestions');
      if (res.data?.status === 1 && Array.isArray(res.data.suggestions)) {
        setSuggestions(res.data.suggestions);
      }
    } catch (err) {
      // Fallback suggestions
      setSuggestions([
        'Find available hoardings in Ahmedabad',
        'How do I book a hoarding?',
        'Hoardings under ₹5,000/day',
        'What are the cancellation policies?'
      ]);
    }
  };

  // Load chat history if existing session
  const loadChatHistory = async (sid) => {
    try {
      const res = await axiosInstance.get(`/api/chat/history/${sid}`);
      if (res.data?.status === 1 && Array.isArray(res.data.messages) && res.data.messages.length > 0) {
        setMessages(
          res.data.messages.map((m) => ({
            id: m._id,
            role: m.role,
            content: m.content,
            metadata: m.metadata || {},
            createdAt: m.createdAt
          }))
        );
      }
    } catch (err) {
      console.warn('Could not load chat history:', err.message);
    }
  };

  useEffect(() => {
    fetchSuggestions();
    if (sessionId) {
      loadChatHistory(sessionId);
    }
  }, [sessionId]);

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen, isLoading]);

  // Send message handler
  const handleSendMessage = async (textToSend) => {
    const message = (textToSend || inputText).trim();
    if (!message || isLoading) return;

    const userMessageItem = {
      id: `usr_${Date.now()}`,
      role: 'user',
      content: message,
      createdAt: new Date().toISOString()
    };

    setMessages((prev) => [...prev, userMessageItem]);
    setInputText('');
    setIsLoading(true);

    try {
      const res = await axiosInstance.post('/api/chat/message', {
        message,
        sessionId
      });

      if (res.data?.status === 1) {
        const assistantMessageItem = {
          id: `ast_${Date.now()}`,
          role: 'assistant',
          content: res.data.reply,
          metadata: res.data.metadata || {},
          createdAt: new Date().toISOString()
        };

        setMessages((prev) => [...prev, assistantMessageItem]);

        if (Array.isArray(res.data.metadata?.suggestedQuestions) && res.data.metadata.suggestedQuestions.length > 0) {
          setSuggestions(res.data.metadata.suggestedQuestions);
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessageItem = {
        id: `err_${Date.now()}`,
        role: 'assistant',
        content: "I'm having trouble connecting to the server. Please check your connection and try again.",
        metadata: {},
        createdAt: new Date().toISOString()
      };
      setMessages((prev) => [...prev, errorMessageItem]);
    } finally {
      setIsLoading(false);
    }
  };

  // Clear chat conversation
  const handleClearChat = async () => {
    if (window.confirm('Are you sure you want to clear your conversation history?')) {
      try {
        await axiosInstance.delete(`/api/chat/history/${sessionId}`);
      } catch (err) {
        console.warn('Clear history error:', err);
      }
      setMessages([]);
      fetchSuggestions();
    }
  };

  // Handle textarea keypress (Enter to send, Shift+Enter for newline)
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <>
      {/* Floating Action Button (FAB) */}
      <button
        className="myboard-chat-fab"
        onClick={() => setIsOpen(!isOpen)}
        title="Chat with MyBoard AI"
        aria-label="Open MyBoard AI Chat"
      >
        <span className="fab-pulse" />
        {isOpen ? <X size={26} /> : <Bot size={28} />}
        {!isOpen && <span className="fab-badge" />}
      </button>

      {/* Floating Chat Window */}
      {isOpen && (
        <div className={`myboard-chat-window ${isMaximized ? 'maximized' : ''}`}>
          {/* Header */}
          <div className="chat-header">
            <div className="chat-header-info">
              <div className="chat-avatar-wrapper">
                <Bot size={22} color="#ffffff" />
                <span className="status-dot" />
              </div>
              <div>
                <h3 className="chat-header-title">MyBoard AI</h3>
                <div className="chat-header-subtitle">
                  <span>Intelligent Assistant</span>
                  <span className="chat-role-badge">{userInfo.userType}</span>
                </div>
              </div>
            </div>

            <div className="chat-header-actions">
              <button
                className="chat-header-btn"
                onClick={handleClearChat}
                title="Clear conversation"
              >
                <Trash2 size={16} />
              </button>
              <button
                className="chat-header-btn"
                onClick={() => setIsMaximized(!isMaximized)}
                title={isMaximized ? 'Restore' : 'Maximize'}
              >
                {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
              <button
                className="chat-header-btn"
                onClick={() => setIsOpen(false)}
                title="Close chat"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Messages Container */}
          <div className="chat-messages">
            {/* Welcome Card */}
            {messages.length === 0 && (
              <div className="chat-welcome-card">
                <h4>
                  <Sparkles size={16} color="var(--mb-primary)" />
                  Welcome to MyBoard AI{userInfo.firstName ? `, ${userInfo.firstName}` : ''}!
                </h4>
                <p>
                  I'm your billboard & outdoor advertising assistant. You can ask me to:
                </p>
                <ul style={{ margin: '8px 0 4px 0', paddingLeft: '18px', fontSize: '12px', color: '#475569' }}>
                  <li>Search hoardings by city, area, price, and billboard type</li>
                  <li>Check your booking status and waitlist queue positions</li>
                  <li>Learn about booking, payment, and cancellation policies</li>
                  {userInfo.userType === 'SuperAdmin' && (
                    <li>Provide revenue analytics and hoarding occupancy insights</li>
                  )}
                </ul>
              </div>
            )}

            {/* Conversation Messages */}
            {messages.map((msg) => (
              <div key={msg.id} className={`chat-message-row ${msg.role}`}>
                <div className="chat-msg-avatar">
                  {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                </div>

                <div className="chat-bubble">
                  <div className="chat-bubble-content">
                    {renderMarkdown(msg.content)}
                  </div>

                  {/* Hoarding Cards Carousel / Deck */}
                  {msg.metadata?.hoardings && msg.metadata.hoardings.length > 0 && (
                    <div className="chat-hoardings-deck">
                      {msg.metadata.hoardings.map((h) => (
                        <div key={h._id || h.id} className="chat-hoarding-card">
                          <div className="chat-hoarding-thumb">
                            {h.images && h.images[0] ? (
                              <img src={h.images[0]} alt={h.hoardingName} />
                            ) : (
                              <div
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  background: '#e0f2fe',
                                  color: '#0284c7',
                                  fontWeight: '600',
                                  fontSize: '12px'
                                }}
                              >
                                {h.type || 'Hoarding'}
                              </div>
                            )}
                            <span className="chat-hoarding-badge">{h.type}</span>
                          </div>

                          <div className="chat-hoarding-body">
                            <h5 className="chat-hoarding-title">
                              <span>{h.hoardingName}</span>
                              <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 'normal' }}>
                                #{h.hoardingCode}
                              </span>
                            </h5>

                            <div className="chat-hoarding-location">
                              <MapPin size={12} color="var(--mb-primary)" />
                              <span>{h.location?.address || h.location?.city || 'Prime Location'}</span>
                            </div>

                            <div className="chat-hoarding-meta">
                              <div className="chat-hoarding-price">
                                ₹{h.pricePerDay?.toLocaleString() || '0'}
                                <span>/day</span>
                              </div>
                              <a
                                href={`/hoarding/${h._id || h.id}`}
                                className="chat-card-btn"
                              >
                                View Details <ArrowRight size={12} />
                              </a>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Bookings Deck */}
                  {msg.metadata?.bookings && msg.metadata.bookings.length > 0 && (
                    <div className="chat-bookings-deck">
                      {msg.metadata.bookings.map((b) => (
                        <div key={b._id} className="chat-booking-card">
                          <div className="chat-booking-header">
                            <span className="chat-booking-ref">#{b.requestNumber}</span>
                            <span
                              className={`chat-booking-status ${
                                b.status === 'Approved'
                                  ? 'approved'
                                  : b.status === 'Rejected'
                                  ? 'rejected'
                                  : 'pending'
                              }`}
                            >
                              {b.status}
                            </span>
                          </div>

                          <h6 className="chat-booking-campaign">{b.campaignName}</h6>

                          <div className="chat-booking-meta">
                            <span>Billboard: {b.hoarding?.hoardingName || 'N/A'}</span>
                            <span>Total Amount: ₹{b.pricing?.totalAmount?.toLocaleString() || 0}</span>
                            <span>Payment: <strong>{b.paymentStatus}</strong></span>
                          </div>

                          {b.inQueue && (
                            <div className="chat-queue-alert">
                              <Clock size={12} />
                              <span>Waitlist Queue: <strong>Position #{b.queuePosition}</strong></span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Analytics Summary Grid */}
                  {msg.metadata?.analytics && (
                    <div className="chat-analytics-grid">
                      <div className="chat-stat-card">
                        <span className="chat-stat-title">Total Bookings</span>
                        <span className="chat-stat-value">{msg.metadata.analytics.totalBookings}</span>
                      </div>
                      <div className="chat-stat-card">
                        <span className="chat-stat-title">Confirmed Revenue</span>
                        <span className="chat-stat-value">
                          ₹{msg.metadata.analytics.totalRevenue?.toLocaleString() || 0}
                        </span>
                      </div>
                      <div className="chat-stat-card">
                        <span className="chat-stat-title">Active Billboards</span>
                        <span className="chat-stat-value">{msg.metadata.analytics.activeHoardings}</span>
                      </div>
                      <div className="chat-stat-card">
                        <span className="chat-stat-title">Occupancy Rate</span>
                        <span className="chat-stat-value">{msg.metadata.analytics.occupancyRate}</span>
                      </div>
                    </div>
                  )}

                  <span className="chat-msg-time">{formatTime(msg.createdAt)}</span>
                </div>
              </div>
            ))}

            {/* Loading / Typing indicator */}
            {isLoading && (
              <div className="chat-message-row assistant">
                <div className="chat-msg-avatar">
                  <Bot size={16} />
                </div>
                <div className="chat-typing-indicator">
                  <span className="chat-typing-dot" />
                  <span className="chat-typing-dot" />
                  <span className="chat-typing-dot" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Suggested Questions Chips */}
          {suggestions.length > 0 && (
            <div className="chat-suggestions-area">
              {suggestions.map((suggestion, sIdx) => (
                <button
                  key={sIdx}
                  className="chat-suggestion-chip"
                  onClick={() => handleSendMessage(suggestion)}
                  disabled={isLoading}
                >
                  <Sparkles size={11} color="var(--mb-primary)" />
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          {/* Text Input Area */}
          <div className="chat-input-area">
            <textarea
              ref={textareaRef}
              className="chat-textarea"
              placeholder="Ask about hoardings, bookings, policies..."
              rows={1}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
            />
            <button
              className="chat-send-btn"
              onClick={() => handleSendMessage()}
              disabled={!inputText.trim() || isLoading}
              aria-label="Send message"
            >
              <Send size={18} />
            </button>
          </div>

          <div className="chat-footer-note">
            Powered by LangChain.js & MyBoard Intelligent System
          </div>
        </div>
      )}
    </>
  );
}

