import React, { useState } from 'react';
import { Send, CheckCircle2, AlertCircle, Loader2, Sparkles, MessageSquare } from 'lucide-react';

export default function TelegramTestCard({ botConfig, onLogSignal }) {
  const [customMessage, setCustomMessage] = useState('Hello World from Artimus! 🚀');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleSendTelegram = async (messageToSend) => {
    setLoading(true);
    setResult(null);

    const msg = messageToSend || customMessage;

    try {
      // 1. Try sending via Netlify Function endpoint
      let response;
      let endpoint = '/.netlify/functions/send-telegram';
      
      const payload = {
        botToken: botConfig.botToken || undefined,
        chatId: botConfig.chatId || undefined,
        message: msg
      };

      try {
        response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } catch (err) {
        // Fallback for direct browser testing if Netlify CLI isn't running locally
        if (botConfig.botToken && botConfig.chatId) {
          const directUrl = `https://api.telegram.org/bot${botConfig.botToken}/sendMessage`;
          response = await fetch(directUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: botConfig.chatId,
              text: msg,
              parse_mode: 'HTML'
            })
          });
        } else {
          throw err;
        }
      }

      const data = await response.json();

      if (data.success || data.ok) {
        const successRes = {
          success: true,
          message: 'Hello World dispatched successfully to Telegram!',
          timestamp: new Date().toLocaleTimeString(),
          details: data
        };
        setResult(successRes);
        if (onLogSignal) {
          onLogSignal({
            type: 'TELEGRAM_TEST',
            status: 'SUCCESS',
            message: msg,
            timestamp: new Date().toLocaleTimeString(),
            response: data
          });
        }
      } else {
        const errorRes = {
          success: false,
          error: data.error || data.description || 'Failed to send message to Telegram',
          timestamp: new Date().toLocaleTimeString(),
          details: data
        };
        setResult(errorRes);
        if (onLogSignal) {
          onLogSignal({
            type: 'TELEGRAM_TEST',
            status: 'FAILED',
            message: msg,
            timestamp: new Date().toLocaleTimeString(),
            error: data.error || data.description
          });
        }
      }
    } catch (error) {
      const failRes = {
        success: false,
        error: error.message || 'Network error connecting to Telegram API / Netlify Function',
        timestamp: new Date().toLocaleTimeString()
      };
      setResult(failRes);
      if (onLogSignal) {
        onLogSignal({
          type: 'TELEGRAM_TEST',
          status: 'ERROR',
          message: msg,
          timestamp: new Date().toLocaleTimeString(),
          error: error.message
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const isConfigured = Boolean(botConfig.botToken && botConfig.chatId);

  return (
    <div className="glass-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ padding: '8px', background: 'rgba(56, 189, 248, 0.15)', borderRadius: '10px', color: 'var(--color-primary)' }}>
            <Send size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: '18px' }}>Telegram Bot Test</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-subtle)' }}>
              Send serverless messages directly to your Telegram channel
            </p>
          </div>
        </div>
        
        <span style={{ 
          fontSize: '12px', 
          padding: '4px 10px', 
          borderRadius: '12px', 
          background: isConfigured ? 'rgba(52, 211, 153, 0.15)' : 'rgba(251, 191, 36, 0.15)',
          color: isConfigured ? 'var(--color-success)' : 'var(--color-warning)',
          border: `1px solid ${isConfigured ? 'rgba(52, 211, 153, 0.3)' : 'rgba(251, 191, 36, 0.3)'}`
        }}>
          {isConfigured ? 'Credentials Ready' : 'Using Default/Env'}
        </span>
      </div>

      {/* Main Quick Action: Send Hello World Button */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.1) 0%, rgba(99, 102, 241, 0.1) 100%)',
        border: '1px dashed var(--border-glow)',
        borderRadius: 'var(--radius-md)',
        padding: '16px',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600', fontSize: '14px' }}>
            <Sparkles size={16} color="var(--color-primary)" />
            Quick Test Trigger
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Dispatches standard "Hello World from Artimus! 🚀" payload
          </p>
        </div>

        <button 
          className="btn btn-primary" 
          onClick={() => handleSendTelegram('Hello World from Artimus! 🚀')}
          disabled={loading}
        >
          {loading ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
          Send Hello World
        </button>
      </div>

      {/* Custom Message Field */}
      <div className="form-group">
        <label className="form-label">
          <span>Custom Message Payload</span>
          <span style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>Supports HTML tags</span>
        </label>
        <textarea
          className="form-textarea"
          value={customMessage}
          onChange={(e) => setCustomMessage(e.target.value)}
          placeholder="Enter test signal message..."
          rows={3}
        />
      </div>

      <button 
        className="btn btn-secondary" 
        style={{ width: '100%' }}
        onClick={() => handleSendTelegram(customMessage)}
        disabled={loading || !customMessage.trim()}
      >
        {loading ? (
          <>
            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
            Processing Request...
          </>
        ) : (
          <>
            <MessageSquare size={16} />
            Dispatch Custom Payload
          </>
        )}
      </button>

      {/* Result Alert Box */}
      {result && (
        <div className={`alert-box ${result.success ? 'alert-success' : 'alert-error'}`}>
          {result.success ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <div style={{ width: '100%' }}>
            <div style={{ fontWeight: '600', marginBottom: '4px' }}>
              {result.success ? 'Success!' : 'Dispatch Failed'}
            </div>
            <div style={{ fontSize: '13px', opacity: 0.9 }}>
              {result.success ? result.message : result.error}
            </div>
            {result.details && (
              <pre className="code-block" style={{ marginTop: '8px', fontSize: '11px', maxHeight: '120px' }}>
                {JSON.stringify(result.details, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
