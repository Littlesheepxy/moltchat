/**
 * Discovery & Search Routes
 * Agent 发现和匹配系统
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { query, queryOne, queryMany } from '../db/client.js';
import { verifyAgentToken } from '../lib/auth.js';
import { AppError, ERROR_CODES, successResponse } from '../lib/errors.js';

// ============================================
// Request Schemas
// ============================================

const searchAgentsSchema = z.object({
  query: z.string().min(1).max(500).optional(),
  topics: z.union([z.string(), z.array(z.string())]).transform(val => 
    typeof val === 'string' ? [val] : val
  ).optional(),
  limit: z.coerce.number().min(1).max(50).default(20),
  offset: z.coerce.number().min(0).default(0),
  agent_id: z.string().uuid().optional(), // For dev mode bypass
});

const similarAgentsSchema = z.object({
  agent_id: z.string().uuid().optional(), // 如果不提供，使用当前 agent
  limit: z.coerce.number().min(1).max(50).default(10),
});

// ============================================
// Type Definitions
// ============================================

interface AgentDiscoveryResult {
  agent_id: string;
  agent_name: string;
  agent_handle: string | null;
  agent_role: string | null;
  agent_persona_md: string | null;
  focus_topics: string[];
  owner_display_name: string | null;
  owner_background_md: string;
  owner_topics: string[];
  relevance_score: number;
}

// ============================================
// Routes
// ============================================

export async function discoverRoutes(fastify: FastifyInstance): Promise<void> {
  
  /**
   * GET /v1/discover/agents/search
   * 搜索 Agent 和 Owner（全文搜索 + 话题匹配）
   */
  fastify.get('/v1/discover/agents/search', async (request: FastifyRequest, reply: FastifyReply) => {
    const authResult = await verifyAgentToken(request);
    if (!authResult) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Authentication required', 401);
    }

    const parseResult = searchAgentsSchema.safeParse(request.query);
    if (!parseResult.success) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Invalid search parameters', 400);
    }

    const { query: searchQuery, topics, limit, offset } = parseResult.data;

    // 构建搜索 SQL
    let sql = `
      SELECT 
        a.id as agent_id,
        a.name as agent_name,
        a.twitter_handle as agent_handle,
        aoc.agent_role,
        aoc.agent_persona_md,
        COALESCE(aoc.focus_topics, ARRAY[]::text[]) as focus_topics,
        op.display_name as owner_display_name,
        op.background_md as owner_background_md,
        COALESCE(op.topics_of_interest, ARRAY[]::text[]) as owner_topics,
        0 as relevance_score
      FROM agents a
      JOIN owner_profiles op ON a.owner_user_id = op.user_id
      LEFT JOIN agent_owner_config aoc ON a.id = aoc.agent_id AND aoc.owner_id = op.id
      WHERE a.status = 'claimed'
        AND a.id != $1
    `;

    const params: any[] = [authResult.agentId];
    let paramIndex = 2;

    // 全文搜索
    if (searchQuery) {
      sql += `
        AND (
          a.name ILIKE $${paramIndex}
          OR op.background_md ILIKE $${paramIndex}
          OR aoc.agent_role ILIKE $${paramIndex}
          OR aoc.agent_persona_md ILIKE $${paramIndex}
        )
      `;
      params.push(`%${searchQuery}%`);
      paramIndex++;
    }

    // 话题匹配
    if (topics && topics.length > 0) {
      sql += `
        AND (
          op.topics_of_interest && $${paramIndex}::text[]
          OR aoc.focus_topics && $${paramIndex}::text[]
        )
      `;
      params.push(topics);
      paramIndex++;
    }

    sql += `
      ORDER BY a.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limit, offset);

    const results = await queryMany<AgentDiscoveryResult>(sql, params);

    // 计算相关度分数
    const scoredResults = results.map(r => {
      let score = 0;
      
      // 话题匹配加分
      if (topics && topics.length > 0) {
        const matchedTopics = [
          ...r.owner_topics.filter(t => topics.includes(t)),
          ...r.focus_topics.filter(t => topics.includes(t)),
        ];
        score += matchedTopics.length * 10;
      }

      // 资料完整度加分
      if (r.agent_role && r.agent_role.length >= 20) score += 5;
      if (r.focus_topics.length >= 3) score += 5;
      if (r.owner_background_md.length >= 50) score += 5;
      if (r.owner_topics.length >= 3) score += 5;

      return { ...r, relevance_score: score };
    });

    // 按相关度排序
    scoredResults.sort((a, b) => b.relevance_score - a.relevance_score);

    return reply.send(
      successResponse({
        agents: scoredResults.map(r => ({
          agent: {
            id: r.agent_id,
            name: r.agent_name,
            handle: r.agent_handle,
            role: r.agent_role,
            persona: r.agent_persona_md,
            specialties: r.focus_topics,
          },
          owner: {
            name: r.owner_display_name,
            background: r.owner_background_md,
            topics: r.owner_topics,
          },
          relevance_score: r.relevance_score,
        })),
        total: scoredResults.length,
        query: searchQuery || null,
        topics: topics || [],
      })
    );
  });

  /**
   * GET /v1/discover/agents/similar
   * 根据当前 Agent 的话题找相似的 Agent
   */
  fastify.get('/v1/discover/agents/similar', async (request: FastifyRequest, reply: FastifyReply) => {
    const authResult = await verifyAgentToken(request);
    if (!authResult) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Authentication required', 401);
    }

    const parseResult = similarAgentsSchema.safeParse(request.query);
    if (!parseResult.success) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Invalid parameters', 400);
    }

    const { agent_id, limit } = parseResult.data;
    const targetAgentId = agent_id || authResult.agentId;

    // 获取目标 Agent 的话题
    const targetAgent = await queryOne<{
      focus_topics: string[];
      owner_topics: string[];
    }>(
      `SELECT 
        COALESCE(aoc.focus_topics, ARRAY[]::text[]) as focus_topics,
        COALESCE(op.topics_of_interest, ARRAY[]::text[]) as owner_topics
      FROM agents a
      JOIN owner_profiles op ON a.owner_user_id = op.user_id
      LEFT JOIN agent_owner_config aoc ON a.id = aoc.agent_id AND aoc.owner_id = op.id
      WHERE a.id = $1`,
      [targetAgentId]
    );

    if (!targetAgent) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Agent not found', 404);
    }

    const allTopics = [...targetAgent.focus_topics, ...targetAgent.owner_topics];
    if (allTopics.length === 0) {
      return reply.send(
        successResponse({
          agents: [],
          message: 'No topics found for similarity matching. Please complete your profile.',
        })
      );
    }

    // 查找相似 Agent（话题重叠）
    const results = await queryMany<AgentDiscoveryResult>(
      `SELECT 
        a.id as agent_id,
        a.name as agent_name,
        a.twitter_handle as agent_handle,
        aoc.agent_role,
        aoc.agent_persona_md,
        COALESCE(aoc.focus_topics, ARRAY[]::text[]) as focus_topics,
        op.display_name as owner_display_name,
        op.background_md as owner_background_md,
        COALESCE(op.topics_of_interest, ARRAY[]::text[]) as owner_topics
      FROM agents a
      JOIN owner_profiles op ON a.owner_user_id = op.user_id
      LEFT JOIN agent_owner_config aoc ON a.id = aoc.agent_id AND aoc.owner_id = op.id
      WHERE a.status = 'claimed'
        AND a.id != $1
        AND (
          op.topics_of_interest && $2::text[]
          OR aoc.focus_topics && $2::text[]
        )
      LIMIT $3`,
      [targetAgentId, allTopics, limit]
    );

    // 计算相似度分数（共同话题数量）
    const scoredResults = results.map(r => {
      const commonTopics = [
        ...r.owner_topics.filter(t => allTopics.includes(t)),
        ...r.focus_topics.filter(t => allTopics.includes(t)),
      ];
      const uniqueCommonTopics = [...new Set(commonTopics)];
      
      return {
        ...r,
        relevance_score: uniqueCommonTopics.length,
        common_topics: uniqueCommonTopics,
      };
    });

    scoredResults.sort((a, b) => b.relevance_score - a.relevance_score);

    return reply.send(
      successResponse({
        agents: scoredResults.map(r => ({
          agent: {
            id: r.agent_id,
            name: r.agent_name,
            handle: r.agent_handle,
            role: r.agent_role,
            specialties: r.focus_topics,
          },
          owner: {
            name: r.owner_display_name,
            background: r.owner_background_md,
            topics: r.owner_topics,
          },
          similarity_score: r.relevance_score,
          common_topics: r.common_topics,
        })),
        your_topics: allTopics,
      })
    );
  });

  /**
   * GET /v1/discover/agents/by-topic/:topic
   * 根据单个话题查找所有相关 Agent
   */
  fastify.get('/v1/discover/agents/by-topic/:topic', async (request: FastifyRequest, reply: FastifyReply) => {
    const authResult = await verifyAgentToken(request);
    if (!authResult) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Authentication required', 401);
    }

    const { topic } = request.params as { topic: string };
    const { limit = 20 } = request.query as { limit?: number };

    const results = await queryMany<AgentDiscoveryResult>(
      `SELECT 
        a.id as agent_id,
        a.name as agent_name,
        a.twitter_handle as agent_handle,
        aoc.agent_role,
        aoc.agent_persona_md,
        COALESCE(aoc.focus_topics, ARRAY[]::text[]) as focus_topics,
        op.display_name as owner_display_name,
        op.background_md as owner_background_md,
        COALESCE(op.topics_of_interest, ARRAY[]::text[]) as owner_topics
      FROM agents a
      JOIN owner_profiles op ON a.owner_user_id = op.user_id
      LEFT JOIN agent_owner_config aoc ON a.id = aoc.agent_id AND aoc.owner_id = op.id
      WHERE a.status = 'claimed'
        AND a.id != $1
        AND (
          $2 = ANY(op.topics_of_interest)
          OR $2 = ANY(aoc.focus_topics)
        )
      ORDER BY a.created_at DESC
      LIMIT $3`,
      [authResult.agentId, topic, limit]
    );

    return reply.send(
      successResponse({
        topic,
        agents: results.map(r => ({
          agent: {
            id: r.agent_id,
            name: r.agent_name,
            handle: r.agent_handle,
            role: r.agent_role,
            specialties: r.focus_topics,
          },
          owner: {
            name: r.owner_display_name,
            background: r.owner_background_md,
            topics: r.owner_topics,
          },
        })),
        total: results.length,
      })
    );
  });

  /**
   * GET /v1/discover/topics/trending
   * 获取热门话题（基于使用频率）
   */
  fastify.get('/v1/discover/topics/trending', async (request: FastifyRequest, reply: FastifyReply) => {
    const { limit = 20 } = request.query as { limit?: number };

    const results = await queryMany<{ topic: string; count: number }>(
      `SELECT 
        unnest(array_cat(
          COALESCE(op.topics_of_interest, ARRAY[]::text[]),
          COALESCE(aoc.focus_topics, ARRAY[]::text[])
        )) as topic,
        COUNT(*) as count
      FROM agents a
      JOIN owner_profiles op ON a.owner_user_id = op.user_id
      LEFT JOIN agent_owner_config aoc ON a.id = aoc.agent_id AND aoc.owner_id = op.id
      WHERE a.status = 'claimed'
      GROUP BY topic
      ORDER BY count DESC, topic ASC
      LIMIT $1`,
      [limit]
    );

    return reply.send(
      successResponse({
        topics: results.map(r => ({
          name: r.topic,
          agent_count: r.count,
        })),
      })
    );
  });
}
