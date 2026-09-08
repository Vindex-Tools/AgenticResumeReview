/* Direct, user-key API adapters. The same review instructions feed every provider. */
(function (root) {
    'use strict';

    const providers = Object.freeze({
        gemini: { name: 'Gemini', company: 'Google', keyUrl: 'https://aistudio.google.com/app/apikey', baseUrl: 'https://generativelanguage.googleapis.com/v1beta' },
        openai: { name: 'OpenAI', company: 'OpenAI', keyUrl: 'https://platform.openai.com/api-keys', baseUrl: 'https://api.openai.com/v1' },
        anthropic: { name: 'Claude', company: 'Anthropic', keyUrl: 'https://platform.claude.com/settings/keys', baseUrl: 'https://api.anthropic.com/v1' }
    });

    function config(provider) {
        if (!Object.hasOwn(providers, provider)) throw new Error('Choose an AI provider first.');
        return providers[provider];
    }

    function headers(provider, key) {
        config(provider);
        if (!key?.trim()) throw new Error('Enter an API key first.');
        const common = { Accept: 'application/json' };
        if (provider === 'gemini') return { ...common, 'x-goog-api-key': key };
        if (provider === 'openai') return { ...common, Authorization: `Bearer ${key}` };
        return { ...common, 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' };
    }

    async function request(provider, key, path, { body, signal, fetchImpl = globalThis.fetch } = {}) {
        const info = config(provider);
        const authHeaders = headers(provider, key);
        let response;
        try {
            response = await fetchImpl(info.baseUrl + path, {
                method: body ? 'POST' : 'GET',
                headers: { ...authHeaders, ...(body ? { 'Content-Type': 'application/json' } : {}) },
                ...(body ? { body: JSON.stringify(body) } : {}),
                signal,
                credentials: 'omit',
                redirect: 'error'
            });
        } catch (error) {
            if (signal?.aborted || error.name === 'AbortError') throw error;
            throw new Error(`Could not reach ${info.name}. Check your connection and whether your browser or network blocks direct API requests.`);
        }
        let data;
        try { data = await response.json(); } catch {
            throw new Error(`${info.name} returned an unreadable response (HTTP ${response.status}). Try again.`);
        }
        if (!data || typeof data !== 'object') throw new Error(`${info.name} returned an invalid response. Try again.`);
        if (!response.ok || data.error) {
            const message = typeof data.error?.message === 'string' ? data.error.message : `Request failed (HTTP ${response.status}).`;
            // Providers sometimes repeat credentials in authentication error text.
            const safeMessage = message.split(key).join('[redacted key]');
            const error = new Error(`${info.name}: ${safeMessage}`);
            error.status = response.status;
            if (provider === 'gemini' && [400, 403, 404, 410].includes(response.status) && /(?:model[\s\S]*(?:no longer available|not available|not found|not supported|deprecated|retired)|(?:not found|not supported)[\s\S]*model)/i.test(safeMessage)) {
                error.code = 'model_unavailable';
                const replacement = safeMessage.match(/(?:use|switch to|try)\s+(?:the\s+)?(?:model\s+)?(?:models\/)?(gemini-[a-z0-9.-]+)/i);
                error.suggestedModel = replacement?.[1].replace(/\.$/, '') || null;
            }
            throw error;
        }
        return data;
    }

    function isTextModel(provider, model) {
        const id = (model.id || model.name || '').replace(/^models\//, '').toLowerCase();
        if (provider === 'anthropic') return id.startsWith('claude-');
        if (provider === 'gemini') return model.supportedGenerationMethods?.includes('generateContent') &&
            !/(embedding|imagen|image|tts|audio|robotics|veo|lyria|banana)/.test(id);
        // The OpenAI model list has no endpoint-capability field. Keep text families,
        // excluding specialized endpoints that this text-only review cannot use.
        const base = id.startsWith('ft:') ? id.split(':')[1] : id;
        return /^(gpt-|chatgpt-|o\d)/.test(base) &&
            !/(image|audio|realtime|transcri|search|codex|computer|moderation)/.test(base);
    }

    function orderModels(provider, models) {
        if (provider !== 'gemini') return models;
        const rank = model => {
            // Numeric stable IDs first, newest generation first. At equal versions,
            // default to Flash; keep experimental/preview/alias models available below.
            const match = model.id.match(/^gemini-(\d+)(?:\.(\d+))?-(flash|pro)(-lite)?(?:-\d{3})?$/);
            return match ? [1, Number(match[1]), Number(match[2] || 0), match[3] === 'flash' ? 1 : 0, match[4] ? 0 : 1] : [0];
        };
        return [...models].sort((a, b) => {
            const left = rank(a), right = rank(b);
            for (let i = 0; i < Math.max(left.length, right.length); i++) {
                const difference = (right[i] || 0) - (left[i] || 0);
                if (difference) return difference;
            }
            return 0;
        });
    }

    async function listModels(provider, key, options = {}) {
        config(provider);
        const models = new Map();
        const seenCursors = new Set();
        let cursor = '';
        for (let page = 0; page < 100; page++) {
            const query = new URLSearchParams();
            if (provider === 'gemini') {
                query.set('pageSize', '1000');
                if (cursor) query.set('pageToken', cursor);
            } else if (provider === 'anthropic') {
                query.set('limit', '1000');
                if (cursor) query.set('after_id', cursor);
            }
            const data = await request(provider, key, '/models' + (query.size ? '?' + query : ''), options);
            const entries = provider === 'gemini' ? data.models : data.data;
            if (!Array.isArray(entries)) throw new Error(`${config(provider).name} returned an invalid model list.`);
            for (const model of entries) {
                if (!isTextModel(provider, model)) continue;
                const id = (model.id || model.name).replace(/^models\//, '');
                models.set(id, { id, label: model.display_name || model.displayName || id, maxTokens: model.max_tokens || model.outputTokenLimit || null });
            }
            cursor = provider === 'gemini' ? data.nextPageToken : provider === 'anthropic' && data.has_more ? data.last_id : '';
            if (provider === 'anthropic' && data.has_more && !cursor) throw new Error('Claude returned an incomplete model list. Query again.');
            if (!cursor) return orderModels(provider, [...models.values()]);
            if (seenCursors.has(cursor)) throw new Error('The provider repeated a model page. Query again.');
            seenCursors.add(cursor);
        }
        throw new Error('The model list exceeded the page limit. Query again.');
    }

    function usesChatCompletions(model) {
        const base = model.startsWith('ft:') ? model.split(':')[1] : model;
        return /^(gpt-3\.5|gpt-4(?:$|-turbo|-\d|-32k)|chatgpt-|o1-(mini|preview))/.test(base) || /-chat(?:-|$)/.test(base);
    }

    function buildReviewRequest(provider, model, system, prompt) {
        const id = typeof model === 'string' ? model : model.id;
        if (!id) throw new Error('Choose a model first.');
        if (provider === 'gemini') return {
            path: `/models/${encodeURIComponent(id)}:generateContent`,
            body: { systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: prompt }] }] }
        };
        if (provider === 'anthropic') return {
            path: '/messages',
            body: { model: id, max_tokens: Math.min(model.maxTokens || 4096, 8192), system, messages: [{ role: 'user', content: prompt }] }
        };
        if (provider === 'openai') {
            if (usesChatCompletions(id)) return {
                path: '/chat/completions',
                body: { model: id, store: false, messages: /^(o1-(mini|preview))/.test(id)
                    ? [{ role: 'user', content: system + '\n\n' + prompt }]
                    : [{ role: 'system', content: system }, { role: 'user', content: prompt }] }
            };
            return { path: '/responses', body: { model: id, instructions: system, input: prompt, store: false } };
        }
        config(provider);
    }

    function readReview(provider, data) {
        let text = '';
        if (provider === 'gemini') {
            const candidate = data.candidates?.[0];
            if (data.promptFeedback?.blockReason || (candidate?.finishReason && candidate.finishReason !== 'STOP')) {
                throw new Error(`Gemini did not finish the review (${candidate?.finishReason || data.promptFeedback.blockReason}). Try a different model or a shorter review.`);
            }
            text = candidate?.content?.parts?.filter(part => !part.thought && typeof part.text === 'string').map(part => part.text).join('\n') || '';
        } else if (provider === 'anthropic') {
            if (data.stop_reason && !['end_turn', 'stop_sequence'].includes(data.stop_reason)) {
                throw new Error(`Claude did not finish the review (${data.stop_reason}). Try a shorter review or another model.`);
            }
            text = data.content?.filter(block => block.type === 'text').map(block => block.text).join('\n') || '';
        } else if (provider === 'openai') {
            if (data.choices) {
                const choice = data.choices[0];
                if (choice?.message?.refusal) throw new Error('OpenAI declined this review. Check the supplied text.');
                if (choice?.finish_reason && choice.finish_reason !== 'stop') throw new Error(`OpenAI did not finish the review (${choice.finish_reason}). Try a shorter review.`);
                text = choice?.message?.content || '';
            } else {
                if (data.status && data.status !== 'completed') throw new Error(`OpenAI did not finish the review (${data.incomplete_details?.reason || data.status}). Try a shorter review or another model.`);
                const content = (data.output || []).filter(item => item.type === 'message').flatMap(item => item.content || []);
                if (content.some(block => block.type === 'refusal')) throw new Error('OpenAI declined this review. Check the supplied text.');
                text = content.filter(block => block.type === 'output_text').map(block => block.text).join('\n');
            }
        }
        if (typeof text !== 'string' || !text.trim()) throw new Error(`${config(provider).name} returned no review text. Try again or choose another model.`);
        return text.trim();
    }

    async function generateReview(provider, key, model, system, prompt, options = {}) {
        const { path, body } = buildReviewRequest(provider, model, system, prompt);
        return readReview(provider, await request(provider, key, path, { ...options, body }));
    }

    const api = { providers, listModels, generateReview, buildReviewRequest, readReview, isTextModel };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.ReviewProviders = api;
})(globalThis);
