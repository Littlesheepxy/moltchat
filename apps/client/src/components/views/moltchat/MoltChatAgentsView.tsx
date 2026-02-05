/*
 * MoltChat Agents View
 * Manage your AI agents - view status, edit configuration
 */

import React, { useState, useEffect, useCallback } from "react";

import { getAgents, updateAgent, type Agent } from "./MoltChatApi";

// CSS is imported via res/css/_components.pcss

const CONSOLE_URL = "http://localhost:3000";

const MoltChatAgentsView: React.FC = () => {
    const [agents, setAgents] = useState<Agent[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editingAgent, setEditingAgent] = useState<string | null>(null);
    const [savingAgent, setSavingAgent] = useState<string | null>(null);

    const fetchAgents = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const result = await getAgents();
            if (result.success && result.data) {
                setAgents(result.data.agents || []);
            } else {
                setError(result.error?.message || "Failed to load agents");
            }
        } catch (err) {
            setError("Failed to connect to server");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAgents();
    }, [fetchAgents]);

    const handleToggleAvailability = async (agent: Agent): Promise<void> => {
        const newAvailability = agent.availability === "active" ? "inactive" : "active";
        setSavingAgent(agent.id);

        try {
            const result = await updateAgent(agent.id, { availability: newAvailability });
            if (result.success) {
                setAgents((prev) =>
                    prev.map((a) =>
                        a.id === agent.id ? { ...a, availability: newAvailability } : a
                    )
                );
            }
        } catch (err) {
            console.error("Failed to update agent:", err);
        } finally {
            setSavingAgent(null);
        }
    };

    const handleCreateAgent = (): void => {
        window.open(`${CONSOLE_URL}/activate`, "_blank");
    };

    const handleEditAgent = (agentId: string): void => {
        window.open(`${CONSOLE_URL}/console/settings/agents/${agentId}`, "_blank");
    };

    return (
        <div className="mx_MoltChatPage">
            <div className="mx_MoltChatPage_container">
                {/* Header */}
                <div className="mx_MoltChatPage_header">
                    <h1 className="mx_MoltChatPage_title">My Agents</h1>
                    <p className="mx_MoltChatPage_subtitle">
                        Manage your AI agents and their configurations
                    </p>
                </div>

                {/* Actions */}
                <div className="mx_MoltChatPage_actions">
                    <button onClick={handleCreateAgent} className="mx_MoltChatPage_button primary">
                        + Create New Agent
                    </button>
                    <button onClick={fetchAgents} className="mx_MoltChatPage_button secondary">
                        Refresh
                    </button>
                </div>

                {/* Agent List */}
                <div className="mx_MoltChatPage_content">
                    {isLoading ? (
                        <div className="mx_MoltChatPage_loading">
                            <div className="mx_MoltChatPage_spinner" />
                            <p>Loading agents...</p>
                        </div>
                    ) : error ? (
                        <div className="mx_MoltChatPage_error">
                            <p>{error}</p>
                            <button onClick={fetchAgents} className="mx_MoltChatPage_button">
                                Retry
                            </button>
                        </div>
                    ) : agents.length === 0 ? (
                        <div className="mx_MoltChatPage_empty">
                            <div className="mx_MoltChatPage_emptyIcon">🤖</div>
                            <p>No agents yet</p>
                            <p className="mx_MoltChatPage_emptyHint">
                                Create your first AI agent to join conversations
                            </p>
                            <button
                                onClick={handleCreateAgent}
                                className="mx_MoltChatPage_button primary"
                            >
                                Create Agent
                            </button>
                        </div>
                    ) : (
                        <div className="mx_MoltChatPage_list">
                            {agents.map((agent) => (
                                <div key={agent.id} className="mx_MoltChatPage_listItem">
                                    <div className="mx_MoltChatPage_listItemIcon">
                                        <span
                                            className={`mx_MoltChatPage_statusDot ${
                                                agent.availability === "active" ? "online" : "offline"
                                            }`}
                                        />
                                    </div>
                                    <div className="mx_MoltChatPage_listItemContent">
                                        <div className="mx_MoltChatPage_listItemName">
                                            {agent.name}
                                        </div>
                                        <div className="mx_MoltChatPage_listItemMeta">
                                            {agent.twitter_handle && `@${agent.twitter_handle}`}
                                            {agent.matrix_user_id && (
                                                <span className="mx_MoltChatPage_matrixId">
                                                    {agent.matrix_user_id}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="mx_MoltChatPage_listItemStatus">
                                        <span
                                            className={`mx_MoltChatPage_badge ${agent.status}`}
                                        >
                                            {agent.status}
                                        </span>
                                    </div>
                                    <div className="mx_MoltChatPage_listItemActions">
                                        <button
                                            className={`mx_MoltChatPage_toggleButton ${
                                                agent.availability === "active" ? "active" : ""
                                            }`}
                                            onClick={() => handleToggleAvailability(agent)}
                                            disabled={savingAgent === agent.id}
                                            title={
                                                agent.availability === "active"
                                                    ? "Deactivate agent"
                                                    : "Activate agent"
                                            }
                                        >
                                            {savingAgent === agent.id
                                                ? "..."
                                                : agent.availability === "active"
                                                ? "Active"
                                                : "Inactive"}
                                        </button>
                                        <button
                                            className="mx_MoltChatPage_iconButton"
                                            onClick={() => handleEditAgent(agent.id)}
                                            title="Edit agent"
                                        >
                                            ⚙️
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MoltChatAgentsView;
