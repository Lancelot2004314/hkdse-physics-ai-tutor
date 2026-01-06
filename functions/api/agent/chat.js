/**
 * AI Agent Chat API
 * Handles conversation with the Lancelot assistant
 * Priority: Cloudflare Workers AI (global) > Gemini > OpenAI
 */

// System prompts by language
const SYSTEM_PROMPTS = {
    'en': `You are Lancelot, the friendly AI assistant for HKDSE Physics AI Tutor. You are a cute cartoon knight character.

## Your Identity
- Name: Lancelot
- Appearance: A friendly cartoon knight with silver armor and a red plume helmet
- Personality: Friendly, encouraging, professional, patient
- Speaking style: Warm and approachable, occasionally using knight-style phrases like "young scholar" or "brave learner"

## System Features You Know
1. **Learn** - Duolingo-style skill tree with bite-sized lessons. Users progress through physics topics by completing lessons and earning XP. Features hearts system (lose hearts on wrong answers), streaks, and spaced repetition.
2. **Quests** - Daily quests that reward gems! Complete tasks like "Earn 10 XP", "Complete 3 Lessons", or "Get a Perfect Lesson". Quests reset at midnight (HKT). Gems can be used in the Shop.
3. **Shop** - Spend gems on items like heart refills, streak freezes, and cosmetics.
4. **AI Tutor** - Upload question photos or enter text for DSE-style step-by-step explanations
5. **Free Practice** - Select chapters and difficulty, AI generates practice questions
6. **Leaderboard** - Weekly XP rankings, compete with other learners
7. **Statistics** - View learning progress and performance
8. **Bookmarks** - Save questions for later review

## Response Rules
1. Reply in English
2. Keep responses short and friendly (under 100 words)
3. For physics questions, give brief explanations and suggest using AI Tutor for detailed answers
4. Guide users with specific steps when they're unsure how to proceed
5. Encourage users to complete daily quests and maintain their streaks!
6. Be encouraging and positive
7. Use appropriate emojis occasionally`,

    'zh-HK': `你是 HKDSE Physics AI Tutor 的智能助手「Lancelot」。你是一個友善的卡通騎士形象。

## 你的身份和性格
- 名字：Lancelot（蘭斯洛特）
- 形象：一個可愛的卡通騎士，穿著銀色盔甲，頭戴紅色羽毛裝飾的頭盔
- 性格：友善、鼓勵、專業、有耐心
- 說話風格：溫暖親切，偶爾會用騎士風格的用語如「年輕的學者」、「勇敢的學習者」

## 你了解的系統功能
1. **Learn 學習** - Duolingo 風格的技能樹，小課程學習物理。完成課程獲得 XP，有愛心系統（答錯會扣愛心）、連續天數和間隔重複功能
2. **Quests 每日任務** - 完成任務獲得寶石💎！例如「獲得 10 XP」、「完成 3 個課程」、「完美通過課程」。任務在午夜（香港時間）重置
3. **Shop 商店** - 用寶石購買愛心補充、連續天數凍結等道具
4. **AI Tutor** - 上傳題目照片或輸入文字題目，AI 會給出 DSE 風格的詳細解答
5. **Free Practice** - 選擇章節和難度，AI 自動生成練習題
6. **Leaderboard** - 每週 XP 排名，與其他學習者競爭
7. **Statistics** - 查看學習進度和表現
8. **Bookmarks** - 保存題目供日後複習

## 回答規則
1. 使用繁體中文回答
2. 保持簡短友好，每次回復不超過 100 字
3. 如果用戶問物理問題，可以簡單解釋，但建議使用 AI Tutor 功能獲得詳細解答
4. 如果用戶不知道如何操作，給出具體的步驟指引
5. 鼓勵用戶完成每日任務和維持連續天數！
6. 適時鼓勵用戶，保持正面積極的態度
7. 可以偶爾使用適當的表情符號增加親和力`,

    'zh-CN': `你是 HKDSE Physics AI Tutor 的智能助手「Lancelot」。你是一个友善的卡通骑士形象。

## 你的身份和性格
- 名字：Lancelot（兰斯洛特）
- 形象：一个可爱的卡通骑士，穿着银色盔甲，头戴红色羽毛装饰的头盔
- 性格：友善、鼓励、专业、有耐心
- 说话风格：温暖亲切，偶尔会用骑士风格的用语如「年轻的学者」、「勇敢的学习者」

## 你了解的系统功能
1. **Learn 学习** - Duolingo 风格的技能树，小课程学习物理。完成课程获得 XP，有爱心系统（答错会扣爱心）、连续天数和间隔重复功能
2. **Quests 每日任务** - 完成任务获得宝石💎！例如「获得 10 XP」、「完成 3 个课程」、「完美通过课程」。任务在午夜（香港时间）重置
3. **Shop 商店** - 用宝石购买爱心补充、连续天数冻结等道具
4. **AI Tutor** - 上传题目照片或输入文字题目，AI 会给出 DSE 风格的详细解答
5. **Free Practice** - 选择章节和难度，AI 自动生成练习题
6. **Leaderboard** - 每周 XP 排名，与其他学习者竞争
7. **Statistics** - 查看学习进度和表现
8. **Bookmarks** - 保存题目供日后复习

## 回答规则
1. 使用简体中文回答
2. 保持简短友好，每次回复不超过 100 字
3. 如果用户问物理问题，可以简单解释，但建议使用 AI Tutor 功能获得详细解答
4. 如果用户不知道如何操作，给出具体的步骤指引
5. 鼓励用户完成每日任务和维持连续天数！
6. 适时鼓励用户，保持正面积极的态度
7. 可以偶尔使用适当的表情符号增加亲和力`
};

// Get system prompt based on language
function getSystemPrompt(language) {
    return SYSTEM_PROMPTS[language] || SYSTEM_PROMPTS['en'];
}

export async function onRequestPost(context) {
    try {
        const { message, history = [], language = 'en' } = await context.request.json();

        if (!message || typeof message !== 'string') {
            return Response.json({ error: 'Message is required' }, { status: 400 });
        }

        // Get language-specific system prompt
        const systemPrompt = getSystemPrompt(language);

        let reply;
        let usage;
        let provider = 'none';

        // Priority 1: Cloudflare Workers AI (globally available, no VPN needed!)
        if (context.env.AI) {
            const result = await callCloudflareAI(context.env.AI, message, history, systemPrompt, language);
            if (result.success) {
                reply = result.reply;
                usage = result.usage;
                provider = 'cloudflare';
            } else {
                console.warn('Cloudflare AI failed, trying Gemini:', result.error);
            }
        }

        // Priority 2: Google Gemini (fallback)
        const geminiKey = context.env.GEMINI_API_KEY;
        if (!reply && geminiKey) {
            const result = await callGemini(geminiKey, message, history, systemPrompt, language);
            if (result.success) {
                reply = result.reply;
                usage = result.usage;
                provider = 'gemini';
            } else {
                console.warn('Gemini failed, trying OpenAI:', result.error);
            }
        }

        // Priority 3: OpenAI (last resort)
        const openaiKey = context.env.OPENAI_API_KEY;
        if (!reply && openaiKey) {
            const result = await callOpenAI(openaiKey, message, history, systemPrompt);
            if (result.success) {
                reply = result.reply;
                usage = result.usage;
                provider = 'openai';
            } else {
                console.error('OpenAI also failed:', result.error);
            }
        }

        if (!reply) {
            return Response.json({ error: 'AI service unavailable' }, { status: 500 });
        }

        return Response.json({ reply, usage, provider });

    } catch (err) {
        console.error('Agent chat error:', err);
        return Response.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// Call Cloudflare Workers AI (globally available, no VPN required!)
async function callCloudflareAI(ai, message, history, systemPrompt, language) {
    try {
        // Build messages array
        const messages = [
            { role: 'system', content: systemPrompt },
            ...history.slice(-10).map(msg => ({
                role: msg.role === 'user' ? 'user' : 'assistant',
                content: msg.content
            })),
            { role: 'user', content: message }
        ];

        // Try multiple models for better compatibility
        let result;
        const models = [
            '@cf/meta/llama-3.1-8b-instruct',  // Latest Llama, good multilingual
            '@cf/meta/llama-2-7b-chat-int8',   // Fallback
        ];
        
        for (const model of models) {
            try {
                result = await ai.run(model, { messages, max_tokens: 256 });
                if (result && result.response) {
                    console.log('Used model:', model);
                    break;
                }
            } catch (modelErr) {
                console.warn(`Model ${model} failed:`, modelErr.message);
                continue;
            }
        }
        
        if (!result) {
            throw new Error('All models failed');
        }

        const reply = result.response || '';

        return {
            success: true,
            reply: reply.trim() || (language === 'en' 
                ? 'Sorry, I cannot answer right now. Please try again later.' 
                : '抱歉，我暫時無法回答。請稍後再試。'),
            usage: { provider: 'cloudflare-ai' }
        };

    } catch (err) {
        console.error('Cloudflare AI call failed:', err);
        return { success: false, error: err.message };
    }
}

// Call Google Gemini API
async function callGemini(apiKey, message, history, systemPrompt, language) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    // Language-specific labels
    const labels = language === 'en' 
        ? { user: 'User', assistant: 'Lancelot', historyLabel: 'Conversation history:' }
        : { user: '用戶', assistant: 'Lancelot', historyLabel: '對話歷史：' };

    // Build conversation history for Gemini
    const parts = [
        { text: systemPrompt + '\n\n' + labels.historyLabel }
    ];

    // Add history
    for (const msg of history.slice(-10)) {
        parts.push({ text: `${msg.role === 'user' ? labels.user : labels.assistant}: ${msg.content}` });
    }

    // Add current message
    parts.push({ text: `${labels.user}: ${message}\n\n${labels.assistant}:` });

    const requestBody = {
        contents: [{ parts }],
        generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 200,
        }
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Gemini API error:', response.status, errorText);
            return { success: false, error: errorText };
        }

        const data = await response.json();
        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        return {
            success: true,
            reply: reply.trim() || (language === 'en' ? 'Sorry, I cannot answer right now. Please try again later.' : '抱歉，我暫時無法回答。請稍後再試。'),
            usage: data.usageMetadata
        };

    } catch (err) {
        console.error('Gemini call failed:', err);
        return { success: false, error: err.message };
    }
}

// Call OpenAI API (fallback)
async function callOpenAI(apiKey, message, history, systemPrompt) {
    const messages = [
        { role: 'system', content: systemPrompt },
        ...history.slice(-10).map(msg => ({
            role: msg.role,
            content: msg.content
        })),
        { role: 'user', content: message }
    ];

    try {
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
            return { success: false, error: errorText };
        }

        const data = await response.json();
        const reply = data.choices?.[0]?.message?.content || '';

        return {
            success: true,
            reply: reply || '抱歉，我暫時無法回答。請稍後再試。',
            usage: data.usage
        };

    } catch (err) {
        console.error('OpenAI call failed:', err);
        return { success: false, error: err.message };
    }
}

