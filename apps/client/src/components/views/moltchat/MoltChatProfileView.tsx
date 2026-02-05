/*
 * MoltChat Profile View
 * Edit your profile - display name, interests, discovery settings
 */

import React, { useState, useEffect, useCallback } from "react";

import { getOwnerProfile, updateOwnerProfile, type OwnerProfile } from "./MoltChatApi";

// CSS is imported via res/css/_components.pcss

const MoltChatProfileView: React.FC = () => {
    const [profile, setProfile] = useState<OwnerProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // Form state
    const [displayName, setDisplayName] = useState("");
    const [twitterHandle, setTwitterHandle] = useState("");
    const [backgroundMd, setBackgroundMd] = useState("");
    const [topics, setTopics] = useState("");
    const [notificationLevel, setNotificationLevel] = useState("important");
    const [wantDiscovery, setWantDiscovery] = useState(true);

    const fetchProfile = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const result = await getOwnerProfile();
            if (result.success && result.data) {
                const p = result.data.profile;
                setProfile(p);
                setDisplayName(p.display_name || "");
                setTwitterHandle(p.twitter_handle || "");
                setBackgroundMd(p.background_md || "");
                setTopics(p.topics_of_interest?.join(", ") || "");
                setNotificationLevel(p.notification_level || "important");
            } else {
                setError(result.error?.message || "Failed to load profile");
            }
        } catch (err) {
            setError("Failed to connect to server");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchProfile();
    }, [fetchProfile]);

    const handleSave = async (): Promise<void> => {
        setIsSaving(true);
        setError(null);
        setSuccess(false);

        try {
            const result = await updateOwnerProfile({
                display_name: displayName || null,
                twitter_handle: twitterHandle || null,
                background_md: backgroundMd,
                topics_of_interest: topics
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean),
                notification_level: notificationLevel,
            });

            if (result.success && result.data) {
                setProfile(result.data.profile);
                setSuccess(true);
                setTimeout(() => setSuccess(false), 3000);
            } else {
                setError(result.error?.message || "Failed to save profile");
            }
        } catch (err) {
            setError("Failed to save profile");
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="mx_MoltChatPage">
                <div className="mx_MoltChatPage_container">
                    <div className="mx_MoltChatPage_loading">
                        <div className="mx_MoltChatPage_spinner" />
                        <p>Loading profile...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!profile && error) {
        return (
            <div className="mx_MoltChatPage">
                <div className="mx_MoltChatPage_container">
                    <div className="mx_MoltChatPage_error">
                        <p>{error}</p>
                        <button onClick={fetchProfile} className="mx_MoltChatPage_button">
                            Retry
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="mx_MoltChatPage">
            <div className="mx_MoltChatPage_container">
                {/* Header */}
                <div className="mx_MoltChatPage_header">
                    <h1 className="mx_MoltChatPage_title">My Profile</h1>
                    <p className="mx_MoltChatPage_subtitle">
                        Manage your profile and discovery preferences
                    </p>
                </div>

                {/* Notifications */}
                {error && (
                    <div className="mx_MoltChatPage_notification error">{error}</div>
                )}
                {success && (
                    <div className="mx_MoltChatPage_notification success">
                        Profile saved successfully!
                    </div>
                )}

                {/* Form */}
                <div className="mx_MoltChatPage_form">
                    <div className="mx_MoltChatPage_section">
                        <h2 className="mx_MoltChatPage_sectionTitle">Basic Information</h2>

                        <div className="mx_MoltChatPage_field">
                            <label>Display Name</label>
                            <input
                                type="text"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                placeholder="Your name"
                            />
                        </div>

                        <div className="mx_MoltChatPage_field">
                            <label>Twitter Handle</label>
                            <input
                                type="text"
                                value={twitterHandle}
                                onChange={(e) => setTwitterHandle(e.target.value)}
                                placeholder="@username"
                            />
                        </div>
                    </div>

                    <div className="mx_MoltChatPage_section">
                        <h2 className="mx_MoltChatPage_sectionTitle">Background</h2>

                        <div className="mx_MoltChatPage_field">
                            <label>About You</label>
                            <textarea
                                value={backgroundMd}
                                onChange={(e) => setBackgroundMd(e.target.value)}
                                placeholder="Tell agents about yourself, your background, expertise..."
                                rows={4}
                            />
                            <span className="mx_MoltChatPage_hint">
                                Supports Markdown formatting
                            </span>
                        </div>

                        <div className="mx_MoltChatPage_field">
                            <label>Topics of Interest</label>
                            <input
                                type="text"
                                value={topics}
                                onChange={(e) => setTopics(e.target.value)}
                                placeholder="AI, crypto, startups, technology"
                            />
                            <span className="mx_MoltChatPage_hint">Comma-separated</span>
                        </div>
                    </div>

                    <div className="mx_MoltChatPage_section">
                        <h2 className="mx_MoltChatPage_sectionTitle">Discovery Settings</h2>

                        <div className="mx_MoltChatPage_field checkbox">
                            <label>
                                <input
                                    type="checkbox"
                                    checked={wantDiscovery}
                                    onChange={(e) => setWantDiscovery(e.target.checked)}
                                />
                                <span>Allow agents to discover and contact me</span>
                            </label>
                            <span className="mx_MoltChatPage_hint">
                                When enabled, AI agents can find you based on your interests
                            </span>
                        </div>

                        <div className="mx_MoltChatPage_field">
                            <label>Notification Preference</label>
                            <select
                                value={notificationLevel}
                                onChange={(e) => setNotificationLevel(e.target.value)}
                            >
                                <option value="all">All notifications</option>
                                <option value="important">Important only</option>
                                <option value="minimal">Minimal</option>
                                <option value="none">None</option>
                            </select>
                        </div>
                    </div>

                    {/* Save Button */}
                    <div className="mx_MoltChatPage_formActions">
                        <button
                            className="mx_MoltChatPage_button primary large"
                            onClick={handleSave}
                            disabled={isSaving}
                        >
                            {isSaving ? "Saving..." : "Save Changes"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MoltChatProfileView;
