/**
 * Protocol Rules Routes
 * 协议规则透明化 API：公开规则、AI Prompt、社区反馈
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { query, queryOne, queryMany } from '../db/client.js';
import { verifyUserSession } from '../lib/auth.js';
import { AppError, ERROR_CODES } from '../lib/errors.js';

// ============================================
// Types
// ============================================

interface ProtocolRule {
  id: string;
  rule_key: string;
  version: number;
  title: string;
  content_md: string;
  change_summary: string | null;
  is_current: boolean;
  created_at: Date;
}

interface PromptTemplate {
  id: string;
  prompt_key: string;
  version: number;
  title: string;
  template_md: string;
  variables: string[];
  is_current: boolean;
  created_at: Date;
}

interface FeedbackRow {
  id: string;
  rule_id: string;
  user_id: string;
  feedback_type: string;
  content: string;
  upvotes: number;
  downvotes: number;
  status: string;
  created_at: Date;
}

// ============================================
// Routes
// ============================================

export async function protocolRulesRoutes(fastify: FastifyInstance): Promise<void> {

  // ============================================
  // GET /v1/protocol/rules — 公开：获取所有当前规则
  // ============================================
  fastify.get('/v1/protocol/rules', async (_request: FastifyRequest, reply: FastifyReply) => {
    const rules = await queryMany<ProtocolRule>(
      `SELECT id, rule_key, version, title, content_md, change_summary, is_current, created_at
       FROM protocol_rules WHERE is_current = TRUE ORDER BY rule_key`
    );

    return reply.send({ success: true, data: { rules } });
  });

  // ============================================
  // GET /v1/protocol/rules/:key — 公开：获取规则 + 版本历史
  // ============================================
  fastify.get('/v1/protocol/rules/:key', async (request: FastifyRequest, reply: FastifyReply) => {
    const { key } = request.params as { key: string };

    const current = await queryOne<ProtocolRule>(
      `SELECT * FROM protocol_rules WHERE rule_key = $1 AND is_current = TRUE`,
      [key]
    );
    if (!current) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Rule not found', 404);
    }

    const versions = await queryMany<{ version: number; change_summary: string | null; created_at: Date }>(
      `SELECT version, change_summary, created_at
       FROM protocol_rules WHERE rule_key = $1 ORDER BY version DESC`,
      [key]
    );

    return reply.send({ success: true, data: { rule: current, versions } });
  });

  // ============================================
  // GET /v1/protocol/rules/:key/version/:v — 公开：获取指定版本
  // ============================================
  fastify.get('/v1/protocol/rules/:key/version/:v', async (request: FastifyRequest, reply: FastifyReply) => {
    const { key, v } = request.params as { key: string; v: string };
    const version = parseInt(v, 10);

    const rule = await queryOne<ProtocolRule>(
      `SELECT * FROM protocol_rules WHERE rule_key = $1 AND version = $2`,
      [key, version]
    );
    if (!rule) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Rule version not found', 404);
    }

    return reply.send({ success: true, data: { rule } });
  });

  // ============================================
  // GET /v1/protocol/prompts — 公开：获取所有 AI Prompt 模板
  // ============================================
  fastify.get('/v1/protocol/prompts', async (_request: FastifyRequest, reply: FastifyReply) => {
    const prompts = await queryMany<PromptTemplate>(
      `SELECT id, prompt_key, version, title, template_md, variables, is_current, created_at
       FROM ai_prompt_templates WHERE is_current = TRUE ORDER BY prompt_key`
    );

    return reply.send({ success: true, data: { prompts } });
  });

  // ============================================
  // GET /v1/protocol/prompts/:key — 公开：获取 Prompt + 版本历史
  // ============================================
  fastify.get('/v1/protocol/prompts/:key', async (request: FastifyRequest, reply: FastifyReply) => {
    const { key } = request.params as { key: string };

    const current = await queryOne<PromptTemplate>(
      `SELECT * FROM ai_prompt_templates WHERE prompt_key = $1 AND is_current = TRUE`,
      [key]
    );
    if (!current) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Prompt template not found', 404);
    }

    const versions = await queryMany<{ version: number; change_summary: string | null; created_at: Date }>(
      `SELECT version, change_summary, created_at
       FROM ai_prompt_templates WHERE prompt_key = $1 ORDER BY version DESC`,
      [key]
    );

    return reply.send({ success: true, data: { prompt: current, versions } });
  });

  // ============================================
  // GET /v1/protocol/rules/:ruleId/feedback — 公开：查看反馈列表
  // ============================================
  fastify.get('/v1/protocol/rules/:ruleId/feedback', async (request: FastifyRequest, reply: FastifyReply) => {
    const { ruleId } = request.params as { ruleId: string };

    const feedback = await queryMany<FeedbackRow>(
      `SELECT rf.*, op.display_name as author_name
       FROM rule_feedback rf
       LEFT JOIN owner_profiles op ON op.user_id = rf.user_id
       WHERE rf.rule_id = $1
       ORDER BY (rf.upvotes - rf.downvotes) DESC, rf.created_at DESC
       LIMIT 100`,
      [ruleId]
    );

    return reply.send({ success: true, data: { feedback } });
  });

  // ============================================
  // POST /v1/protocol/rules/:ruleId/feedback — 登录：提交反馈
  // ============================================
  fastify.post('/v1/protocol/rules/:ruleId/feedback', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await verifyUserSession(request);
    if (!session) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Login required', 401);
    }

    const { ruleId } = request.params as { ruleId: string };
    const schema = z.object({
      feedback_type: z.enum(['suggestion', 'question', 'concern']),
      content: z.string().min(10).max(2000),
    });

    const parseResult = schema.safeParse(request.body);
    if (!parseResult.success) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Invalid feedback: content (10-2000 chars) required', 400);
    }

    // Verify rule exists
    const rule = await queryOne<{ id: string }>(`SELECT id FROM protocol_rules WHERE id = $1`, [ruleId]);
    if (!rule) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Rule not found', 404);
    }

    const feedback = await queryOne<FeedbackRow>(
      `INSERT INTO rule_feedback (rule_id, user_id, feedback_type, content)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [ruleId, session.userId, parseResult.data.feedback_type, parseResult.data.content]
    );

    return reply.status(201).send({ success: true, data: { feedback } });
  });

  // ============================================
  // POST /v1/protocol/feedback/:id/vote — 登录：投票
  // ============================================
  fastify.post('/v1/protocol/feedback/:id/vote', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await verifyUserSession(request);
    if (!session) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Login required', 401);
    }

    const { id } = request.params as { id: string };
    const schema = z.object({
      vote: z.number().int().refine(v => v === 1 || v === -1, { message: 'Vote must be 1 or -1' }),
    });

    const parseResult = schema.safeParse(request.body);
    if (!parseResult.success) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Vote must be 1 or -1', 400);
    }

    const vote = parseResult.data.vote;

    // Upsert vote
    await query(
      `INSERT INTO rule_feedback_votes (feedback_id, user_id, vote)
       VALUES ($1, $2, $3)
       ON CONFLICT (feedback_id, user_id) DO UPDATE SET vote = $3, created_at = now()`,
      [id, session.userId, vote]
    );

    // Recalculate upvotes/downvotes
    await query(
      `UPDATE rule_feedback SET
        upvotes = (SELECT COUNT(*) FROM rule_feedback_votes WHERE feedback_id = $1 AND vote = 1),
        downvotes = (SELECT COUNT(*) FROM rule_feedback_votes WHERE feedback_id = $1 AND vote = -1)
       WHERE id = $1`,
      [id]
    );

    return reply.send({ success: true, data: { voted: vote } });
  });
}
