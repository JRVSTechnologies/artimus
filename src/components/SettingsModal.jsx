import React, { useState } from 'react';
import { X, Save, Key, MessageCircle, Info } from 'lucide-react';

export default function SettingsModal({ botConfig, onSaveConfig, onClose }) {
  const [botToken, setBotToken] = useState(botConfig.botToken || '');
  const [chatId, setChatId] = useState(botConfig.chatId || '');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSaveConfig({ botToken, chatId });
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Key size={22} color="var(--color-primary)" />
            <h2 style={{ fontSize: '20px' }}>Telegram & Netlify Settings</h2>
          </div>
          <button 
            onClick={onClose} 
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">
              <span>Telegram Bot Token</span>
              <span style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>From @BotFather</span>
            </label>
            <input
              type="password"
              className="form-input"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              placeholder="e.g. 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              <span>Telegram Chat / Channel ID</span>
              <span style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>User ID or @channelname</span>
            </label>
            <input
              type="text"
              className="form-input"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder="e.g. 987654321 or -100123456789"
            />
          </div>

          <div style={{
            background: 'rgba(56, 189, 248, 0.08)',
            border: '1px solid rgba(56, 189, 248, 0.2)',
            borderRadius: 'var(--radius-md)',
            padding: '12px',
            marginBottom: '20px',
            fontSize: '12px',
            color: 'var(--text-muted)',
            display: 'flex',
            gap: '8px'
          }}>
            <Info size={18} color="var(--color-primary)" style={{ flexShrink: 0 }} />
            <div>
              <strong>Netlify Environment Variables Note:</strong>
              <p style={{ marginTop: '2px' }}>
                When deployed on Netlify, you can also add <code>TELEGRAM_BOT_TOKEN</code> and <code>TELEGRAM_CHAT_ID</code> in 
                Netlify Site Settings &gt; Environment Variables.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              <Save size={16} /> Save Credentials
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
