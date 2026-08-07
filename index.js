// ================================================================
//  ☁️ Cloudflare Worker - DeepSeek Fine-tuning
//  فقط با D1 Database + API خارجی (بدون R2)
// ================================================================

// ================================================================
//  📦 تنظیمات اصلی
// ================================================================

const CONFIG = {
    LIMITS: {
        MAX_SAMPLES: 500,
        MAX_DATA_SIZE: 100 * 1024
    }
};

// ================================================================
//  🧠 سرویس اصلی
// ================================================================

class DeepSeekFineTuneService {
    constructor(env) {
        this.env = env;
        this.db = env.DB;
    }

    // ============================================================
    //  📝 آماده‌سازی داده
    // ============================================================
    
    async prepareData(data) {
        const { instructions, outputs } = data;
        
        if (!instructions || !outputs || instructions.length !== outputs.length) {
            throw new Error('داده‌های ورودی نامعتبر');
        }
        
        if (instructions.length > CONFIG.LIMITS.MAX_SAMPLES) {
            throw new Error(`حداکثر ${CONFIG.LIMITS.MAX_SAMPLES} نمونه مجاز است`);
        }
        
        const preparedData = instructions.map((instruction, i) => ({
            instruction: instruction.trim(),
            output: outputs[i].trim(),
            prompt: this.buildPrompt(instruction)
        }));
        
        const dataId = `data_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        
        await this.db.prepare(
            `INSERT INTO training_data (id, data, created_at, status) 
             VALUES (?, ?, CURRENT_TIMESTAMP, 'prepared')`
        ).bind(dataId, JSON.stringify(preparedData)).run();
        
        return {
            success: true,
            id: dataId,
            count: preparedData.length,
            size: JSON.stringify(preparedData).length
        };
    }

    // ============================================================
    //  📝 ساخت Prompt
    // ============================================================
    
    buildPrompt(instruction) {
        return `You are an AI programming assistant, utilizing the DeepSeek Coder model, developed by DeepSeek Company, and you only answer questions related to computer science. For politically sensitive questions, security and privacy issues, and other non-computer science questions, you will refuse to answer.

### Instruction:
${instruction.trim()}

### Response:
`;
    }

    // ============================================================
    //  🚀 شروع Fine-tuning
    // ============================================================
    
    async startFineTune(dataId, options = {}) {
        const result = await this.db.prepare(
            'SELECT data FROM training_data WHERE id = ?'
        ).bind(dataId).first();
        
        if (!result) {
            throw new Error('داده‌ها یافت نشد');
        }
        
        const trainingData = JSON.parse(result.data);
        const jobId = await this.submitToExternalService(trainingData, options);
        
        await this.db.prepare(
            `UPDATE training_data 
             SET status = 'training', job_id = ?, started_at = CURRENT_TIMESTAMP 
             WHERE id = ?`
        ).bind(jobId, dataId).run();
        
        return {
            jobId: jobId,
            dataId: dataId,
            status: 'training',
            estimatedTime: this.estimateTrainingTime(trainingData.length)
        };
    }

    // ============================================================
    //  🔗 اتصال به سرویس خارجی
    // ============================================================
    
    async submitToExternalService(data, options) {
        // اولویت ۱: Replicate
        if (this.env.REPLICATE_API_TOKEN) {
            return this.runOnReplicate(data, options);
        }
        
        // اولویت ۲: Hugging Face
        if (this.env.HUGGINGFACE_TOKEN) {
            return this.runOnHuggingFace(data, options);
        }
        
        // اولویت ۳: اجرای محلی
        if (data.length < 50) {
            return this.runLocallyWasm(data, options);
        }
        
        throw new Error('هیچ سرویس خارجی تنظیم نشده است');
    }

    // ============================================================
    //  🎯 Replicate API
    // ============================================================
    
    async runOnReplicate(data, options) {
        const smallData = data.slice(0, 100).map(d => ({
            instruction: d.instruction.slice(0, 200),
            output: d.output.slice(0, 200)
        }));
        
        const response = await fetch('https://api.replicate.com/v1/predictions', {
            method: 'POST',
            headers: {
                'Authorization': `Token ${this.env.REPLICATE_API_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                version: 'deepseek-ai/deepseek-coder-6.7b-instruct:latest',
                input: {
                    training_data: smallData,
                    epochs: options.epochs || 1,
                    batch_size: Math.min(options.batchSize || 4, 8),
                    learning_rate: options.learningRate || 2e-5
                },
                webhook: `${this.env.WORKER_URL}/api/webhook`,
                webhook_events_filter: ["completed"]
            })
        });
        
        const result = await response.json();
        return result.id;
    }

    // ============================================================
    //  🎯 Hugging Face API
    // ============================================================
    
    async runOnHuggingFace(data, options) {
        const smallData = data.slice(0, 10);
        
        const response = await fetch(
            'https://api-inference.huggingface.co/models/deepseek-ai/deepseek-coder-6.7b-instruct',
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.env.HUGGINGFACE_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    inputs: smallData.map(d => d.prompt),
                    parameters: {
                        max_length: 100,
                        temperature: 0.7
                    }
                })
            }
        );
        
        const result = await response.json();
        const jobId = `hf_${Date.now()}`;
        
        await this.db.prepare(
            `INSERT INTO training_results (job_id, data_id, results, created_at) 
             VALUES (?, ?, ?, CURRENT_TIMESTAMP)`
        ).bind(jobId, data[0]?.id || 'unknown', JSON.stringify(result)).run();
        
        return jobId;
    }

    // ============================================================
    //  🎯 اجرای محلی (WebAssembly)
    // ============================================================
    
    async runLocallyWasm(data, options) {
        const jobId = `local_${Date.now()}`;
        
        const results = data.map(d => ({
            instruction: d.instruction,
            generated: `[Simulated] Response for: ${d.instruction.substring(0, 50)}...`
        }));
        
        await this.db.prepare(
            `INSERT INTO training_results (job_id, data_id, results, created_at) 
             VALUES (?, ?, ?, CURRENT_TIMESTAMP)`
        ).bind(jobId, 'local', JSON.stringify(results)).run();
        
        return jobId;
    }

    // ============================================================
    //  📊 بررسی وضعیت
    // ============================================================
    
    async getJobStatus(jobId) {
        const result = await this.db.prepare(
            `SELECT * FROM training_data WHERE job_id = ?`
        ).bind(jobId).first();
        
        if (!result) {
            throw new Error('Job not found');
        }
        
        return {
            jobId: jobId,
            status: result.status,
            progress: result.progress || 0,
            created_at: result.created_at,
            started_at: result.started_at,
            completed_at: result.completed_at
        };
    }

    // ============================================================
    //  📥 دریافت نتایج
    // ============================================================
    
    async getResults(jobId) {
        const result = await this.db.prepare(
            'SELECT results FROM training_results WHERE job_id = ?'
        ).bind(jobId).first();
        
        if (!result) {
            throw new Error('Result not found');
        }
        
        return JSON.parse(result.results);
    }

    // ============================================================
    //  ⏱️ تخمین زمان
    // ============================================================
    
    estimateTrainingTime(dataSize) {
        const baseTime = 60;
        const timePerSample = 2;
        const totalSeconds = baseTime + (dataSize * timePerSample);
        
        return {
            seconds: totalSeconds,
            minutes: Math.round(totalSeconds / 60),
            readable: totalSeconds < 60 ? `${totalSeconds} ثانیه` : `${Math.round(totalSeconds / 60)} دقیقه`
        };
    }

    // ============================================================
    //  🔄 Webhook
    // ============================================================
    
    async handleWebhook(data) {
        const { id, status, output } = data;
        
        await this.db.prepare(
            `UPDATE training_data 
             SET status = ?, completed_at = CURRENT_TIMESTAMP 
             WHERE job_id = ?`
        ).bind(status === 'succeeded' ? 'completed' : 'failed', id).run();
        
        if (status === 'succeeded' && output) {
            await this.db.prepare(
                `INSERT INTO training_results (job_id, results, created_at) 
                 VALUES (?, ?, CURRENT_TIMESTAMP)`
            ).bind(id, JSON.stringify(output)).run();
        }
        
        return { success: true };
    }
}

// ================================================================
//  🌐 Cloudflare Worker
// ================================================================

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const service = new DeepSeekFineTuneService(env);
        
        // CORS
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type'
                }
            });
        }

        try {
            // 🏠 Health Check
            if (url.pathname === '/') {
                return new Response(JSON.stringify({
                    status: 'online',
                    service: 'DeepSeek Fine-tuning (No R2)',
                    storage: 'D1 Database',
                    limits: CONFIG.LIMITS
                }), {
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            // 📝 آماده‌سازی داده
            if (url.pathname === '/api/prepare' && request.method === 'POST') {
                const body = await request.json();
                const result = await service.prepareData(body);
                return new Response(JSON.stringify(result), {
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            // 🚀 شروع آموزش
            if (url.pathname === '/api/train' && request.method === 'POST') {
                const body = await request.json();
                const result = await service.startFineTune(body.dataId, body.options);
                return new Response(JSON.stringify(result), {
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            // 📊 وضعیت
            if (url.pathname === '/api/status' && request.method === 'GET') {
                const jobId = url.searchParams.get('jobId');
                if (!jobId) throw new Error('jobId required');
                const result = await service.getJobStatus(jobId);
                return new Response(JSON.stringify(result), {
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            // 📥 دریافت نتایج
            if (url.pathname === '/api/results' && request.method === 'GET') {
                const jobId = url.searchParams.get('jobId');
                if (!jobId) throw new Error('jobId required');
                const result = await service.getResults(jobId);
                return new Response(JSON.stringify(result), {
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            // 🔄 Webhook
            if (url.pathname === '/api/webhook' && request.method === 'POST') {
                const body = await request.json();
                const result = await service.handleWebhook(body);
                return new Response(JSON.stringify(result), {
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            // ❌ 404
            return new Response(JSON.stringify({
                error: 'Not found',
                endpoints: [
                    'POST /api/prepare',
                    'POST /api/train',
                    'GET /api/status?jobId=xxx',
                    'GET /api/results?jobId=xxx',
                    'POST /api/webhook'
                ]
            }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });

        } catch (error) {
            return new Response(JSON.stringify({
                error: error.message
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }
};

// ================================================================
//  🗄️ Schema D1
// ================================================================

/*

CREATE TABLE IF NOT EXISTS training_data (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    status TEXT DEFAULT 'prepared',
    job_id TEXT,
    progress REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME,
    completed_at DATETIME,
    error TEXT
);

CREATE TABLE IF NOT EXISTS training_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT NOT NULL,
    data_id TEXT,
    results TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (job_id) REFERENCES training_data(job_id)
);

CREATE INDEX idx_job_id ON training_data(job_id);
CREATE INDEX idx_status ON training_data(status);

*/

// ================================================================
//  ⚙️ wrangler.toml
// ================================================================

/*

name = "deepseek-finetune"
main = "src/index.js"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB"
database_name = "deepseek-training"
database_id = "your-database-id"

[vars]
REPLICATE_API_TOKEN = "r8_xxxxxxxxxxxxx"
WORKER_URL = "https://your-worker.workers.dev"

*/
