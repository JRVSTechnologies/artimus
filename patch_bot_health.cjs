const fs = require('fs');

let content = fs.readFileSync('src/components/BotHealthStatus.jsx', 'utf8');

content = content.replace(/<<<<<<< HEAD\n      purpose: 'Core signal processing, telemetry orchestration, and webhook management hub.',\n      skillset: \['Signal Parsing', 'Webhook Routing', 'Task Orchestration'\],\n=======\n>>>>>>> origin\/main/g, "      purpose: 'Core signal processing, telemetry orchestration, and webhook management hub.',\n      skillset: ['Signal Parsing', 'Webhook Routing', 'Task Orchestration'],");

content = content.replace(/<<<<<<< HEAD\n      purpose: 'Monitors real-time market data, executes price analysis, and manages market alerts.',\n      skillset: \['Price Tracking', 'Algorithmic Evaluation', 'Statistical Analysis'\],\n=======\n>>>>>>> origin\/main/g, "      purpose: 'Monitors real-time market data, executes price analysis, and manages market alerts.',\n      skillset: ['Price Tracking', 'Algorithmic Evaluation', 'Statistical Analysis'],");

content = content.replace(/<<<<<<< HEAD\n            <div style={{ marginBottom: '24px', padding: '16px', background: 'rgba\(255, 255, 255, 0\.02\)', borderRadius: '12px', border: '1px solid var\(--border-card\)' }}>[\s\S]*?<\/div>\n\n=======\n>>>>>>> origin\/main/g, `            <div style={{ marginBottom: '24px', padding: '16px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '12px', border: '1px solid var(--border-card)' }}>
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '4px' }}>Primary Purpose</div>
                <div style={{ fontSize: '14px', color: 'var(--text-main)', lineHeight: '1.5' }}>{bot.purpose}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '6px' }}>Core Skillset</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {bot.skillset.map((skill, idx) => (
                    <span key={idx} style={{ padding: '4px 10px', background: \`rgba(\${bot.color === '#38BDF8' ? '56, 189, 248' : '16, 185, 129'}, 0.1)\`, color: bot.color, fontSize: '12px', borderRadius: '999px', border: \`1px solid rgba(\${bot.color === '#38BDF8' ? '56, 189, 248' : '16, 185, 129'}, 0.2)\` }}>
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            </div>`);

fs.writeFileSync('src/components/BotHealthStatus.jsx', content);
