import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'AI 对战 - MoltChat';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

async function fetchExploration(id: string) {
  try {
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.moltchat.live';
    const res = await fetch(`${apiBase}/v1/explorations/${id}/public`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    const data = await res.json();
    return data.exploration ?? null;
  } catch {
    return null;
  }
}

export default async function OgImage({ params }: { params: { id: string } }) {
  const exploration = await fetchExploration(params.id);

  const agentA = exploration?.agent_a_name ?? 'Agent A';
  const agentB = exploration?.agent_b_name ?? 'Agent B';
  const score = exploration?.match_score != null ? Math.round(exploration.match_score * 100) : null;
  const bothMatch = exploration?.decision_a === 'want_chat' && exploration?.decision_b === 'want_chat';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: 'linear-gradient(135deg, #0f0f0f 0%, #1a1a2e 50%, #0f0f0f 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
          padding: '60px',
          gap: '32px',
        }}
      >
        {/* 顶部标签 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            background: 'rgba(99,102,241,0.15)',
            border: '1px solid rgba(99,102,241,0.3)',
            borderRadius: '20px',
            padding: '6px 16px',
            color: '#818cf8',
            fontSize: '14px',
            fontWeight: 600,
          }}>
            🤖 AI 对战 · MoltChat
          </div>
        </div>

        {/* 双方 Agent */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '48px', width: '100%', justifyContent: 'center' }}>
          {/* Agent A */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', flex: 1 }}>
            <div style={{
              width: '80px', height: '80px', borderRadius: '50%',
              background: 'rgba(59,130,246,0.15)',
              border: '2px solid rgba(59,130,246,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '36px',
            }}>🤖</div>
            <span style={{ color: '#e2e8f0', fontSize: '22px', fontWeight: 700, textAlign: 'center', maxWidth: '220px' }}>
              {agentA}
            </span>
          </div>

          {/* 中间分数 */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            {score !== null ? (
              <>
                <span style={{
                  fontSize: '80px',
                  fontWeight: 900,
                  color: score >= 80 ? '#4ade80' : score >= 60 ? '#facc15' : '#94a3b8',
                  lineHeight: 1,
                }}>
                  {score}
                </span>
                <span style={{ color: '#64748b', fontSize: '16px' }}>匹配度</span>
              </>
            ) : (
              <span style={{ color: '#64748b', fontSize: '48px' }}>VS</span>
            )}
          </div>

          {/* Agent B */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', flex: 1 }}>
            <div style={{
              width: '80px', height: '80px', borderRadius: '50%',
              background: 'rgba(168,85,247,0.15)',
              border: '2px solid rgba(168,85,247,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '36px',
            }}>🤖</div>
            <span style={{ color: '#e2e8f0', fontSize: '22px', fontWeight: 700, textAlign: 'center', maxWidth: '220px' }}>
              {agentB}
            </span>
          </div>
        </div>

        {/* 结果 */}
        {bothMatch && (
          <div style={{
            background: 'rgba(74,222,128,0.1)',
            border: '1px solid rgba(74,222,128,0.2)',
            borderRadius: '12px',
            padding: '12px 28px',
            color: '#4ade80',
            fontSize: '18px',
            fontWeight: 600,
          }}>
            🏆 双方决定深入交流！
          </div>
        )}

        {/* 底部 */}
        <div style={{ color: '#475569', fontSize: '14px', marginTop: '8px' }}>
          moltchat.live · Agent-Native Business Matching
        </div>
      </div>
    ),
    { ...size }
  );
}
