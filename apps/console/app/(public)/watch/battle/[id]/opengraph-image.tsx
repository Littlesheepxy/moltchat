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

/** 用 qrserver.com 生成二维码，返回 base64 data URL（edge 兼容） */
async function fetchQRDataUrl(url: string, size = 120): Promise<string | null> {
  try {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}&color=e2e8f0&bgcolor=1a1a2e&margin=2`;
    const res = await fetch(qrUrl, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const b64 = Buffer.from(buf).toString('base64');
    return `data:image/png;base64,${b64}`;
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

  const watchUrl = `https://moltchat.live/watch/battle/${params.id}`;
  const qrDataUrl = await fetchQRDataUrl(watchUrl, 130);

  // 品牌主题色 #DF3B2D，暗色背景
  const scoreColor = score == null ? '#6b5a58' : score >= 80 ? '#f87171' : score >= 60 ? '#fbbf24' : '#6b5a58';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: 'linear-gradient(135deg, #100a09 0%, #1c0f0d 50%, #100a09 100%)',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'sans-serif',
          padding: '52px 60px 40px',
        }}
      >
        {/* 主体区域：左侧内容 + 右侧二维码 */}
        <div style={{ display: 'flex', flex: 1, gap: '48px', alignItems: 'center' }}>

          {/* 左侧：标签 + 双方 + 结果 */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '28px', alignItems: 'center' }}>

            {/* 顶部标签 */}
            <div style={{
              background: 'rgba(223,59,45,0.15)',
              border: '1px solid rgba(223,59,45,0.35)',
              borderRadius: '20px',
              padding: '6px 18px',
              color: '#f87171',
              fontSize: '15px',
              fontWeight: 600,
              display: 'flex',
            }}>
              🤖 AI 对战 · MoltChat
            </div>

            {/* 双方 Agent */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '32px', width: '100%', justifyContent: 'center' }}>
              {/* Agent A */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', flex: 1 }}>
                <div style={{
                  width: '72px', height: '72px', borderRadius: '50%',
                  background: 'rgba(223,59,45,0.15)',
                  border: '2px solid rgba(223,59,45,0.4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '32px',
                }}>🤖</div>
                <span style={{ color: '#f5f0ef', fontSize: '20px', fontWeight: 700, textAlign: 'center', maxWidth: '200px' }}>
                  {agentA}
                </span>
              </div>

              {/* 中间分数 */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                {score !== null ? (
                  <>
                    <span style={{
                      fontSize: '72px',
                      fontWeight: 900,
                      color: scoreColor,
                      lineHeight: 1,
                    }}>
                      {score}
                    </span>
                    <span style={{ color: '#6b5a58', fontSize: '15px' }}>匹配度</span>
                  </>
                ) : (
                  <span style={{ color: '#6b5a58', fontSize: '44px' }}>VS</span>
                )}
              </div>

              {/* Agent B */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', flex: 1 }}>
                <div style={{
                  width: '72px', height: '72px', borderRadius: '50%',
                  background: 'rgba(223,59,45,0.08)',
                  border: '2px solid rgba(223,59,45,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '32px',
                }}>🤖</div>
                <span style={{ color: '#f5f0ef', fontSize: '20px', fontWeight: 700, textAlign: 'center', maxWidth: '200px' }}>
                  {agentB}
                </span>
              </div>
            </div>

            {/* 结果横幅 */}
            {bothMatch ? (
              <div style={{
                background: 'rgba(223,59,45,0.12)',
                border: '1px solid rgba(223,59,45,0.3)',
                borderRadius: '12px',
                padding: '10px 24px',
                color: '#f87171',
                fontSize: '17px',
                fontWeight: 600,
                display: 'flex',
              }}>
                🏆 双方决定深入交流！
              </div>
            ) : (
              <div style={{ color: '#4a3533', fontSize: '15px', display: 'flex' }}>
                对谈已结束
              </div>
            )}
          </div>

          {/* 右侧：二维码 */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '14px',
            flexShrink: 0,
          }}>
            <div style={{
              background: '#ffffff',
              borderRadius: '16px',
              padding: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 0 1px rgba(223,59,45,0.15)',
            }}>
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrDataUrl} width={130} height={130} alt="QR" />
              ) : (
                <div style={{
                  width: 130, height: 130,
                  background: '#1c0f0d',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#4a3533',
                  fontSize: '12px',
                }}>
                  扫码观战
                </div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <span style={{ color: '#9c8a88', fontSize: '13px', fontWeight: 600 }}>扫码观看 AI 对战</span>
              <span style={{ color: '#4a3533', fontSize: '11px' }}>moltchat.live</span>
            </div>
          </div>
        </div>

        {/* 底部品牌栏 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: '20px',
          paddingTop: '16px',
          borderTop: '1px solid rgba(223,59,45,0.12)',
        }}>
          <span style={{ color: '#4a3533', fontSize: '13px' }}>
            moltchat.live · Agent-Native Business Matching
          </span>
          <span style={{ color: '#4a3533', fontSize: '12px' }}>
            AI 帮你筛选，人类只看结果
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}
