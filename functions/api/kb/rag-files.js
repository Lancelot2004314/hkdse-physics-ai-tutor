/**
 * Vertex AI RAG Files List API
 * Lists all files directly from Vertex AI RAG Engine corpus
 */

import { getUserFromSession, isAdmin } from '../../../shared/auth.js';
import { listRagFiles } from '../../../shared/vertexRag.js';
import { getGcpConfig } from '../../../shared/googleAuth.js';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequestOptions() {
    return new Response(null, { headers: corsHeaders });
}

export async function onRequestGet(context) {
    const { request, env } = context;

    try {
        // Check authentication
        const user = await getUserFromSession(request, env);
        if (!user) {
            return errorResponse(401, 'Please login');
        }

        // Check admin permission
        if (!isAdmin(user.email, env)) {
            return errorResponse(403, 'Admin access required');
        }

        // Get GCP config for corpus info
        const gcpConfig = getGcpConfig(env);

        if (!gcpConfig.corpusId) {
            return errorResponse(500, 'Vertex AI RAG not configured');
        }

        // Fetch all RAG files with pagination
        const allFiles = [];
        let pageToken = null;
        const pageSize = 100;

        do {
            const result = await listRagFiles(env, pageSize, pageToken);
            allFiles.push(...result.files);
            pageToken = result.nextPageToken;
        } while (pageToken);

        // Calculate stats
        const totalSize = allFiles.reduce((sum, f) => sum + (parseInt(f.sizeBytes) || 0), 0);

        // Sort by create time descending
        allFiles.sort((a, b) => {
            const dateA = new Date(a.createTime || 0);
            const dateB = new Date(b.createTime || 0);
            return dateB - dateA;
        });

        return new Response(JSON.stringify({
            files: allFiles,
            stats: {
                totalFiles: allFiles.length,
                totalSizeBytes: totalSize,
                totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
            },
            corpus: {
                projectId: gcpConfig.projectId,
                location: gcpConfig.location,
                corpusId: gcpConfig.corpusId,
            },
        }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });

    } catch (err) {
        console.error('RAG files list error:', err);
        return errorResponse(500, `Failed to list RAG files: ${err.message}`);
    }
}

function errorResponse(status, message) {
    return new Response(JSON.stringify({ error: message }), {
        status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
}

