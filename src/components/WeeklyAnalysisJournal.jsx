import React, { useState } from 'react';
import { Calendar, Link as LinkIcon, Target, ExternalLink, Database, PlusCircle, CheckCircle2 } from 'lucide-react';
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
  const [focusedField, setFocusedField] = useState(null);

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
        setTimeout(() => setSubmitStatus(null), 5000);
      }
    } catch (err) {
      console.error("Request Error:", err);
      setSubmitStatus({ type: 'error', message: 'An unexpected error occurred.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reusable dynamic input style
  const getInputStyle = (fieldName) => ({
    width: '100%',
    background: '#12131a',
    border: focusedField === fieldName ? '1px solid #34D399' : '1px solid rgba(255, 255, 255, 0.1)',
    boxShadow: focusedField === fieldName ? '0 0 0 3px rgba(52, 211, 153, 0.15)' : 'none',
    color: '#f8fafc',
    padding: '14px 16px',
    borderRadius: '12px',
    fontSize: '14px',
    outline: 'none',
    transition: 'all 0.2s ease-in-out',
    boxSizing: 'border-box'
  });

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
      gap: '24px',
      marginTop: '20px',
      fontFamily: "'Inter', sans-serif"
    }}>
      
      {/* ── Main Journal Form ────────────────────────────────────────────── */}
      <div style={{
        background: '#1c1e28',
        borderRadius: '20px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        padding: '32px',
        boxShadow: '0 10px 40px -10px rgba(0,0,0,0.5)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Subtle neon glow effect behind the form */}
        <div style={{
          position: 'absolute',
          top: '-100px',
          left: '-100px',
          width: '300px',
          height: '300px',
          background: 'radial-gradient(circle, rgba(52, 211, 153, 0.08) 0%, rgba(28, 30, 40, 0) 70%)',
          pointerEvents: 'none'
        }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px', position: 'relative' }}>
          <div style={{
            padding: '12px',
            borderRadius: '14px',
            background: 'rgba(52, 211, 153, 0.15)',
            color: '#34D399',
            boxShadow: '0 0 20px rgba(52, 211, 153, 0.2)'
          }}>
            <Calendar size={24} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: '#f8fafc', letterSpacing: '-0.02em' }}>
              Weekly Analysis Journal
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#94a3b8' }}>
              Log your technical setup and psychological readiness
            </p>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px', position: 'relative' }}>
          
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', fontSize: '13px', fontWeight: '600', color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <Calendar size={14} color="#34D399" />
              Week Of
            </label>
            <input 
              type="date" 
              name="week_of"
              value={formData.week_of}
              onChange={handleChange}
              onFocus={() => setFocusedField('week_of')}
              onBlur={() => setFocusedField(null)}
              style={{ ...getInputStyle('week_of'), colorScheme: 'dark' }}
              required
            />
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', fontSize: '13px', fontWeight: '600', color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <LinkIcon size={14} color="#34D399" />
              Screenshot Link
            </label>
            <input 
              type="url" 
              name="screenshot_url"
              value={formData.screenshot_url}
              onChange={handleChange}
              onFocus={() => setFocusedField('screenshot_url')}
              onBlur={() => setFocusedField(null)}
              style={getInputStyle('screenshot_url')}
              placeholder="https://prnt.sc/... or similar link"
            />
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', fontSize: '13px', fontWeight: '600', color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <Target size={14} color="#34D399" />
              What to look for next week
            </label>
            <textarea 
              name="next_week_focus"
              value={formData.next_week_focus}
              onChange={handleChange}
              onFocus={() => setFocusedField('next_week_focus')}
              onBlur={() => setFocusedField(null)}
              style={{ ...getInputStyle('next_week_focus'), resize: 'vertical', minHeight: '120px', lineHeight: '1.5' }}
              placeholder="Key levels to watch, fundamental drivers, potential setups..."
              required
            />
          </div>

          <button 
            type="submit" 
            disabled={isSubmitting}
            style={{ 
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              background: isSubmitting ? '#064e3b' : 'linear-gradient(135deg, #34D399 0%, #10B981 100%)', 
              color: isSubmitting ? '#a7f3d0' : '#022c22', 
              fontWeight: '700',
              fontSize: '15px',
              padding: '16px',
              borderRadius: '14px',
              border: 'none',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              marginTop: '8px',
              boxShadow: isSubmitting ? 'none' : '0 4px 14px rgba(16, 185, 129, 0.4)',
              transition: 'all 0.2s ease'
            }}
          >
            {isSubmitting ? (
              'Encrypting & Saving...'
            ) : (
              <>
                <Database size={18} /> 
                Submit Entry to Nhost
              </>
            )}
          </button>
          
          {submitStatus && (
            <div style={{ 
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '16px', 
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: '500',
              background: submitStatus.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(52, 211, 153, 0.1)',
              color: submitStatus.type === 'error' ? '#ef4444' : '#34D399',
              border: `1px solid ${submitStatus.type === 'error' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(52, 211, 153, 0.2)'}`,
              animation: 'fadeIn 0.3s ease-out'
            }}>
              {submitStatus.type === 'error' ? <Target size={18} /> : <CheckCircle2 size={18} />}
              {submitStatus.message}
            </div>
          )}
        </form>
      </div>

      {/* ── Sidebar / Conscious Journal Widget ───────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ 
          background: 'linear-gradient(145deg, #1e293b 0%, #0f172a 100%)',
          borderRadius: '20px',
          padding: '32px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 20px 40px -15px rgba(0,0,0,0.5)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Decorative backdrop */}
          <div style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '150px',
            height: '150px',
            background: 'radial-gradient(circle, rgba(148, 163, 184, 0.05) 0%, transparent 70%)',
            pointerEvents: 'none'
          }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
            <div style={{ 
              background: '#f8fafc', 
              color: '#0f172a', 
              width: '40px', 
              height: '40px', 
              borderRadius: '10px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              fontWeight: '800',
              fontSize: '20px',
              fontFamily: 'serif'
            }}>
              N
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#f8fafc' }}>
                Conscious Journal
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#94a3b8' }}>
                Syncs with Notion Workspace
              </p>
            </div>
          </div>
          
          <p style={{ fontSize: '14px', color: '#cbd5e1', marginBottom: '28px', lineHeight: '1.6' }}>
            Review your psychological state, trade execution discipline, and emotional triggers before analyzing the week.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.03)', padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
               <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#34D399', boxShadow: '0 0 8px #34D399' }} />
               <span style={{ fontSize: '13px', color: '#f8fafc', flex: 1 }}>Daily Growth Sync</span>
               <span style={{ fontSize: '11px', color: '#64748B' }}>03:10 AM</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.03)', padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
               <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#94a3b8' }} />
               <span style={{ fontSize: '13px', color: '#f8fafc', flex: 1 }}>Mindful Reflection</span>
               <span style={{ fontSize: '11px', color: '#64748B' }}>Yesterday</span>
            </div>
          </div>
          
          <a 
            href={NOTION_URL} 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ 
              display: 'flex', 
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              width: '100%', 
              background: '#ffffff',
              color: '#0f172a',
              fontWeight: '600',
              fontSize: '14px',
              padding: '14px',
              borderRadius: '12px',
              textDecoration: 'none',
              transition: 'all 0.2s ease',
              boxSizing: 'border-box'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = '#f1f5f9'}
            onMouseOut={(e) => e.currentTarget.style.background = '#ffffff'}
          >
            <ExternalLink size={16} /> Open in Notion
          </a>
        </div>
      </div>
    </div>
  );
}

