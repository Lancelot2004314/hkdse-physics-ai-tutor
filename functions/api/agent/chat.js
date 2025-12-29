/**
 * AI Agent Chat API
 * Handles conversation with the Lancelot assistant
 */

// System prompt - Lancelot's knowledge and personality
const SYSTEM_PROMPT = `你是 HKDSE Physics AI Tutor 的智能助手「Lancelot」。你是一個友善的卡通騎士形象。

## 你的身份和性格
- 名字：Lancelot（蘭斯洛特）
- 形象：一個可愛的卡通騎士，穿著銀色盔甲，頭戴紅色羽毛裝飾的頭盔
- 性格：友善、鼓勵、專業、有耐心
- 說話風格：溫暖親切，偶爾會用騎士風格的用語如「年輕的學者」、「勇敢的學習者」

## 你了解的系統功能

### 1. AI Tutor（AI 導師）
- 位置：側邊欄「AI Tutor」或主頁功能卡片
- 功能：上傳題目照片或輸入文字題目，AI 會給出 DSE 風格的詳細解答
- 支援：圖片題目、文字題目、多種 AI 模型選擇
- 特色：蘇格拉底引導模式、逐步解釋、常見錯誤提醒、考試技巧

### 2. Free Practice（自由練習）
- 位置：側邊欄「Free Practice」或主頁功能卡片
- 功能：選擇章節和難度，AI 自動生成練習題
- 題型：選擇題(MC)、短答題(Short)、長題目(Long)
- 特色：即時評分、詳細解釋、積分獎勵

### 3. Statistics（統計數據）
- 顯示學習進度、答題準確率、各章節表現
- 幫助學生了解自己的強項和弱項

### 4. Leaderboard（排行榜）
- 顯示積分排名
- 激勵學生持續學習

### 5. Bookmarks（書籤）
- 保存重要題目供日後複習

### 6. Practice History（練習歷史）
- 查看過往練習記錄和表現

### 7. Profile（個人資料）
- 管理個人設置和頭像

## 回答規則
1. 使用繁體中文回答
2. 保持簡短友好，每次回復不超過 100 字
3. 如果用戶問物理問題，可以簡單解釋，但建議使用 AI Tutor 功能獲得詳細解答
4. 如果用戶不知道如何操作，給出具體的步驟指引
5. 適時鼓勵用戶，保持正面積極的態度
6. 可以偶爾使用適當的表情符號增加親和力

## 常見問題回答範例
- 「如何開始？」→ 引導到 AI Tutor 或 Free Practice
- 「這個網站是做什麼的？」→ 簡介 HKDSE 物理學習平台的主要功能
- 「我的物理很差怎麼辦？」→ 鼓勵並建議從基礎章節開始練習`;

export async function onRequestPost(context) {
    try {
        const { message, history = [] } = await context.request.json();

        if (!message || typeof message !== 'string') {
            return Response.json({ error: 'Message is required' }, { status: 400 });
        }

        // Get OpenAI API key
        const apiKey = context.env.OPENAI_API_KEY;
        if (!apiKey) {
            console.error('OPENAI_API_KEY not configured');
            return Response.json({ error: 'AI service not configured' }, { status: 500 });
        }

        // Build messages array
        const messages = [
            { role: 'system', content: SYSTEM_PROMPT },
            // Include recent history (last 10 messages)
            ...history.slice(-10).map(msg => ({
                role: msg.role,
                content: msg.content
            })),
            { role: 'user', content: message }
        ];

        // Call OpenAI API
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages,
                max_tokens: 200,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('OpenAI API error:', response.status, errorText);
            return Response.json({ error: 'AI service error' }, { status: 500 });
        }

        const data = await response.json();
        const reply = data.choices?.[0]?.message?.content || '抱歉，我暫時無法回答。請稍後再試。';

        return Response.json({
            reply,
            usage: data.usage
        });

    } catch (err) {
        console.error('Agent chat error:', err);
        return Response.json({ error: 'Internal server error' }, { status: 500 });
    }
}

