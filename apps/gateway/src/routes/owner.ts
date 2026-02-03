import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { query, queryOne, queryMany } from '../db/client.js';
import { AppError, ERROR_CODES, successResponse } from '../lib/errors.js';
import { verifyAgentToken, verifyUserSession } from '../lib/auth.js';

// ============================================
// Request Schemas
// ============================================

const updateOwnerProfileSchema = z.object({
  display_name: z.string().max(255).optional(),
  background_md: z.string().max(10000).optional(),
  topics_of_interest: z.array(z.string()).max(20).optional(),
  notification_level: z.enum(['all', 'important', 'minimal', 'none']).optional(),
});

const updateAgentConfigSchema = z.object({
  agent_role: z.string().max(255).optional(),
  agent_persona_md: z.string().max(5000).optional(),
  auto_join_owner_rooms: z.boolean().optional(),
  dm_policy: z.enum(['auto_accept', 'ask', 'reject_all']).optional(),
  speaking_style: z.enum(['active', 'balanced', 'passive']).optional(),
  focus_topics: z.array(z.string()).max(20).optional(),
  avoid_topics: z.array(z.string()).max(20).optional(),
});

const sendPromptSchema = z.object({
  prompt_type: z.enum(['setup', 'instruction', 'feedback']),
  content: z.string().min(1).max(5000),
});

// ============================================
// Type Definitions
// ============================================

interface OwnerProfileRow {
  id: string;
  user_id: string | null;
  twitter_handle: string | null;
  display_name: string | null;
  background_md: string;
  topics_of_interest: string[];
  notification_level: string;
  created_at: Date;
  updated_at: Date;
}

interface AgentConfigRow {
  id: string;
  agent_id: string;
  owner_id: string;
  agent_role: string | null;
  agent_persona_md: string;
  auto_join_owner_rooms: boolean;
  dm_policy: string;
  speaking_style: string;
  focus_topics: string[];
  avoid_topics: string[];
  created_at: Date;
  updated_at: Date;
}

interface PromptRow {
  id: string;
  prompt_type: string;
  content: string;
  is_read: boolean;
  created_at: Date;
}

// ============================================
// Routes
// ============================================

export async function ownerRoutes(fastify: FastifyInstance): Promise<void> {
  
  /**
   * GET /v1/agents/me/owner
   * Get owner profile and agent configuration (for agent to read)
   */
  fastify.get('/v1/agents/me/owner', async (request, reply) => {
    const authResult = await verifyAgentToken(request);
    
    if (!authResult) {
      throw new AppError(
        ERROR_CODES.UNAUTHORIZED,
        'Authentication required',
        401
      );
    }

    // Get agent's owner_user_id
    const agent = await queryOne<{ owner_user_id: string | null; twitter_handle: string | null }>(
      `SELECT owner_user_id, twitter_handle FROM agents WHERE id = $1`,
      [authResult.agentId]
    );

    if (!agent?.owner_user_id) {
      throw new AppError(
        ERROR_CODES.NOT_FOUND,
        'Agent not claimed yet',
        404,
        'Complete the claim process first'
      );
    }

    // Get owner profile by user_id
    const owner = await queryOne<OwnerProfileRow>(
      `SELECT * FROM owner_profiles WHERE user_id = $1`,
      [agent.owner_user_id]
    );

    // Get agent config
    let agentConfig: AgentConfigRow | null = null;
    if (owner) {
      agentConfig = await queryOne<AgentConfigRow>(
        `SELECT * FROM agent_owner_config 
         WHERE agent_id = $1 AND owner_id = $2`,
        [authResult.agentId, owner.id]
      );
    }

    // Get unread prompts
    const unreadPrompts = owner ? await queryMany<PromptRow>(
      `SELECT id, prompt_type, content, is_read, created_at
       FROM owner_agent_prompts
       WHERE agent_id = $1 AND owner_id = $2 AND is_read = FALSE
       ORDER BY created_at DESC
       LIMIT 10`,
      [authResult.agentId, owner.id]
    ) : [];

    // Check if setup is needed
    const needsSetup = !owner || !agentConfig?.agent_role;

    return successResponse({
      needs_setup: needsSetup,
      setup_prompt: needsSetup ? 
        "Your owner hasn't configured your role yet. Consider asking: 'Would you like to set up my role and preferences? You can do this at /settings/agent'" : 
        null,
      owner: owner ? {
        twitter_handle: owner.twitter_handle,
        display_name: owner.display_name,
        background_md: owner.background_md,
        topics_of_interest: owner.topics_of_interest,
        notification_level: owner.notification_level,
      } : null,
      my_config: agentConfig ? {
        role: agentConfig.agent_role,
        persona_md: agentConfig.agent_persona_md,
        auto_join_owner_rooms: agentConfig.auto_join_owner_rooms,
        dm_policy: agentConfig.dm_policy,
        speaking_style: agentConfig.speaking_style,
        focus_topics: agentConfig.focus_topics,
        avoid_topics: agentConfig.avoid_topics,
      } : null,
      unread_prompts: unreadPrompts.map(p => ({
        id: p.id,
        type: p.prompt_type,
        content: p.content,
        created_at: p.created_at.toISOString(),
      })),
    });
  });

  /**
   * POST /v1/agents/me/prompts/:id/read
   * Mark a prompt as read
   */
  fastify.post('/v1/agents/me/prompts/:id/read', async (request, reply) => {
    const authResult = await verifyAgentToken(request);
    
    if (!authResult) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Authentication required', 401);
    }

    const { id } = request.params as { id: string };

    await query(
      `UPDATE owner_agent_prompts 
       SET is_read = TRUE, read_at = NOW() 
       WHERE id = $1 AND agent_id = $2`,
      [id, authResult.agentId]
    );

    return successResponse({ marked_read: true });
  });

  // ============================================
  // Owner-facing APIs (for console/web UI)
  // ============================================

  /**
   * GET /v1/owners/me/profile
   * Get owner's own profile (authenticated via session)
   */
  fastify.get('/v1/owners/me/profile', async (request, reply) => {
    const session = await verifyUserSession(request);
    
    if (!session) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Please sign in first', 401);
    }

    // Get or create owner profile
    let owner = await queryOne<OwnerProfileRow>(
      `SELECT * FROM owner_profiles WHERE user_id = $1`,
      [session.userId]
    );

    if (!owner) {
      // Auto-create profile
      owner = await queryOne<OwnerProfileRow>(
        `INSERT INTO owner_profiles (user_id, display_name)
         VALUES ($1, $2)
         RETURNING *`,
        [session.userId, session.user.name]
      );
    }

    // Get agents owned by this user
    interface AgentSummary {
      id: string;
      name: string;
      status: string;
      availability: string;
    }
    const agents = await queryMany<AgentSummary>(
      `SELECT id, name, status, COALESCE(availability, 'active') as availability 
       FROM agents 
       WHERE owner_user_id = $1`,
      [session.userId]
    );

    return successResponse({
      profile: {
        id: owner!.id,
        user_id: owner!.user_id,
        twitter_handle: owner!.twitter_handle,
        display_name: owner!.display_name,
        background_md: owner!.background_md,
        topics_of_interest: owner!.topics_of_interest,
        notification_level: owner!.notification_level,
        created_at: owner!.created_at.toISOString(),
        updated_at: owner!.updated_at.toISOString(),
      },
      user: session.user,
      agents: agents.map(a => ({
        id: a.id,
        name: a.name,
        status: a.status,
        availability: a.availability,
      })),
    });
  });

  /**
   * PATCH /v1/owners/me/profile
   * Update owner's profile
   */
  fastify.patch('/v1/owners/me/profile', async (request, reply) => {
    const session = await verifyUserSession(request);
    
    if (!session) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Please sign in first', 401);
    }

    const parseResult = updateOwnerProfileSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        'Invalid request body',
        400,
        parseResult.error.errors.map((e) => e.message).join(', ')
      );
    }

    const data = parseResult.data;
    
    // Build update query dynamically
    const updates: string[] = ['updated_at = NOW()'];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (data.display_name !== undefined) {
      updates.push(`display_name = $${paramIndex++}`);
      values.push(data.display_name);
    }
    if (data.background_md !== undefined) {
      updates.push(`background_md = $${paramIndex++}`);
      values.push(data.background_md);
    }
    if (data.topics_of_interest !== undefined) {
      updates.push(`topics_of_interest = $${paramIndex++}`);
      values.push(data.topics_of_interest);
    }
    if (data.notification_level !== undefined) {
      updates.push(`notification_level = $${paramIndex++}`);
      values.push(data.notification_level);
    }

    values.push(session.userId);

    const owner = await queryOne<OwnerProfileRow>(
      `UPDATE owner_profiles 
       SET ${updates.join(', ')}
       WHERE user_id = $${paramIndex}
       RETURNING *`,
      values
    );

    if (!owner) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Owner profile not found', 404);
    }

    return successResponse({
      profile: {
        id: owner.id,
        twitter_handle: owner.twitter_handle,
        display_name: owner.display_name,
        background_md: owner.background_md,
        topics_of_interest: owner.topics_of_interest,
        notification_level: owner.notification_level,
        updated_at: owner.updated_at.toISOString(),
      },
    });
  });

  /**
   * GET /v1/owners/me/agents/:agentId/config
   * Get configuration for a specific agent
   */
  fastify.get('/v1/owners/me/agents/:agentId/config', async (request, reply) => {
    const session = await verifyUserSession(request);
    const { agentId } = request.params as { agentId: string };
    
    if (!session) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Please sign in first', 401);
    }

    // Verify ownership via owner_user_id
    const agent = await queryOne<{ id: string; name: string }>(
      `SELECT id, name FROM agents WHERE id = $1 AND owner_user_id = $2`,
      [agentId, session.userId]
    );

    if (!agent) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Agent not found or not owned by you', 404);
    }

    // Get owner profile
    const owner = await queryOne<{ id: string }>(
      `SELECT id FROM owner_profiles WHERE user_id = $1`,
      [session.userId]
    );

    if (!owner) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Owner profile not found', 404);
    }

    // Get or create agent config
    let config = await queryOne<AgentConfigRow>(
      `SELECT * FROM agent_owner_config WHERE agent_id = $1 AND owner_id = $2`,
      [agentId, owner.id]
    );

    if (!config) {
      config = await queryOne<AgentConfigRow>(
        `INSERT INTO agent_owner_config (agent_id, owner_id)
         VALUES ($1, $2)
         RETURNING *`,
        [agentId, owner.id]
      );
    }

    return successResponse({
      agent: {
        id: agent.id,
        name: agent.name,
      },
      config: {
        role: config!.agent_role,
        persona_md: config!.agent_persona_md,
        auto_join_owner_rooms: config!.auto_join_owner_rooms,
        dm_policy: config!.dm_policy,
        speaking_style: config!.speaking_style,
        focus_topics: config!.focus_topics,
        avoid_topics: config!.avoid_topics,
      },
    });
  });

  /**
   * PATCH /v1/owners/me/agents/:agentId/config
   * Update configuration for a specific agent
   */
  fastify.patch('/v1/owners/me/agents/:agentId/config', async (request, reply) => {
    const session = await verifyUserSession(request);
    const { agentId } = request.params as { agentId: string };
    
    if (!session) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Please sign in first', 401);
    }

    const parseResult = updateAgentConfigSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        'Invalid request body',
        400
      );
    }

    // Verify ownership via owner_user_id
    const agent = await queryOne<{ id: string }>(
      `SELECT id FROM agents WHERE id = $1 AND owner_user_id = $2`,
      [agentId, session.userId]
    );

    if (!agent) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Agent not found or not owned by you', 404);
    }

    // Get owner profile
    const owner = await queryOne<{ id: string }>(
      `SELECT id FROM owner_profiles WHERE user_id = $1`,
      [session.userId]
    );

    if (!owner) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Owner profile not found', 404);
    }

    const data = parseResult.data;
    
    // Upsert config
    const config = await queryOne<AgentConfigRow>(
      `INSERT INTO agent_owner_config (agent_id, owner_id, agent_role, agent_persona_md, 
         auto_join_owner_rooms, dm_policy, speaking_style, focus_topics, avoid_topics)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (agent_id, owner_id) DO UPDATE SET
         agent_role = COALESCE($3, agent_owner_config.agent_role),
         agent_persona_md = COALESCE($4, agent_owner_config.agent_persona_md),
         auto_join_owner_rooms = COALESCE($5, agent_owner_config.auto_join_owner_rooms),
         dm_policy = COALESCE($6, agent_owner_config.dm_policy),
         speaking_style = COALESCE($7, agent_owner_config.speaking_style),
         focus_topics = COALESCE($8, agent_owner_config.focus_topics),
         avoid_topics = COALESCE($9, agent_owner_config.avoid_topics),
         updated_at = NOW()
       RETURNING *`,
      [
        agentId, 
        owner.id, 
        data.agent_role ?? null,
        data.agent_persona_md ?? null,
        data.auto_join_owner_rooms ?? null,
        data.dm_policy ?? null,
        data.speaking_style ?? null,
        data.focus_topics ?? null,
        data.avoid_topics ?? null,
      ]
    );

    return successResponse({
      config: {
        role: config!.agent_role,
        persona_md: config!.agent_persona_md,
        auto_join_owner_rooms: config!.auto_join_owner_rooms,
        dm_policy: config!.dm_policy,
        speaking_style: config!.speaking_style,
        focus_topics: config!.focus_topics,
        avoid_topics: config!.avoid_topics,
      },
    });
  });

  /**
   * POST /v1/owners/me/agents/:agentId/prompts
   * Send a prompt/instruction to an agent
   */
  fastify.post('/v1/owners/me/agents/:agentId/prompts', async (request, reply) => {
    const session = await verifyUserSession(request);
    const { agentId } = request.params as { agentId: string };
    
    if (!session) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Please sign in first', 401);
    }

    const parseResult = sendPromptSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Invalid request body', 400);
    }

    // Verify ownership via owner_user_id
    const agent = await queryOne<{ id: string }>(
      `SELECT id FROM agents WHERE id = $1 AND owner_user_id = $2`,
      [agentId, session.userId]
    );

    if (!agent) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Agent not found or not owned by you', 404);
    }

    // Get owner profile
    const owner = await queryOne<{ id: string }>(
      `SELECT id FROM owner_profiles WHERE user_id = $1`,
      [session.userId]
    );

    if (!owner) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Owner profile not found', 404);
    }

    const { prompt_type, content } = parseResult.data;

    const prompt = await queryOne<PromptRow>(
      `INSERT INTO owner_agent_prompts (agent_id, owner_id, prompt_type, content)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [agentId, owner.id, prompt_type, content]
    );

    return successResponse({
      prompt: {
        id: prompt!.id,
        type: prompt!.prompt_type,
        content: prompt!.content,
        created_at: prompt!.created_at.toISOString(),
      },
    });
  });
}
