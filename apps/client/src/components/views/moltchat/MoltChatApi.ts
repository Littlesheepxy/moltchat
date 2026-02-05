/*
 * MoltChat Gateway API Client
 * Native TypeScript implementation for Element
 */

const GATEWAY_URL = "http://localhost:3001";

export interface Agent {
    id: string;
    name: string;
    twitter_handle: string | null;
    status: string;
    availability: string;
    personality: string | null;
    matrix_user_id: string | null;
}

export interface Room {
    id: string;
    name: string;
    description: string | null;
    status: string;
    agent_count: number;
    matrix_room_id: string | null;
    element_room_url: string | null;
    category?: string;
    is_public?: boolean;
    message_count?: number;
    last_activity?: string;
}

export interface OwnerProfile {
    id: string;
    user_id: string;
    display_name: string | null;
    twitter_handle: string | null;
    background_md: string;
    topics_of_interest: string[];
    notification_level: string;
}

export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
    };
}

/**
 * Fetch agents for the current user
 */
export async function getAgents(): Promise<ApiResponse<{ agents: Agent[] }>> {
    try {
        const response = await fetch(`${GATEWAY_URL}/v1/agents`, {
            credentials: "include",
        });
        return response.json();
    } catch (error) {
        return {
            success: false,
            error: { code: "NETWORK_ERROR", message: "Failed to connect to server" },
        };
    }
}

/**
 * Fetch rooms
 */
export async function getRooms(): Promise<ApiResponse<{ rooms: Room[] }>> {
    try {
        const response = await fetch(`${GATEWAY_URL}/v1/rooms`, {
            credentials: "include",
        });
        return response.json();
    } catch (error) {
        return {
            success: false,
            error: { code: "NETWORK_ERROR", message: "Failed to connect to server" },
        };
    }
}

/**
 * Fetch owner profile
 */
export async function getOwnerProfile(): Promise<ApiResponse<{ profile: OwnerProfile }>> {
    try {
        const response = await fetch(`${GATEWAY_URL}/v1/owners/me/profile`, {
            credentials: "include",
        });
        return response.json();
    } catch (error) {
        return {
            success: false,
            error: { code: "NETWORK_ERROR", message: "Failed to connect to server" },
        };
    }
}

/**
 * Update owner profile
 */
export async function updateOwnerProfile(
    data: Partial<OwnerProfile>
): Promise<ApiResponse<{ profile: OwnerProfile }>> {
    try {
        const response = await fetch(`${GATEWAY_URL}/v1/owners/me/profile`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(data),
        });
        return response.json();
    } catch (error) {
        return {
            success: false,
            error: { code: "NETWORK_ERROR", message: "Failed to connect to server" },
        };
    }
}

/**
 * Generate observer token for a room
 */
export async function generateObserverToken(
    roomId: string
): Promise<ApiResponse<{ token: string; observe_url: string }>> {
    try {
        const response = await fetch(`${GATEWAY_URL}/v1/rooms/${roomId}/observer-token`, {
            method: "POST",
            credentials: "include",
        });
        return response.json();
    } catch (error) {
        return {
            success: false,
            error: { code: "NETWORK_ERROR", message: "Failed to connect to server" },
        };
    }
}

/**
 * Fetch public rooms for discovery
 */
export async function getPublicRooms(params?: {
    category?: string;
    sort?: "hot" | "recent" | "popular";
    search?: string;
}): Promise<ApiResponse<{ rooms: Room[]; categories: string[] }>> {
    try {
        const searchParams = new URLSearchParams();
        if (params?.category) searchParams.append("category", params.category);
        if (params?.sort) searchParams.append("sort", params.sort);
        if (params?.search) searchParams.append("search", params.search);

        const url = `${GATEWAY_URL}/v1/rooms/public${searchParams.toString() ? "?" + searchParams.toString() : ""}`;
        const response = await fetch(url, {
            credentials: "include",
        });
        return response.json();
    } catch (error) {
        return {
            success: false,
            error: { code: "NETWORK_ERROR", message: "Failed to connect to server" },
        };
    }
}

/**
 * Update agent status/config
 */
export async function updateAgent(
    agentId: string,
    data: Partial<Agent>
): Promise<ApiResponse<{ agent: Agent }>> {
    try {
        const response = await fetch(`${GATEWAY_URL}/v1/agents/${agentId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(data),
        });
        return response.json();
    } catch (error) {
        return {
            success: false,
            error: { code: "NETWORK_ERROR", message: "Failed to connect to server" },
        };
    }
}

/**
 * Create a new room (human users can create)
 */
export async function createRoom(data: {
    name: string;
    description?: string;
    settings?: {
        is_public?: boolean;
        invite_only?: boolean;
        allow_observer?: boolean;
    };
}): Promise<ApiResponse<{ room: Room }>> {
    try {
        const response = await fetch(`${GATEWAY_URL}/v1/rooms`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(data),
        });
        return response.json();
    } catch (error) {
        return {
            success: false,
            error: { code: "NETWORK_ERROR", message: "Failed to connect to server" },
        };
    }
}

/**
 * Agent available for invitation
 */
export interface AvailableAgent {
    id: string;
    name: string;
    twitter_handle: string | null;
    personality: string | null;
}

/**
 * Get available agents for invitation
 */
export async function getAvailableAgents(search?: string): Promise<ApiResponse<{ agents: AvailableAgent[] }>> {
    try {
        const searchParams = new URLSearchParams();
        if (search) searchParams.append("search", search);
        
        const url = `${GATEWAY_URL}/v1/agents/available${searchParams.toString() ? "?" + searchParams.toString() : ""}`;
        const response = await fetch(url, {
            credentials: "include",
        });
        return response.json();
    } catch (error) {
        return {
            success: false,
            error: { code: "NETWORK_ERROR", message: "Failed to connect to server" },
        };
    }
}

/**
 * Invite an agent to a room
 */
export async function inviteAgentToRoom(
    roomId: string,
    agentId: string
): Promise<ApiResponse<{ message: string; room_id: string; agent: { id: string; name: string } }>> {
    try {
        const response = await fetch(`${GATEWAY_URL}/v1/rooms/${roomId}/invite-agent`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ agent_id: agentId }),
        });
        return response.json();
    } catch (error) {
        return {
            success: false,
            error: { code: "NETWORK_ERROR", message: "Failed to connect to server" },
        };
    }
}
