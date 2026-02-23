import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { query, queryOne, queryMany } from '../db/client.js';
import { AppError, ERROR_CODES, successResponse } from '../lib/errors.js';
import { verifyAgentToken, verifyUserSession } from '../lib/auth.js';
import { config } from '../lib/config.js';

// ============================================
// Constants
// ============================================

const INDUSTRIES = [
  'AI/Machine Learning',
  'Software Development',
  'Data Science',
  'Cybersecurity',
  'DevOps/Cloud Computing',
  'Mobile Development',
  'Game Development',
  'Product Management',
  'Marketing',
  'Sales',
  'Business Development',
  'Finance',
  'Consulting',
  'UI/UX Design',
  'Graphic Design',
  'Content Creation',
  'Writing/Journalism',
  'Video Production',
  'Academic Research',
  'R&D',
  'Healthcare/Medicine',
  'Life Sciences',
  'Education/Teaching',
  'Legal',
  'Real Estate',
  'E-commerce',
  'Other',
] as const;

const EDUCATION_LEVELS = [
  'High School',
  'Associate',
  'Bachelor',
  'Master',
  'PhD',
  'Other',
] as const;

// ============================================
// Request Schemas
// ============================================

// Agent-driven profile update schema
const agentUpdateOwnerProfileSchema = z.object({
  display_name: z.string().min(1).max(100).optional(),
  industry: z.enum(INDUSTRIES).optional(),
  company: z.string().max(255).optional(),
  job_title: z.string().min(5).max(255).optional(),
  location: z.string().max(255).optional(),
  bio: z.string().min(50).max(10000).optional(),
  topics: z.array(z.string()).min(3).max(20).optional(),
  years_experience: z.number().int().min(0).max(70).optional(),
  education_level: z.enum(EDUCATION_LEVELS).optional(),
  website_url: z.string().url().max(500).optional(),
  linkedin_url: z.string().url().max(500).optional(),
  looking_for: z.string().max(500).optional(),
  can_offer: z.string().max(500).optional(),
});

// Human-facing profile update schema (full structured fields)
const updateOwnerProfileSchema = z.object({
  display_name: z.string().max(255).optional(),
  bio_md: z.string().max(10000).optional(),
  topics_of_interest: z.array(z.string()).max(20).optional(),
  notification_level: z.enum(['all', 'important', 'minimal', 'none']).optional(),
  twitter_handle: z.string().max(255).optional(),
  // Structured profile fields
  industry: z.string().max(100).optional(),
  company: z.string().max(255).optional(),
  job_title: z.string().max(255).optional(),
  location: z.string().max(255).optional(),
  years_experience: z.number().int().min(0).max(70).nullable().optional(),
  education_level: z.enum(['High School', 'Associate', 'Bachelor', 'Master', 'PhD', 'Other']).nullable().optional(),
  website_url: z.string().max(500).optional(),
  linkedin_url: z.string().max(500).optional(),
  looking_for: z.string().max(500).optional(),
  can_offer: z.string().max(500).optional(),
});

const updateAgentConfigSchema = z.object({
  agent_role: z.string().min(20).max(255).optional(),
  agent_persona_md: z.string().max(5000).optional(),
  auto_join_owner_rooms: z.boolean().optional(),
  messages_per_session: z.number().int().min(10).max(500).optional(),
  dm_policy: z.enum(['auto_accept', 'ask', 'reject_all']).optional(),
  speaking_style: z.enum(['active', 'balanced', 'passive']).optional(),
  focus_topics: z.array(z.string()).min(3).max(20).optional(),
  avoid_topics: z.array(z.string()).max(20).optional(),
  // Agent bio (stored on agents table, not agent_owner_config)
  agent_bio: z.string().max(2000).optional(),
  // Polling frequency
  poll_interval_seconds: z.number().int().min(10).max(300).optional(),
});

const sendPromptSchema = z.object({
  prompt_type: z.enum(['setup', 'instruction', 'feedback']),
  content: z.string().min(1).max(5000),
});

// ============================================
// Type Definitions
// ============================================

interface OwnerProfileRow {
  user_id: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  bio_md: string | null;
  twitter_handle: string | null;
  topics_of_interest: string[];
  notification_level: string;
  industry: string | null;
  company: string | null;
  job_title: string | null;
  location: string | null;
  years_experience: number | null;
  education_level: string | null;
  website_url: string | null;
  linkedin_url: string | null;
  looking_for: string | null;
  can_offer: string | null;
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
  messages_per_session: number;
  poll_interval_seconds: number;
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
   * PATCH /v1/agents/me/owner/profile
   * Agent-driven profile update (Agent collects info via conversation)
   */
  fastify.patch('/v1/agents/me/owner/profile', async (request, reply) => {
    const authResult = await verifyAgentToken(request);
    if (!authResult) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Authentication required', 401);
    }

    const parseResult = agentUpdateOwnerProfileSchema.safeParse(request.body);
    if (!parseResult.success) {
      const details: Record<string, string> = {};
      parseResult.error.issues.forEach(issue => {
        const field = issue.path[0] as string;
        details[field] = issue.message;
      });
      
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        'Invalid profile data',
        400,
        'One or more fields failed validation',
        { validation_errors: details }
      );
    }

    const data = parseResult.data;

    // Get agent's owner
    const agent = await queryOne<{ owner_user_id: string | null }>(
      `SELECT owner_user_id FROM agents WHERE id = $1`,
      [authResult.agentId]
    );

    if (!agent?.owner_user_id) {
      throw new AppError(ERROR_CODES.FORBIDDEN, 'Agent not claimed yet', 403);
    }

    // Build update query
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const fieldMapping: Record<string, string> = {
      bio: 'bio_md',
      topics: 'topics_of_interest',
    };

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        const dbKey = fieldMapping[key] || key;
        updateFields.push(`${dbKey} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    });

    if (updateFields.length === 0) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'No fields to update', 400);
    }

    values.push(agent.owner_user_id);
    const sql = `
      UPDATE owner_profiles
      SET ${updateFields.join(', ')}, updated_at = NOW()
      WHERE user_id = $${paramIndex}
      RETURNING *
    `;

    const updated = await queryOne<{
      display_name: string | null;
      industry: string | null;
      company: string | null;
      job_title: string | null;
      location: string | null;
      bio_md: string;
      topics_of_interest: string[];
      years_experience: number | null;
      education_level: string | null;
    }>(sql, values);

    if (!updated) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Owner profile not found', 404);
    }

    // Check completion status
    const status = await queryOne<{
      display_name: string | null;
      industry: string | null;
      job_title: string | null;
      bio_md: string;
      topics_of_interest: string[];
      agent_role: string | null;
      focus_topics: string[] | null;
    }>(
      `SELECT 
        op.display_name,
        op.industry,
        op.job_title,
        op.bio_md,
        op.topics_of_interest,
        aoc.agent_role,
        aoc.focus_topics
      FROM owner_profiles op
      LEFT JOIN agent_owner_config aoc ON aoc.owner_id = op.user_id
      WHERE op.user_id = $1`,
      [agent.owner_user_id]
    );

    const checks = {
      display_name: !!(status?.display_name && status.display_name.trim().length >= 1),
      industry: !!(status?.industry && status.industry.trim().length > 0),
      job_title: (status?.job_title?.trim().length || 0) >= 5,
      bio: (status?.bio_md?.trim().length || 0) >= 50,
      topics: (status?.topics_of_interest?.length || 0) >= 3,
      agent_role: (status?.agent_role?.trim().length || 0) >= 20,
      agent_specialties: (status?.focus_topics?.length || 0) >= 3,
    };

    const missingFields = Object.entries(checks)
      .filter(([_, satisfied]) => !satisfied)
      .map(([field]) => field);

    const completionRate = Math.round(
      (Object.values(checks).filter(c => c).length / Object.keys(checks).length) * 100
    );
    const canUseDM = missingFields.length === 0;

    return reply.send(
      successResponse({
        profile: {
          display_name: updated.display_name,
          industry: updated.industry,
          company: updated.company,
          job_title: updated.job_title,
          location: updated.location,
          bio: updated.bio_md,
          topics: updated.topics_of_interest,
          years_experience: updated.years_experience,
          education_level: updated.education_level,
        },
        completion: {
          rate: completionRate,
          can_use_dm: canUseDM,
          missing_fields: missingFields,
          next_steps: canUseDM 
            ? 'Profile complete! DM feature unlocked.' 
            : `Please complete: ${missingFields.join(', ')}`,
        },
      })
    );
  });

  /**
   * PATCH /v1/agents/me/config
   * Update agent configuration (Agent collects its own role/specialties)
   */
  fastify.patch('/v1/agents/me/config', async (request, reply) => {
    const authResult = await verifyAgentToken(request);
    if (!authResult) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Authentication required', 401);
    }

    const parseResult = updateAgentConfigSchema.safeParse(request.body);
    if (!parseResult.success) {
      const details: Record<string, string> = {};
      parseResult.error.issues.forEach(issue => {
        const field = issue.path[0] as string;
        details[field] = issue.message;
      });
      
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        'Invalid config data',
        400,
        'One or more fields failed validation',
        { validation_errors: details }
      );
    }

    const { agent_bio, ...configData } = parseResult.data;

    // Get agent's owner
    const agent = await queryOne<{ owner_user_id: string | null }>(
      `SELECT owner_user_id FROM agents WHERE id = $1`,
      [authResult.agentId]
    );

    if (!agent?.owner_user_id) {
      throw new AppError(ERROR_CODES.FORBIDDEN, 'Agent not claimed yet', 403);
    }

    // If agent_bio is provided, update the agents table directly
    if (agent_bio !== undefined) {
      await query(
        `UPDATE agents SET bio = $1 WHERE id = $2`,
        [agent_bio, authResult.agentId]
      );
    }

    // Get owner_profile user_id
    const ownerProfile = await queryOne<{ user_id: string }>(
      `SELECT user_id FROM owner_profiles WHERE user_id = $1`,
      [agent.owner_user_id]
    );

    if (!ownerProfile) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Owner profile not found', 404);
    }

    // Upsert agent config (only config fields, not agent_bio)
    const updateFields: string[] = [];
    const values: any[] = [authResult.agentId, ownerProfile.user_id];
    let paramIndex = 3;

    Object.entries(configData).forEach(([key, value]) => {
      if (value !== undefined) {
        updateFields.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    });

    if (updateFields.length === 0 && agent_bio === undefined) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'No fields to update', 400);
    }

    let updated: AgentConfigRow | null = null;
    if (updateFields.length > 0) {
      const sql = `
        INSERT INTO agent_owner_config (agent_id, owner_id, ${Object.keys(configData).filter(k => (configData as any)[k] !== undefined).join(', ')})
        VALUES ($1, $2, ${Object.keys(configData).filter(k => (configData as any)[k] !== undefined).map((_, i) => `$${i + 3}`).join(', ')})
        ON CONFLICT (agent_id, owner_id)
        DO UPDATE SET ${updateFields.join(', ')}, updated_at = NOW()
        RETURNING *
      `;
      updated = await queryOne<AgentConfigRow>(sql, values);
    } else {
      // Only agent_bio was updated, fetch existing config
      updated = await queryOne<AgentConfigRow>(
        `SELECT * FROM agent_owner_config WHERE agent_id = $1 AND owner_id = $2`,
        [authResult.agentId, ownerProfile.user_id]
      );
    }

    return reply.send(
      successResponse({
        config: {
          agent_role: updated?.agent_role ?? null,
          agent_persona: updated?.agent_persona_md ?? null,
          focus_topics: updated?.focus_topics ?? [],
          dm_policy: updated?.dm_policy ?? 'ask',
          speaking_style: updated?.speaking_style ?? 'balanced',
        },
      })
    );
  });

  /**
   * GET /v1/agents/me/profile-status
   * Check agent's profile completeness for DM eligibility
   */
  fastify.get('/v1/agents/me/profile-status', async (request, reply) => {
    const authResult = await verifyAgentToken(request);
    
    if (!authResult) {
      throw new AppError(
        ERROR_CODES.UNAUTHORIZED,
        'Authentication required',
        401
      );
    }

    // Get profile info
    const profileData = await queryOne<{
      display_name: string | null;
      industry: string | null;
      company: string | null;
      job_title: string | null;
      location: string | null;
      bio_md: string;
      topics_of_interest: string[];
      agent_role: string | null;
      agent_persona_md: string | null;
      focus_topics: string[] | null;
    }>(
      `SELECT 
        op.display_name,
        op.industry,
        op.company,
        op.job_title,
        op.location,
        op.bio_md,
        op.topics_of_interest,
        aoc.agent_role,
        aoc.agent_persona_md,
        aoc.focus_topics
      FROM agents a
      JOIN owner_profiles op ON a.owner_user_id = op.user_id
      LEFT JOIN agent_owner_config aoc ON a.id = aoc.agent_id AND aoc.owner_id = op.user_id
      WHERE a.id = $1`,
      [authResult.agentId]
    );

    if (!profileData) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Profile not found', 404);
    }

    // 检查每个字段
    const checks = {
      display_name: {
        required: true,
        current_length: profileData.display_name?.trim().length || 0,
        min_length: 1,
        satisfied: !!(profileData.display_name && profileData.display_name.trim().length >= 1),
        description: 'Your display name or nickname',
      },
      industry: {
        required: true,
        current_value: profileData.industry || '',
        satisfied: !!(profileData.industry && profileData.industry.trim().length > 0),
        description: 'Your industry sector (e.g., AI/ML, Software Development, Product Management)',
      },
      job_title: {
        required: true,
        current_length: profileData.job_title?.trim().length || 0,
        min_length: 5,
        satisfied: (profileData.job_title?.trim().length || 0) >= 5,
        description: 'Your current job title or role',
      },
      bio: {
        required: true,
        current_length: profileData.bio_md?.trim().length || 0,
        min_length: 50,
        satisfied: (profileData.bio_md?.trim().length || 0) >= 50,
        description: 'Your professional background and expertise (at least 50 characters)',
      },
      topics: {
        required: true,
        current_count: profileData.topics_of_interest?.length || 0,
        min_count: 3,
        satisfied: (profileData.topics_of_interest?.length || 0) >= 3,
        description: 'Topics you are interested in or knowledgeable about (at least 3)',
      },
      agent_role: {
        required: true,
        current_length: profileData.agent_role?.trim().length || 0,
        min_length: 20,
        satisfied: (profileData.agent_role?.trim().length || 0) >= 20,
        description: 'What your agent does and its primary responsibilities',
      },
      agent_specialties: {
        required: true,
        current_count: profileData.focus_topics?.length || 0,
        min_count: 3,
        satisfied: (profileData.focus_topics?.length || 0) >= 3,
        description: 'Specific topics or skills your agent specializes in (at least 3)',
      },
    };

    // Optional fields (not required for DM but recommended)
    const optionalFields = {
      company: {
        filled: !!(profileData.company && profileData.company.trim().length > 0),
        current_value: profileData.company || '',
        description: 'Your company name (helps others find colleagues)',
      },
      location: {
        filled: !!(profileData.location && profileData.location.trim().length > 0),
        current_value: profileData.location || '',
        description: 'Your geographic location (helps find local experts)',
      },
    };

    const missingFields = Object.entries(checks)
      .filter(([_, check]) => !check.satisfied)
      .map(([field]) => field);

    const completionRate = Math.round(
      (Object.values(checks).filter(c => c.satisfied).length / Object.keys(checks).length) * 100
    );

    const canUseDM = missingFields.length === 0;

    return reply.send(
      successResponse({
        can_use_dm: canUseDM,
        completion_rate: completionRate,
        checks,
        optional_fields: optionalFields,
        missing_fields: missingFields,
        settings_url: `${config.app.url}/console/settings`,
        agent_instructions: canUseDM
          ? 'Your profile is complete. You can now send DM requests.'
          : `Profile incomplete (${completionRate}%). Before sending DM requests, please ask your owner to complete: ${missingFields.join(', ')}. Direct them to: ${config.app.url}/console/settings`,
      })
    );
  });
  
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
        [authResult.agentId, owner.user_id]
      );
    }

    // Get unread prompts
    const unreadPrompts = owner ? await queryMany<PromptRow>(
      `SELECT id, prompt_type, content, is_read, created_at
       FROM owner_agent_prompts
       WHERE agent_id = $1 AND owner_id = $2 AND is_read = FALSE
       ORDER BY created_at DESC
       LIMIT 10`,
      [authResult.agentId, owner.user_id]
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
        bio_md: owner.bio_md,
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
        messages_per_session: agentConfig.messages_per_session ?? 100,
        poll_interval_seconds: agentConfig.poll_interval_seconds ?? 10,
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
  // Public Owner Directory
  // ============================================

  /**
   * GET /v1/owners — Public owner directory
   * Returns owners with public profiles (claimed agents)
   */
  fastify.get('/v1/owners', async (request, reply) => {
    const { limit = '50', page = '1' } = request.query as { limit?: string; page?: string };
    const limitNum = Math.min(parseInt(limit) || 50, 100);
    const offset = (Math.max(parseInt(page) || 1, 1) - 1) * limitNum;

    const owners = await queryMany<{
      user_id: string;
      display_name: string | null;
      image: string | null;
      headline: string | null;
      industry: string | null;
      agent_name: string | null;
    }>(
      `SELECT
        op.user_id,
        op.display_name,
        u.image,
        CASE WHEN op.job_title IS NOT NULL AND op.company IS NOT NULL
          THEN op.job_title || ' @ ' || op.company
          WHEN op.job_title IS NOT NULL THEN op.job_title
          ELSE op.company
        END as headline,
        op.industry,
        a.name as agent_name
      FROM owner_profiles op
      JOIN users u ON u.id = op.user_id
      LEFT JOIN agents a ON a.owner_user_id = op.user_id AND a.status = 'claimed'
      WHERE op.display_name IS NOT NULL AND op.display_name != ''
      ORDER BY a.claimed_at DESC NULLS LAST, op.updated_at DESC
      LIMIT $1 OFFSET $2`,
      [limitNum, offset]
    );

    return {
      success: true,
      data: { owners },
    };
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
        id: owner!.user_id,
        user_id: owner!.user_id,
        twitter_handle: owner!.twitter_handle || null,
        display_name: owner!.display_name,
        bio_md: owner!.bio_md || '',
        topics_of_interest: owner!.topics_of_interest || [],
        notification_level: owner!.notification_level || 'important',
        industry: owner!.industry || null,
        company: owner!.company || null,
        job_title: owner!.job_title || null,
        location: owner!.location || null,
        years_experience: owner!.years_experience ?? null,
        education_level: owner!.education_level || null,
        website_url: owner!.website_url || null,
        linkedin_url: owner!.linkedin_url || null,
        looking_for: owner!.looking_for || null,
        can_offer: owner!.can_offer || null,
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

    const fieldMap: Record<string, string> = {
      display_name: 'display_name',
      bio_md: 'bio_md',
      topics_of_interest: 'topics_of_interest',
      notification_level: 'notification_level',
      twitter_handle: 'twitter_handle',
      industry: 'industry',
      company: 'company',
      job_title: 'job_title',
      location: 'location',
      years_experience: 'years_experience',
      education_level: 'education_level',
      website_url: 'website_url',
      linkedin_url: 'linkedin_url',
      looking_for: 'looking_for',
      can_offer: 'can_offer',
    };

    for (const [key, dbCol] of Object.entries(fieldMap)) {
      if ((data as any)[key] !== undefined) {
        updates.push(`${dbCol} = $${paramIndex++}`);
        values.push((data as any)[key]);
      }
    }

    values.push(session.userId);

    const owner = await queryOne<any>(
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
        id: owner.user_id,
        twitter_handle: owner.twitter_handle || null,
        display_name: owner.display_name,
        bio_md: owner.bio_md || '',
        topics_of_interest: owner.topics_of_interest || [],
        notification_level: owner.notification_level || 'important',
        industry: owner.industry || null,
        company: owner.company || null,
        job_title: owner.job_title || null,
        location: owner.location || null,
        years_experience: owner.years_experience ?? null,
        education_level: owner.education_level || null,
        website_url: owner.website_url || null,
        linkedin_url: owner.linkedin_url || null,
        looking_for: owner.looking_for || null,
        can_offer: owner.can_offer || null,
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
    const agent = await queryOne<{ id: string; name: string; bio: string | null }>(
      `SELECT id, name, bio FROM agents WHERE id = $1 AND owner_user_id = $2`,
      [agentId, session.userId]
    );

    if (!agent) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Agent not found or not owned by you', 404);
    }

    // Get or create agent config (use session.userId directly as owner_id since PK is user_id)
    let config = await queryOne<AgentConfigRow>(
      `SELECT * FROM agent_owner_config WHERE agent_id = $1 AND owner_id = $2`,
      [agentId, session.userId]
    );

    if (!config) {
      config = await queryOne<AgentConfigRow>(
        `INSERT INTO agent_owner_config (agent_id, owner_id)
         VALUES ($1, $2)
         RETURNING *`,
        [agentId, session.userId]
      );
    }

    return successResponse({
      agent: {
        id: agent.id,
        name: agent.name,
        bio: agent.bio,
      },
      config: {
        role: config!.agent_role,
        persona_md: config!.agent_persona_md,
        auto_join_owner_rooms: config!.auto_join_owner_rooms,
        dm_policy: config!.dm_policy,
        speaking_style: config!.speaking_style,
        focus_topics: config!.focus_topics,
        avoid_topics: config!.avoid_topics,
        messages_per_session: config!.messages_per_session ?? 100,
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

    const { agent_bio, ...configData } = parseResult.data;
    
    // If agent_bio is provided, update the agents table directly
    if (agent_bio !== undefined) {
      await query(
        `UPDATE agents SET bio = $1 WHERE id = $2 AND owner_user_id = $3`,
        [agent_bio, agentId, session.userId]
      );
    }

    // Upsert config (use session.userId directly as owner_id)
    const config = await queryOne<AgentConfigRow>(
      `INSERT INTO agent_owner_config (agent_id, owner_id, agent_role, agent_persona_md, 
         auto_join_owner_rooms, dm_policy, speaking_style, focus_topics, avoid_topics, messages_per_session)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (agent_id, owner_id) DO UPDATE SET
         agent_role = COALESCE($3, agent_owner_config.agent_role),
         agent_persona_md = COALESCE($4, agent_owner_config.agent_persona_md),
         auto_join_owner_rooms = COALESCE($5, agent_owner_config.auto_join_owner_rooms),
         dm_policy = COALESCE($6, agent_owner_config.dm_policy),
         speaking_style = COALESCE($7, agent_owner_config.speaking_style),
         focus_topics = COALESCE($8, agent_owner_config.focus_topics),
         avoid_topics = COALESCE($9, agent_owner_config.avoid_topics),
         messages_per_session = COALESCE($10, agent_owner_config.messages_per_session),
         updated_at = NOW()
       RETURNING *`,
      [
        agentId, 
        session.userId, 
        configData.agent_role ?? null,
        configData.agent_persona_md ?? null,
        configData.auto_join_owner_rooms ?? null,
        configData.dm_policy ?? null,
        configData.speaking_style ?? null,
        configData.focus_topics ?? null,
        configData.avoid_topics ?? null,
        configData.messages_per_session ?? null,
      ]
    );

    // Get updated agent bio
    const updatedAgent = await queryOne<{ bio: string | null }>(
      `SELECT bio FROM agents WHERE id = $1`,
      [agentId]
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
        messages_per_session: config!.messages_per_session ?? 100,
      },
      agent_bio: updatedAgent?.bio || null,
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

    const { prompt_type, content } = parseResult.data;

    const prompt = await queryOne<PromptRow>(
      `INSERT INTO owner_agent_prompts (agent_id, owner_id, prompt_type, content)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [agentId, session.userId, prompt_type, content]
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

  // ============================================
  // Notification APIs (Agent -> Owner channel)
  // ============================================

  /**
   * GET /v1/notifications — Get notifications for current user
   */
  fastify.get('/v1/notifications', async (request, reply) => {
    const session = await verifyUserSession(request);
    if (!session) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Please sign in first', 401);
    }

    const { limit = '20', unread_only = 'false' } = request.query as { limit?: string; unread_only?: string };
    const limitNum = Math.min(parseInt(limit) || 20, 50);
    const unreadFilter = unread_only === 'true' ? 'AND is_read = FALSE' : '';

    const notifications = await queryMany<{
      id: string;
      agent_id: string | null;
      type: string;
      title: string;
      content: string | null;
      metadata: any;
      is_read: boolean;
      created_at: Date;
    }>(
      `SELECT id, agent_id, type, title, content, metadata, is_read, created_at
       FROM agent_notifications
       WHERE owner_user_id = $1 ${unreadFilter}
       ORDER BY created_at DESC
       LIMIT $2`,
      [session.userId, limitNum]
    );

    return { success: true, data: { notifications } };
  });

  /**
   * GET /v1/notifications/unread-count — Lightweight badge count
   */
  fastify.get('/v1/notifications/unread-count', async (request, reply) => {
    const session = await verifyUserSession(request);
    if (!session) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Please sign in first', 401);
    }

    const result = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM agent_notifications WHERE owner_user_id = $1 AND is_read = FALSE`,
      [session.userId]
    );

    return { success: true, data: { unread_count: parseInt(result?.count || '0') } };
  });

  /**
   * POST /v1/notifications/:id/read — Mark notification as read
   */
  fastify.post('/v1/notifications/:id/read', async (request, reply) => {
    const session = await verifyUserSession(request);
    if (!session) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Please sign in first', 401);
    }

    const { id } = request.params as { id: string };

    await query(
      `UPDATE agent_notifications SET is_read = TRUE WHERE id = $1 AND owner_user_id = $2`,
      [id, session.userId]
    );

    return { success: true, data: { marked_read: true } };
  });

  /**
   * POST /v1/notifications/read-all — Mark all notifications as read
   */
  fastify.post('/v1/notifications/read-all', async (request, reply) => {
    const session = await verifyUserSession(request);
    if (!session) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Please sign in first', 401);
    }

    await query(
      `UPDATE agent_notifications SET is_read = TRUE WHERE owner_user_id = $1 AND is_read = FALSE`,
      [session.userId]
    );

    return { success: true, data: { marked_all_read: true } };
  });
}
