import React, { useState } from 'react';
import { Calendar, Link as LinkIcon, Target, Send, ExternalLink, Database } from 'lucide-react';
import { useNhostClient } from '@nhost/react';

export default function WeeklyAnalysisJournal() {
  const nhost = useNhostClient();
  const [formData, setFormData] = useState({
    week_of: new Date().toISOString().split('T')[0],
    screenshot_url: '',
    next_week_focus: ''
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);

  const NOTION_URL = "https://app.notion.com/p/1de3a8304ec942f5bb00ea59bb2378f4?v=c8f352476cc64a159bbbc66ee8af115f&source=copy_link";

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus(null);
    
    // Nhost GraphQL Mutation
    const mutation = `
      mutation InsertJournal($week_of: date!, $screenshot_url: String, $next_week_focus: String) {
        insert_weekly_analysis_journals_one(object: {
          week_of: $week_of,
          screenshot_url: $screenshot_url,
          next_week_focus: $next_week_focus
        }) {
          id
        }
      }
    `;

    try {
      const { data, error } = await nhost.graphql.request(mutation, formData);
      
      if (error) {
        console.error("GraphQL Error:", error);
        setSubmitStatus({ type: 'error', message: error[0]?.message || 'Failed to save entry.' });
      } else {
        setSubmitStatus({ type: 'success', message: 'Journal entry saved successfully!' });
        setFormData({
          week_of: new Date().toISOString().split('T')[0],
          screenshot_url: '',
          next_week_focus: ''
        });
      }
    } catch (err) {
      console.error("Request Error:", err);
      setSubmitStatus({ type: 'error', message: 'An unexpected error occurred.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="dashboard-grid" style={{ gridTemplateColumns: '2fr 1fr' }}>
      {/* Main Journal Form */}
      <div className="card">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <Calendar size={20} color="#10b981" />
          Weekly Analysis Journal
        </h2>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="form-group">
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--text-subtle)' }}>
              Week Of
            </label>
            <input 
              type="date" 
              name="week_of"
              value={formData.week_of}
              onChange={handleChange}
              className="input-field"
              required
            />
          </div>

          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', fontSize: '13px', color: 'var(--text-subtle)' }}>
              <LinkIcon size={14} />
              Screenshot Link
            </label>
            <input 
              type="url" 
              name="screenshot_url"
              value={formData.screenshot_url}
              onChange={handleChange}
              className="input-field"
              placeholder="https://prnt.sc/... or similar link"
            />
          </div>

          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', fontSize: '13px', color: 'var(--text-subtle)' }}>
              <Target size={14} />
              What to look for next week
            </label>
            <textarea 
              name="next_week_focus"
              value={formData.next_week_focus}
              onChange={handleChange}
              className="input-field"
              rows={6}
              placeholder="Key levels to watch, fundamental drivers, potential setups..."
              required
            />
          </div>

          <button 
            type="submit" 
            className="btn" 
            style={{ 
              background: '#10b981', 
              color: '#000', 
              fontWeight: '600', 
              padding: '12px',
              marginTop: '10px'
            }}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving...' : (
              <>
                <Database size={16} /> Save to Nhost Database
              </>
            )}
          </button>
          
          {submitStatus && (
            <div style={{ 
              marginTop: '10px', 
              padding: '10px', 
              borderRadius: '4px',
              fontSize: '13px',
              background: submitStatus.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
              color: submitStatus.type === 'error' ? '#ef4444' : '#10b981',
              border: `1px solid ${submitStatus.type === 'error' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`
            }}>
              {submitStatus.message}
            </div>
          )}
        </form>
      </div>

      {/* Sidebar / Resources */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div className="card" style={{ background: 'linear-gradient(145deg, rgba(30,41,59,0.8) 0%, rgba(15,23,42,0.9) 100%)' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', fontSize: '16px' }}>
            <span style={{ fontSize: '20px' }}>🧠</span> Conscious Journal
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-subtle)', marginBottom: '20px', lineHeight: '1.5' }}>
            Review your psychological state, trade execution discipline, and emotional triggers before analyzing the week.
          </p>
          
          <a 
            href={NOTION_URL} 
            target="_blank" 
            rel="noopener noreferrer"
            className="btn"
            style={{ 
              display: 'flex', 
              width: '100%', 
              justifyContent: 'center',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#f8fafc'
            }}
          >
            <ExternalLink size={16} /> Open in Notion
          </a>
        </div>
      </div>
    </div>
  );
}
