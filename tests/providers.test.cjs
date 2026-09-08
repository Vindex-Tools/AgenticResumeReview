const { test } = require('node:test');
const assert = require('node:assert/strict');
const { listModels, generateReview, readReview, buildReviewRequest } = require('../providers.js');

const response = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
const key = 'test-secret-not-a-real-key';

test('Gemini discovery follows pages, filters non-text models, deduplicates, and uses header auth', async () => {
    const urls = [];
    const fetchImpl = async (url, init) => {
        urls.push(url);
        assert.equal(init.headers['x-goog-api-key'], key);
        assert.equal(init.headers.Authorization, undefined);
        assert.equal(url.includes(key), false);
        return urls.length === 1
            ? response({ models: [
                { name: 'models/gemini-test-flash', displayName: 'Flash', supportedGenerationMethods: ['generateContent'] },
                { name: 'models/embedding-test', supportedGenerationMethods: ['embedContent'] },
                { name: 'models/gemini-test-tts', supportedGenerationMethods: ['generateContent'] }
            ], nextPageToken: 'page two/+' })
            : response({ models: [
                { name: 'models/gemini-test-flash', supportedGenerationMethods: ['generateContent'] },
                { name: 'models/gemini-test-pro', supportedGenerationMethods: ['generateContent'] }
            ] });
    };
    const models = await listModels('gemini', key, { fetchImpl });
    assert.deepEqual(models.map(m => m.id), ['gemini-test-flash', 'gemini-test-pro']);
    assert.equal(new URL(urls[1]).searchParams.get('pageToken'), 'page two/+');
});

test('Claude discovery follows cursor pagination and sends required browser headers', async () => {
    let requests = 0;
    const models = await listModels('anthropic', key, { fetchImpl: async (url, init) => {
        assert.equal(init.headers['x-api-key'], key);
        assert.equal(init.headers['anthropic-version'], '2023-06-01');
        assert.equal(init.headers['anthropic-dangerous-direct-browser-access'], 'true');
        assert.equal(init.headers.Authorization, undefined);
        requests++;
        if (requests === 1) return response({ data: [{ id: 'claude-test-sonnet', display_name: 'Sonnet', max_tokens: 64000 }], has_more: true, last_id: 'claude-test-sonnet' });
        assert.equal(new URL(url).searchParams.get('after_id'), 'claude-test-sonnet');
        return response({ data: [{ id: 'claude-test-haiku', max_tokens: 4096 }], has_more: false });
    } });
    assert.equal(models.length, 2);
    assert.equal(models[0].label, 'Sonnet');
    assert.equal(models[1].maxTokens, 4096);
});

test('OpenAI model discovery keeps text families and excludes unsupported specialized endpoints', async () => {
    const ids = ['gpt-5-test', 'gpt-4o', 'gpt-4.1', 'gpt-3.5-turbo', 'o3', 'ft:gpt-4o:org:test', 'text-embedding-3-small', 'gpt-image-1', 'gpt-4o-audio-preview', 'gpt-realtime', 'gpt-5-codex', 'o3-deep-research'];
    const models = await listModels('openai', key, { fetchImpl: async (url, init) => {
        assert.equal(url, 'https://api.openai.com/v1/models');
        assert.equal(init.headers.Authorization, `Bearer ${key}`);
        assert.equal(init.headers['x-api-key'], undefined);
        assert.equal(init.credentials, 'omit');
        assert.equal(init.redirect, 'error');
        return response({ data: ids.map(id => ({ id })) });
    } });
    assert.deepEqual(models.map(m => m.id), ids.slice(0, 6));
});

test('empty model lists stay empty; no invented fallback IDs', async () => {
    for (const provider of ['gemini', 'openai', 'anthropic']) {
        assert.deepEqual(await listModels(provider, key, { fetchImpl: async () => response(provider === 'gemini' ? { models: [] } : { data: [] }) }), []);
    }
});

test('malformed lists and invalid pagination fail instead of silently showing partial lists', async () => {
    await assert.rejects(listModels('openai', key, { fetchImpl: async () => response({ data: {} }) }), /invalid model list/);
    await assert.rejects(listModels('anthropic', key, { fetchImpl: async () => response({ data: [], has_more: true }) }), /incomplete model list/);
    await assert.rejects(listModels('gemini', key, { fetchImpl: async () => response({ models: [], nextPageToken: 'repeat' }) }), /repeated a model page/);
});

test('all providers send the exact same skill and user prompt through their own request format', async () => {
    const system = '# Shared skill\nPreserve candidate facts.';
    const prompt = 'Full review\nRESUME: Investigated alerts.';
    for (const provider of ['gemini', 'openai', 'anthropic']) {
        let requested = false;
        const text = await generateReview(provider, key, { id: `${provider}-test`, maxTokens: 6000 }, system, prompt, { fetchImpl: async (url, init) => {
            requested = true;
            const body = JSON.parse(init.body);
            assert.equal(init.method, 'POST');
            assert.equal(init.headers['Content-Type'], 'application/json');
            if (provider === 'gemini') {
                assert.match(url, /\/models\/gemini-test:generateContent$/);
                assert.equal(body.systemInstruction.parts[0].text, system);
                assert.equal(body.contents[0].parts[0].text, prompt);
                return response({ candidates: [{ finishReason: 'STOP', content: { parts: [{ thought: true, text: 'private reasoning' }, { text: '# Review' }, { text: 'Finding.' }] } }] });
            }
            if (provider === 'anthropic') {
                assert.match(url, /\/messages$/);
                assert.equal(body.system, system);
                assert.equal(body.messages[0].content, prompt);
                assert.equal(body.max_tokens, 6000);
                return response({ stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: 'private reasoning' }, { type: 'text', text: '# Review' }, { type: 'text', text: 'Finding.' }] });
            }
            assert.match(url, /\/responses$/);
            assert.equal(body.instructions, system);
            assert.equal(body.input, prompt);
            assert.equal(body.store, false);
            assert.equal(body.temperature, undefined);
            return response({ status: 'completed', output: [{ type: 'reasoning', summary: [{ text: 'private reasoning' }] }, { type: 'message', content: [{ type: 'output_text', text: '# Review' }, { type: 'output_text', text: 'Finding.' }] }] });
        } });
        assert.equal(requested, true);
        assert.equal(text, '# Review\nFinding.');
    }
});

test('older OpenAI chat models route to Chat Completions, while newer families use Responses', async () => {
    for (const id of ['gpt-3.5-turbo', 'gpt-4-turbo', 'chatgpt-4o-latest', 'gpt-5-chat-latest']) {
        const request = buildReviewRequest('openai', id, 'skill', 'resume');
        assert.equal(request.path, '/chat/completions');
        assert.equal(request.body.messages[0].content, 'skill');
        assert.equal(request.body.messages[1].content, 'resume');
    }
    for (const id of ['gpt-4.1', 'gpt-4o', 'gpt-5-test', 'o3', 'o1-pro']) {
        assert.equal(buildReviewRequest('openai', id, 'skill', 'resume').path, '/responses');
    }
    assert.equal(readReview('openai', { choices: [{ finish_reason: 'stop', message: { content: 'Review' } }] }), 'Review');
});

test('Claude output budget respects model metadata, with a conservative fallback', () => {
    assert.equal(buildReviewRequest('anthropic', { id: 'claude-test', maxTokens: 2048 }, 's', 'p').body.max_tokens, 2048);
    assert.equal(buildReviewRequest('anthropic', { id: 'claude-test', maxTokens: 64000 }, 's', 'p').body.max_tokens, 8192);
    assert.equal(buildReviewRequest('anthropic', 'claude-test', 's', 'p').body.max_tokens, 4096);
});

test('truncated, refused, blocked, and empty output cannot masquerade as a completed report', () => {
    assert.throws(() => readReview('gemini', { candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: 'partial' }] } }] }), /did not finish/);
    assert.throws(() => readReview('gemini', { promptFeedback: { blockReason: 'SAFETY' } }), /SAFETY/);
    assert.throws(() => readReview('anthropic', { stop_reason: 'max_tokens', content: [{ type: 'text', text: 'partial' }] }), /did not finish/);
    assert.throws(() => readReview('anthropic', { stop_reason: 'refusal' }), /did not finish/);
    assert.throws(() => readReview('openai', { status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } }), /max_output_tokens/);
    assert.throws(() => readReview('openai', { status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'No' }] }] }), /declined/);
    assert.throws(() => readReview('openai', { choices: [{ finish_reason: 'length', message: { content: 'partial' } }] }), /did not finish/);
    for (const provider of ['gemini', 'anthropic', 'openai']) assert.throws(() => readReview(provider, {}), /no review text/);
});

test('authentication errors redact keys, and failed POSTs are not retried', async () => {
    let calls = 0;
    await assert.rejects(generateReview('openai', key, 'gpt-test', 'skill', 'resume', { fetchImpl: async () => {
        calls++;
        return response({ error: { message: `Incorrect API key: ${key}` } }, 401);
    } }), error => !error.message.includes(key) && error.message.includes('[redacted key]'));
    assert.equal(calls, 1);
});

test('network, malformed JSON, and abort errors stay actionable', async () => {
    await assert.rejects(listModels('anthropic', key, { fetchImpl: async () => { throw new TypeError('Failed to fetch'); } }), /Could not reach Claude/);
    await assert.rejects(listModels('gemini', key, { fetchImpl: async () => ({ status: 502, json: async () => { throw Error('HTML'); } }) }), /unreadable response/);
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(listModels('openai', key, { signal: controller.signal, fetchImpl: async (_, init) => {
        assert.equal(init.signal, controller.signal);
        throw new DOMException('Aborted', 'AbortError');
    } }), { name: 'AbortError' });
});

test('invalid providers and missing keys make no request', async () => {
    const fetchImpl = () => assert.fail('No request should have been made');
    await assert.rejects(listModels('unknown', key, { fetchImpl }), /Choose an AI provider/);
    await assert.rejects(listModels('openai', '', { fetchImpl }));
});

test('Gemini defaults to newer stable models even when the API returns old models first', async () => {
    const ids = ['gemini-2.5-flash', 'gemini-3-flash-preview', 'gemini-3.6-pro', 'gemini-3.6-flash-lite', 'gemini-3.6-flash', 'gemini-3.8-flash', 'gemini-flash-latest'];
    const models = await listModels('gemini', key, { fetchImpl: async () => response({ models: ids.map(id => ({ name: 'models/' + id, supportedGenerationMethods: ['generateContent'] })) }) });
    assert.deepEqual(models.map(model => model.id), ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.6-flash-lite', 'gemini-3.6-pro', 'gemini-2.5-flash', 'gemini-3-flash-preview', 'gemini-flash-latest']);
});

test('Gemini numeric version ordering handles double digits without inventing absent models', async () => {
    const ids = ['gemini-3.9-flash', 'gemini-3.10-flash'];
    const models = await listModels('gemini', key, { fetchImpl: async () => response({ models: ids.map(id => ({ name: 'models/' + id, supportedGenerationMethods: ['generateContent'] })) }) });
    assert.deepEqual(models.map(model => model.id), [...ids].reverse());
});

test('the reported Gemini new-user restriction exposes the suggested replacement without retrying', async () => {
    let calls = 0;
    await assert.rejects(generateReview('gemini', key, 'gemini-2.5-flash', 'skill', 'resume', { fetchImpl: async () => {
        calls++;
        return response({ error: { message: 'This model models/gemini-2.5-flash is no longer available to new users. Please update your code to use models/gemini-3.6-flash for the latest features and improvements. We recommend you to use the Interactions API.' } }, 404);
    } }), error => error.code === 'model_unavailable' && error.suggestedModel === 'gemini-3.6-flash');
    assert.equal(calls, 1);
});

test('quota, authentication, and server failures do not mark a Gemini model unavailable', async () => {
    for (const status of [401, 429, 500, 503]) {
        await assert.rejects(generateReview('gemini', key, 'gemini-test', 'skill', 'resume', { fetchImpl: async () => response({ error: { message: 'Model not available due to temporary account or service limits.' } }, status) }), error => error.code === undefined);
    }
});

test('unavailable models without a suggested replacement do not fabricate one', async () => {
    await assert.rejects(generateReview('gemini', key, 'gemini-test', 'skill', 'resume', { fetchImpl: async () => response({ error: { message: 'Model models/gemini-test is not found.' } }, 404) }), error => error.code === 'model_unavailable' && error.suggestedModel === null);
});
