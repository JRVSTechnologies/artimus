import React, { useState } from 'react';
import { Send, CheckCircle2, AlertCircle } from 'lucide-react';

export default function SubmitSignalForm() {
  const [formData, setFormData] = useState({
    symbol: '',
    direction: 'Buy',
    entry_high: '',
    entry_low: '',
    sl: '',
    tp1: '',
    tp2: '',
    tp3: '',
    tp4: '',
    tp5: '',
    session: 'London',
    status: 'Open',
    source: 'Manual Entry',
    raw_signal_text: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatusMsg({ type: '', text: '' });

    try {
      // Auto-generate a signal name (e.g. "GOLD BUY")
      const generatedSignal = `${formData.symbol} ${formData.direction.toUpperCase()}`;
      
      const payload = {
        ...formData,
        signal: generatedSignal,
        signal_date: new Date().toISOString()
      };

      const response = await fetch('/.netlify/functions/submitSignal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit signal');
      }

      setStatusMsg({ type: 'success', text: `Signal ${generatedSignal} submitted successfully!` });
      
      // Reset numeric fields to keep it easy for next entry, but keep session/source
      setFormData(prev => ({
        ...prev,
        symbol: '',
        entry_high: '',
        entry_low: '',
        sl: '',
        tp1: '',
        tp2: '',
        tp3: '',
        tp4: '',
        tp5: '',
        raw_signal_text: ''
      }));

    } catch (err) {
      console.error(err);
      setStatusMsg({ type: 'error', text: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="analysis-dashboard">
      <div className="dashboard-header-premium">
        <h1>Submit New Signal</h1>
        <p>Manually enter a trading signal to track it in your database.</p>
      </div>

      <div className="chart-card-premium" style={{ maxWidth: '800px', margin: '0 auto' }}>
        {statusMsg.text && (
          <div style={{
            padding: '12px 16px',
            marginBottom: '20px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: statusMsg.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)',
            border: `1px solid ${statusMsg.type === 'success' ? '#10b981' : '#f43f5e'}`,
            color: statusMsg.type === 'success' ? '#10b981' : '#f43f5e'
          }}>
            {statusMsg.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span style={{ fontWeight: 600 }}>{statusMsg.text}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '13px', color: 'var(--text-subtle)', fontWeight: 600 }}>Symbol</label>
              <input 
                type="text" 
                name="symbol" 
                value={formData.symbol} 
                onChange={handleChange} 
                required
                placeholder="e.g. XAUUSD"
                style={{ padding: '10px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-card)', color: '#fff' }}
              />
            </div>
            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '13px', color: 'var(--text-subtle)', fontWeight: 600 }}>Direction</label>
              <select 
                name="direction" 
                value={formData.direction} 
                onChange={handleChange}
                style={{ padding: '10px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-card)', color: '#fff' }}
              >
                <option value="Buy" style={{ color: '#000' }}>Buy</option>
                <option value="Sell" style={{ color: '#000' }}>Sell</option>
              </select>
            </div>
          </div>

          <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '13px', color: 'var(--text-subtle)', fontWeight: 600 }}>Entry High</label>
              <input 
                type="number" step="any"
                name="entry_high" 
                value={formData.entry_high} 
                onChange={handleChange} 
                required
                style={{ padding: '10px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-card)', color: '#fff' }}
              />
            </div>
            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '13px', color: 'var(--text-subtle)', fontWeight: 600 }}>Entry Low</label>
              <input 
                type="number" step="any"
                name="entry_low" 
                value={formData.entry_low} 
                onChange={handleChange} 
                required
                style={{ padding: '10px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-card)', color: '#fff' }}
              />
            </div>
            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '13px', color: 'var(--text-subtle)', fontWeight: 600 }}>Stop Loss</label>
              <input 
                type="number" step="any"
                name="sl" 
                value={formData.sl} 
                onChange={handleChange} 
                required
                style={{ padding: '10px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-card)', color: '#fff' }}
              />
            </div>
          </div>

          <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
            {['tp1', 'tp2', 'tp3', 'tp4', 'tp5'].map((tp, idx) => (
              <div key={tp} className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '13px', color: 'var(--text-subtle)', fontWeight: 600 }}>TP {idx + 1}</label>
                <input 
                  type="number" step="any"
                  name={tp} 
                  value={formData[tp]} 
                  onChange={handleChange} 
                  style={{ padding: '10px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-card)', color: '#fff' }}
                />
              </div>
            ))}
          </div>

          <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '13px', color: 'var(--text-subtle)', fontWeight: 600 }}>Session</label>
              <select 
                name="session" 
                value={formData.session} 
                onChange={handleChange}
                style={{ padding: '10px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-card)', color: '#fff' }}
              >
                <option value="London Pre" style={{ color: '#000' }}>London Pre</option>
                <option value="London" style={{ color: '#000' }}>London</option>
                <option value="London-NY Overlap" style={{ color: '#000' }}>London-NY Overlap</option>
                <option value="NY Open" style={{ color: '#000' }}>NY Open</option>
                <option value="NY PM" style={{ color: '#000' }}>NY PM</option>
                <option value="Asian" style={{ color: '#000' }}>Asian</option>
              </select>
            </div>
            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '13px', color: 'var(--text-subtle)', fontWeight: 600 }}>Status</label>
              <select 
                name="status" 
                value={formData.status} 
                onChange={handleChange}
                style={{ padding: '10px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-card)', color: '#fff' }}
              >
                <option value="Open" style={{ color: '#000' }}>Open</option>
                <option value="TP Hit" style={{ color: '#000' }}>TP Hit</option>
                <option value="SL Hit" style={{ color: '#000' }}>SL Hit</option>
                <option value="Breakeven" style={{ color: '#000' }}>Breakeven</option>
              </select>
            </div>
            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '13px', color: 'var(--text-subtle)', fontWeight: 600 }}>Source</label>
              <input 
                type="text"
                name="source" 
                value={formData.source} 
                onChange={handleChange} 
                style={{ padding: '10px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-card)', color: '#fff' }}
              />
            </div>
          </div>

          <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '13px', color: 'var(--text-subtle)', fontWeight: 600 }}>Raw Signal Text (Optional)</label>
            <textarea 
              name="raw_signal_text" 
              value={formData.raw_signal_text} 
              onChange={handleChange}
              rows={4}
              placeholder="Paste raw signal text here..."
              style={{ padding: '10px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-card)', color: '#fff', resize: 'vertical' }}
            />
          </div>

          <button 
            type="submit" 
            disabled={isSubmitting}
            style={{
              padding: '12px 24px',
              backgroundColor: '#38bdf8',
              color: '#0f172a',
              fontWeight: 'bold',
              border: 'none',
              borderRadius: '6px',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              opacity: isSubmitting ? 0.7 : 1,
              marginTop: '10px'
            }}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Signal Data'}
            {!isSubmitting && <Send size={18} />}
          </button>

        </form>
      </div>
    </div>
  );
}
