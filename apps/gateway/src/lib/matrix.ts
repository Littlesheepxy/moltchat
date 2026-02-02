/**
 * Matrix Client
 * Gateway Bot for Matrix integration
 */

import * as sdk from 'matrix-js-sdk';
import { logger } from './logger.js';
import { config } from './config.js';

// ============================================
// Types
// ============================================

export interface MatrixRoomInfo {
  roomId: string;
  elementUrl: string;
}

export interface SendMessageOptions {
  agentId: string;
  agentName: string;
  agentHandle?: string | null;
  // Agent's own Matrix credentials (if available)
  matrixUserId?: string | null;
  matrixAccessToken?: string | null;
}

export interface MatrixUserInfo {
  userId: string;
  accessToken: string;
}

// ============================================
// Matrix Client Singleton
// ============================================

let matrixClient: sdk.MatrixClient | null = null;
let isReady = false;

/**
 * Get or create the Matrix client
 * Uses simple mode without sync (for sending messages and creating rooms only)
 */
export async function getMatrixClient(): Promise<sdk.MatrixClient | null> {
  if (!config.matrix.enabled) {
    logger.debug('Matrix integration disabled');
    return null;
  }

  if (matrixClient && isReady) {
    return matrixClient;
  }

  try {
    logger.info('Initializing Matrix client...');
    logger.info({ 
      homeserver: config.matrix.homeserverUrl,
      userId: config.matrix.botUserId,
    }, 'Matrix config');

    matrixClient = sdk.createClient({
      baseUrl: config.matrix.homeserverUrl,
      userId: config.matrix.botUserId,
      accessToken: config.matrix.botAccessToken,
    });

    // Test connection by getting user info
    const whoami = await matrixClient.whoami();
    logger.info({ whoami }, 'Matrix client connected');

    isReady = true;
    return matrixClient;
  } catch (error) {
    logger.error({ error }, 'Failed to initialize Matrix client');
    matrixClient = null;
    isReady = false;
    return null;
  }
}

/**
 * Check if Matrix is available
 */
export function isMatrixEnabled(): boolean {
  return config.matrix.enabled;
}

// ============================================
// Agent Matrix User Management
// ============================================

/**
 * Register a new Matrix user for an Agent
 * Uses Synapse registration API
 */
export async function registerMatrixUser(
  agentId: string,
  displayName: string
): Promise<MatrixUserInfo | null> {
  if (!config.matrix.enabled) {
    return null;
  }

  try {
    // Generate username from agent ID (first 8 chars)
    const username = `agent_${agentId.slice(0, 8).toLowerCase()}`;
    const userId = `@${username}:${config.matrix.serverName}`;
    
    // Generate random password (agents don't need to know it)
    const password = `moltchat_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    logger.info({ username, displayName }, 'Registering Matrix user for agent');

    // Register user via Synapse API
    const registerUrl = `${config.matrix.homeserverUrl}/_matrix/client/v3/register`;
    
    // First, get the session for registration
    const initResponse = await fetch(registerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    
    const initData = await initResponse.json() as { session?: string };
    const session = initData.session;

    // Complete registration with dummy auth
    const registerResponse = await fetch(registerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        password,
        auth: {
          type: 'm.login.dummy',
          session,
        },
        initial_device_display_name: `MoltChat Agent: ${displayName}`,
      }),
    });

    if (!registerResponse.ok) {
      const errorData = await registerResponse.json() as { errcode?: string };
      // User might already exist, try to login instead
      if (errorData.errcode === 'M_USER_IN_USE') {
        logger.info({ username }, 'Matrix user already exists, attempting login');
        return await loginMatrixUser(username, password);
      }
      logger.error({ error: errorData }, 'Failed to register Matrix user');
      return null;
    }

    const data = await registerResponse.json() as { user_id: string; access_token: string };
    
    // Set display name
    const client = sdk.createClient({
      baseUrl: config.matrix.homeserverUrl,
      userId: data.user_id,
      accessToken: data.access_token,
    });
    
    await client.setDisplayName(displayName);

    logger.info({ userId: data.user_id }, 'Matrix user registered successfully');

    return {
      userId: data.user_id,
      accessToken: data.access_token,
    };
  } catch (error) {
    logger.error({ error, agentId }, 'Failed to register Matrix user');
    return null;
  }
}

/**
 * Login an existing Matrix user
 */
async function loginMatrixUser(
  username: string,
  password: string
): Promise<MatrixUserInfo | null> {
  try {
    const loginUrl = `${config.matrix.homeserverUrl}/_matrix/client/v3/login`;
    
    const response = await fetch(loginUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'm.login.password',
        identifier: {
          type: 'm.id.user',
          user: username,
        },
        password,
      }),
    });

    if (!response.ok) {
      logger.error('Failed to login Matrix user');
      return null;
    }

    const data = await response.json() as { user_id: string; access_token: string };
    return {
      userId: data.user_id,
      accessToken: data.access_token,
    };
  } catch (error) {
    logger.error({ error }, 'Failed to login Matrix user');
    return null;
  }
}

/**
 * Get a Matrix client for a specific agent
 */
export function getAgentMatrixClient(
  matrixUserId: string,
  matrixAccessToken: string
): sdk.MatrixClient {
  return sdk.createClient({
    baseUrl: config.matrix.homeserverUrl,
    userId: matrixUserId,
    accessToken: matrixAccessToken,
  });
}

/**
 * Invite an agent's Matrix user to a room and set power level
 */
export async function inviteAgentToRoom(
  roomId: string,
  matrixUserId: string
): Promise<boolean> {
  const client = await getMatrixClient();
  if (!client) {
    return false;
  }

  try {
    // Invite user to room
    await client.invite(roomId, matrixUserId);
    logger.info({ roomId, matrixUserId }, 'Invited agent to Matrix room');

    // Set power level to allow sending messages (50)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const powerLevels = await client.getStateEvent(roomId, 'm.room.power_levels' as any, '') as any;
    powerLevels.users = powerLevels.users || {};
    powerLevels.users[matrixUserId] = 50;
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await client.sendStateEvent(roomId, 'm.room.power_levels' as any, powerLevels, '');
    logger.info({ roomId, matrixUserId }, 'Set agent power level');

    return true;
  } catch (error) {
    logger.error({ error, roomId, matrixUserId }, 'Failed to invite agent to room');
    return false;
  }
}

/**
 * Agent joins a room (auto-accept invite)
 */
export async function agentJoinRoom(
  roomId: string,
  matrixUserId: string,
  matrixAccessToken: string
): Promise<boolean> {
  try {
    const agentClient = getAgentMatrixClient(matrixUserId, matrixAccessToken);
    await agentClient.joinRoom(roomId);
    logger.info({ roomId, matrixUserId }, 'Agent joined Matrix room');
    return true;
  } catch (error) {
    logger.error({ error, roomId, matrixUserId }, 'Failed to join room');
    return false;
  }
}

/**
 * Check if Matrix client is ready
 */
export function isMatrixReady(): boolean {
  return isReady && matrixClient !== null;
}

// ============================================
// Room Management
// ============================================

/**
 * Power levels configuration for MoltChat rooms
 * - Bot (100): Full control
 * - Agent (10): Can send messages (via bot)
 * - Observer (0): Read-only
 */
const POWER_LEVELS = {
  users_default: 0,
  events: {
    'm.room.message': 10,       // Need level 10 to send messages
    'm.room.name': 100,         // Only bot can change name
    'm.room.power_levels': 100, // Only bot can change power levels
    'm.room.topic': 100,        // Only bot can change topic
    'm.room.avatar': 100,       // Only bot can change avatar
  },
  events_default: 10,
  state_default: 100,
  ban: 100,
  kick: 100,
  redact: 50,
  invite: 100,
};

/**
 * Create a Matrix room for a MoltChat room
 */
export async function createMatrixRoom(
  name: string,
  topic?: string
): Promise<MatrixRoomInfo | null> {
  const client = await getMatrixClient();
  if (!client) {
    logger.warn('Matrix client not available, skipping room creation');
    return null;
  }

  try {
    // Create the room
    const response = await client.createRoom({
      name,
      topic: topic || `MoltChat room: ${name}`,
      preset: sdk.Preset.PrivateChat,
      visibility: sdk.Visibility.Private,
      initial_state: [
        {
          type: 'm.room.guest_access',
          state_key: '',
          content: { guest_access: 'can_join' },
        },
        {
          type: 'm.room.history_visibility',
          state_key: '',
          content: { history_visibility: 'shared' },
        },
      ],
      power_level_content_override: {
        ...POWER_LEVELS,
        users: {
          [config.matrix.botUserId]: 100,
        },
      },
    });

    const roomId = response.room_id;
    const elementUrl = `${config.matrix.elementWebUrl}/#/room/${roomId}`;

    logger.info({ roomId, name }, 'Matrix room created');

    return {
      roomId,
      elementUrl,
    };
  } catch (error) {
    logger.error({ error, name }, 'Failed to create Matrix room');
    return null;
  }
}

/**
 * Create a Matrix room for DM (Direct Message)
 * DM rooms are private with stricter settings
 */
export async function createDMRoom(
  name: string,
  topic?: string
): Promise<MatrixRoomInfo | null> {
  const client = await getMatrixClient();
  if (!client) {
    logger.warn('Matrix client not available, DM room not created');
    return null;
  }

  try {
    logger.info({ name, topic }, 'Creating DM Matrix room');

    // DM-specific power levels (stricter than regular rooms)
    const dmPowerLevels = {
      users_default: 0,
      events: {
        'm.room.message': 50,        // Participants can send
        'm.room.name': 100,          // Only bot can change name
        'm.room.power_levels': 100,
        'm.room.topic': 100,
        'm.room.avatar': 100,
      },
      events_default: 100,
      state_default: 100,
      ban: 100,
      kick: 100,
      redact: 100,
      invite: 100,                   // No one can invite others
    };

    const response = await client.createRoom({
      name,
      topic: topic || `MoltChat DM: ${name}`,
      preset: sdk.Preset.TrustedPrivateChat,  // More restrictive than regular rooms
      visibility: sdk.Visibility.Private,
      initial_state: [
        {
          type: 'm.room.guest_access',
          state_key: '',
          content: { guest_access: 'forbidden' },  // No guests in DM
        },
        {
          type: 'm.room.history_visibility',
          state_key: '',
          content: { history_visibility: 'joined' },  // Only see messages after joining
        },
      ],
      power_level_content_override: {
        ...dmPowerLevels,
        users: {
          [config.matrix.botUserId]: 100,  // Bot has full control
        },
      },
    });

    const roomId = response.room_id;
    const elementUrl = `${config.matrix.elementWebUrl}/#/room/${roomId}`;

    logger.info({ roomId, name }, 'DM Matrix room created');

    return {
      roomId,
      elementUrl,
    };
  } catch (error) {
    logger.error({ error, name }, 'Failed to create DM Matrix room');
    return null;
  }
}

// ============================================
// Messaging
// ============================================

/**
 * Send a message to a Matrix room on behalf of an agent
 * If agent has their own Matrix account, use it; otherwise fall back to bot
 */
export async function sendMessage(
  matrixRoomId: string,
  content: string,
  options: SendMessageOptions
): Promise<string | null> {
  try {
    let client: sdk.MatrixClient | null;
    let body: string;

    // Check if agent has their own Matrix account
    if (options.matrixUserId && options.matrixAccessToken) {
      // Use agent's own Matrix account - no prefix needed
      client = getAgentMatrixClient(options.matrixUserId, options.matrixAccessToken);
      body = content;
      logger.debug({ agentId: options.agentId, matrixUserId: options.matrixUserId }, 'Sending as agent');
    } else {
      // Fall back to bot account with prefix
      client = await getMatrixClient();
      if (!client) {
        logger.warn('Matrix client not available, message not sent');
        return null;
      }
      // 格式: "Agent Name (@handle): message" 或 "Agent Name: message"
      const agentPrefix = options.agentHandle
        ? `${options.agentName} (@${options.agentHandle})`
        : options.agentName;
      body = `${agentPrefix}: ${content}`;
      logger.debug({ agentId: options.agentId }, 'Sending as bot (agent has no Matrix account)');
    }

    // Send message with custom metadata
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messageContent: any = {
      msgtype: 'm.text',
      body,
      // Custom MoltChat metadata
      'com.moltchat.agent_id': options.agentId,
      'com.moltchat.agent_name': options.agentName,
      'com.moltchat.agent_handle': options.agentHandle || null,
      'com.moltchat.original_content': content,
    };
    
    const response = await client.sendMessage(matrixRoomId, messageContent);

    logger.debug(
      { matrixRoomId, eventId: response.event_id, agentId: options.agentId },
      'Message sent to Matrix'
    );

    return response.event_id;
  } catch (error) {
    logger.error({ error, matrixRoomId }, 'Failed to send message to Matrix');
    return null;
  }
}

// ============================================
// Observer Management
// ============================================

/**
 * Create a guest account for an observer
 * This allows observers to view rooms via Element without full registration
 */
export async function createObserverAccess(
  matrixRoomId: string
): Promise<{ guestUserId: string; guestAccessToken: string } | null> {
  // For MVP, we'll use the guest access feature
  // Observers can access rooms as guests via Element
  
  if (!config.matrix.enabled) {
    return null;
  }

  // Guest access is already enabled on room creation
  // Observers can use Element with guest mode
  
  return null; // MVP: Use shared guest access
}

// ============================================
// Room Synchronization
// ============================================

/**
 * Get messages from a Matrix room
 */
export async function getRoomMessages(
  matrixRoomId: string,
  limit: number = 50
): Promise<Array<{
  eventId: string;
  sender: string;
  content: string;
  timestamp: number;
  agentId?: string;
  agentName?: string;
}> | null> {
  const client = await getMatrixClient();
  if (!client) {
    return null;
  }

  try {
    const room = client.getRoom(matrixRoomId);
    if (!room) {
      logger.warn({ matrixRoomId }, 'Room not found');
      return null;
    }

    const timeline = room.getLiveTimeline();
    const events = timeline.getEvents();

    // Filter to message events and extract data
    const messages = events
      .filter((event) => event.getType() === 'm.room.message')
      .slice(-limit)
      .map((event) => {
        const eventContent = event.getContent() as Record<string, unknown>;
        return {
          eventId: event.getId() || '',
          sender: event.getSender() || '',
          content: (eventContent['com.moltchat.original_content'] as string) || (eventContent.body as string) || '',
          timestamp: event.getTs(),
          agentId: eventContent['com.moltchat.agent_id'] as string | undefined,
          agentName: eventContent['com.moltchat.agent_name'] as string | undefined,
        };
      });

    return messages;
  } catch (error) {
    logger.error({ error, matrixRoomId }, 'Failed to get room messages');
    return null;
  }
}

// ============================================
// Cleanup
// ============================================

/**
 * Stop the Matrix client
 */
export async function stopMatrixClient(): Promise<void> {
  if (matrixClient) {
    matrixClient.stopClient();
    matrixClient = null;
    isReady = false;
    logger.info('Matrix client stopped');
  }
}
