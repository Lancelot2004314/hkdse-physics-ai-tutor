#!/usr/bin/env node
/**
 * HKDSE Physics AI Tutor - 批量上传知识库文件脚本
 * 
 * 使用方法:
 *   node scripts/bulk-upload.js <文件夹路径> [选项]
 * 
 * 选项:
 *   --lang=<en|zh>           语言 (默认: en)
 *   --subject=<科目>          科目 (默认: Physics)
 *   --type=<类型>             文档类型 (默认: Past Paper)
 *   --cookie=<session>        Session cookie (从浏览器复制)
 *   --api-url=<url>           API 地址 (默认: https://hkdse-physics-ai-tutor.pages.dev)
 *   --dry-run                 只显示会上传的文件，不实际上传
 * 
 * 示例:
 *   node scripts/bulk-upload.js ./dse-papers --lang=zh --type="Past Paper" --cookie="session=abc123"
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// 支持的文件类型
const SUPPORTED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.webp'];

// 解析命令行参数
function parseArgs(args) {
    const options = {
        folder: null,
        lang: 'en',
        subject: 'Physics',
        type: 'Past Paper',
        cookie: null,
        apiUrl: 'https://hkdse-physics-ai-tutor.pages.dev',
        dryRun: false
    };

    for (const arg of args) {
        if (arg.startsWith('--lang=')) {
            options.lang = arg.split('=')[1];
        } else if (arg.startsWith('--subject=')) {
            options.subject = arg.split('=')[1];
        } else if (arg.startsWith('--type=')) {
            options.type = arg.split('=')[1];
        } else if (arg.startsWith('--cookie=')) {
            options.cookie = arg.split('=').slice(1).join('=');
        } else if (arg.startsWith('--api-url=')) {
            options.apiUrl = arg.split('=')[1];
        } else if (arg === '--dry-run') {
            options.dryRun = true;
        } else if (!arg.startsWith('--') && !options.folder) {
            options.folder = arg;
        }
    }

    return options;
}

// 获取文件夹中所有支持的文件
function getFilesInFolder(folderPath) {
    const files = [];

    function scanDir(dir) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                scanDir(fullPath); // 递归扫描子文件夹
            } else if (entry.isFile()) {
                const ext = path.extname(entry.name).toLowerCase();
                if (SUPPORTED_EXTENSIONS.includes(ext)) {
                    files.push(fullPath);
                }
            }
        }
    }

    scanDir(folderPath);
    return files;
}

// 上传单个文件 - 使用正确的 multipart/form-data 格式
function uploadFile(filePath, options) {
    return new Promise((resolve, reject) => {
        const fileName = path.basename(filePath);
        const fileContent = fs.readFileSync(filePath);
        const ext = path.extname(filePath).toLowerCase();

        // 确定 MIME 类型
        const mimeTypes = {
            '.pdf': 'application/pdf',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp'
        };
        const mimeType = mimeTypes[ext] || 'application/octet-stream';

        // 构建 multipart/form-data - 正确格式
        const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2, 15);
        const CRLF = '\r\n';

        // 使用文件名（去掉扩展名）作为标题
        const title = path.basename(fileName, path.extname(fileName));
        const fields = {
            title: title,
            language: options.lang,
            subject: options.subject,
            docType: options.type
        };

        // 构建各个部分
        const parts = [];

        // 先添加文本字段
        for (const [key, value] of Object.entries(fields)) {
            parts.push(Buffer.from(
                `--${boundary}${CRLF}` +
                `Content-Disposition: form-data; name="${key}"${CRLF}${CRLF}` +
                `${value}${CRLF}`,
                'utf8'
            ));
        }

        // 添加文件字段
        parts.push(Buffer.from(
            `--${boundary}${CRLF}` +
            `Content-Disposition: form-data; name="file"; filename="${fileName}"${CRLF}` +
            `Content-Type: ${mimeType}${CRLF}${CRLF}`,
            'utf8'
        ));
        parts.push(fileContent);
        parts.push(Buffer.from(`${CRLF}--${boundary}--${CRLF}`, 'utf8'));

        // 组合完整的 body
        const fullBody = Buffer.concat(parts);

        // 解析 URL
        const url = new URL(`${options.apiUrl}/api/kb/upload`);
        const isHttps = url.protocol === 'https:';
        const httpModule = isHttps ? https : http;

        const reqOptions = {
            hostname: url.hostname,
            port: url.port || (isHttps ? 443 : 80),
            path: url.pathname,
            method: 'POST',
            timeout: 180000, // 3 分钟超时（OCR 需要时间）
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'Content-Length': fullBody.length,
                'Cookie': options.cookie || ''
            }
        };

        const req = httpModule.request(reqOptions, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        const result = JSON.parse(data);
                        resolve({ success: true, result, fileName });
                    } catch (e) {
                        resolve({ success: true, result: data, fileName });
                    }
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                }
            });
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout (3 min) - 文件可能太大或 OCR 处理超时'));
        });

        req.on('error', reject);
        req.write(fullBody);
        req.end();
    });
}

// 主函数
async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
        console.log(`
╔════════════════════════════════════════════════════════════╗
║  HKDSE Physics AI Tutor - 批量上传知识库文件               ║
╚════════════════════════════════════════════════════════════╝

使用方法:
  node scripts/bulk-upload.js <文件夹路径> [选项]

选项:
  --lang=<en|zh>           语言 (默认: en)
  --subject=<科目>          科目 (默认: Physics)
  --type=<类型>             文档类型 (默认: Past Paper)
  --cookie=<session>        Session cookie (必须，从浏览器复制)
  --api-url=<url>           API 地址 (默认: https://hkdse-physics-ai-tutor.pages.dev)
  --dry-run                 只显示会上传的文件，不实际上传

获取 Cookie:
  1. 用管理员账号登录 https://hkdse-physics-ai-tutor.pages.dev
  2. 打开浏览器开发者工具 (F12)
  3. 切换到 Application/Storage > Cookies
  4. 复制 "session" 的值

示例:
  node scripts/bulk-upload.js ./dse-papers --lang=zh --type="Past Paper" --cookie="session=abc123..."

支持的文件格式: PDF, JPG, JPEG, PNG, GIF, WEBP
`);
        return;
    }

    const options = parseArgs(args);

    // 验证参数
    if (!options.folder) {
        console.error('❌ 错误: 请指定文件夹路径');
        process.exit(1);
    }

    if (!fs.existsSync(options.folder)) {
        console.error(`❌ 错误: 文件夹不存在: ${options.folder}`);
        process.exit(1);
    }

    if (!options.cookie && !options.dryRun) {
        console.error('❌ 错误: 请提供 --cookie 参数 (从浏览器复制 session cookie)');
        console.error('   使用 --dry-run 可以先预览要上传的文件');
        process.exit(1);
    }

    // 扫描文件
    console.log(`\n📁 扫描文件夹: ${path.resolve(options.folder)}`);
    const files = getFilesInFolder(options.folder);

    if (files.length === 0) {
        console.log('⚠️  没有找到支持的文件 (PDF/JPG/PNG/GIF/WEBP)');
        return;
    }

    console.log(`\n📋 找到 ${files.length} 个文件:`);
    files.forEach((f, i) => {
        const relativePath = path.relative(options.folder, f);
        console.log(`   ${i + 1}. ${relativePath}`);
    });

    console.log(`\n⚙️  上传设置:`);
    console.log(`   语言: ${options.lang}`);
    console.log(`   科目: ${options.subject}`);
    console.log(`   类型: ${options.type}`);
    console.log(`   API:  ${options.apiUrl}`);

    if (options.dryRun) {
        console.log('\n🔍 Dry-run 模式 - 不会实际上传文件');
        return;
    }

    // 开始上传
    console.log(`\n🚀 开始上传...\n`);

    const results = {
        success: [],
        failed: []
    };

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileName = path.basename(file);
        const progress = `[${i + 1}/${files.length}]`;

        process.stdout.write(`${progress} 上传 ${fileName}... `);

        try {
            const result = await uploadFile(file, options);
            console.log('✅ 成功');
            results.success.push({ file: fileName, result: result.result });
        } catch (error) {
            console.log(`❌ 失败: ${error.message}`);
            results.failed.push({ file: fileName, error: error.message });
        }

        // 延迟 3 秒，让服务器有时间处理
        if (i < files.length - 1) {
            console.log('   ⏳ 等待 3 秒...');
            await new Promise(r => setTimeout(r, 3000));
        }
    }

    // 显示结果摘要
    console.log(`\n${'═'.repeat(50)}`);
    console.log('📊 上传结果摘要');
    console.log('═'.repeat(50));
    console.log(`✅ 成功: ${results.success.length} 个文件`);
    console.log(`❌ 失败: ${results.failed.length} 个文件`);

    if (results.failed.length > 0) {
        console.log('\n失败的文件:');
        results.failed.forEach(f => {
            console.log(`   - ${f.file}: ${f.error}`);
        });
    }

    console.log('\n完成！');
}

main().catch(err => {
    console.error('致命错误:', err);
    process.exit(1);
});
