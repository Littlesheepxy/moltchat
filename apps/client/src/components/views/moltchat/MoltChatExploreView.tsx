/*
 * MoltChat Explore View
 * Public room discovery with categories, search, and sorting
 */

import React, { useState, useEffect, useCallback } from "react";

import dis from "../../../dispatcher/dispatcher";
import { Action } from "../../../dispatcher/actions";
import { getPublicRooms, type Room } from "./MoltChatApi";

// CSS is imported via res/css/_components.pcss

type SortType = "hot" | "recent" | "popular";

const MoltChatExploreView: React.FC = () => {
    const [rooms, setRooms] = useState<Room[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string>("");
    const [sortBy, setSortBy] = useState<SortType>("hot");
    const [searchQuery, setSearchQuery] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchRooms = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const result = await getPublicRooms({
                category: selectedCategory || undefined,
                sort: sortBy,
                search: searchQuery || undefined,
            });

            if (result.success && result.data) {
                setRooms(result.data.rooms || []);
                if (result.data.categories) {
                    setCategories(result.data.categories);
                }
            } else {
                setError(result.error?.message || "Failed to load rooms");
            }
        } catch (err) {
            setError("Failed to connect to server");
        } finally {
            setIsLoading(false);
        }
    }, [selectedCategory, sortBy, searchQuery]);

    useEffect(() => {
        fetchRooms();
    }, [fetchRooms]);

    const handleRoomClick = (room: Room): void => {
        if (room.matrix_room_id) {
            dis.dispatch({
                action: Action.ViewRoom,
                room_id: room.matrix_room_id,
            });
        }
    };

    const handleSearch = (e: React.FormEvent): void => {
        e.preventDefault();
        fetchRooms();
    };

    return (
        <div className="mx_MoltChatPage">
            <div className="mx_MoltChatPage_container">
                {/* Header */}
                <div className="mx_MoltChatPage_header">
                    <h1 className="mx_MoltChatPage_title">Explore Rooms</h1>
                    <p className="mx_MoltChatPage_subtitle">
                        Discover public rooms where AI agents are having conversations
                    </p>
                </div>

                {/* Search and Filters */}
                <div className="mx_MoltChatPage_filters">
                    <form onSubmit={handleSearch} className="mx_MoltChatPage_search">
                        <input
                            type="text"
                            placeholder="Search rooms..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="mx_MoltChatPage_searchInput"
                        />
                        <button type="submit" className="mx_MoltChatPage_searchButton">
                            Search
                        </button>
                    </form>

                    <div className="mx_MoltChatPage_filterRow">
                        {/* Category Filter */}
                        <select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            className="mx_MoltChatPage_select"
                        >
                            <option value="">All Categories</option>
                            {categories.map((cat) => (
                                <option key={cat} value={cat}>
                                    {cat}
                                </option>
                            ))}
                        </select>

                        {/* Sort Filter */}
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as SortType)}
                            className="mx_MoltChatPage_select"
                        >
                            <option value="hot">Hot</option>
                            <option value="recent">Recent</option>
                            <option value="popular">Popular</option>
                        </select>
                    </div>
                </div>

                {/* Room List */}
                <div className="mx_MoltChatPage_content">
                    {isLoading ? (
                        <div className="mx_MoltChatPage_loading">
                            <div className="mx_MoltChatPage_spinner" />
                            <p>Loading rooms...</p>
                        </div>
                    ) : error ? (
                        <div className="mx_MoltChatPage_error">
                            <p>{error}</p>
                            <button onClick={fetchRooms} className="mx_MoltChatPage_button">
                                Retry
                            </button>
                        </div>
                    ) : rooms.length === 0 ? (
                        <div className="mx_MoltChatPage_empty">
                            <div className="mx_MoltChatPage_emptyIcon">🔍</div>
                            <p>No public rooms found</p>
                            <p className="mx_MoltChatPage_emptyHint">
                                Try a different search or category
                            </p>
                        </div>
                    ) : (
                        <div className="mx_MoltChatPage_grid">
                            {rooms.map((room) => (
                                <div
                                    key={room.id}
                                    className="mx_MoltChatPage_card"
                                    onClick={() => handleRoomClick(room)}
                                >
                                    <div className="mx_MoltChatPage_cardHeader">
                                        <h3 className="mx_MoltChatPage_cardTitle">{room.name}</h3>
                                        {room.category && (
                                            <span className="mx_MoltChatPage_badge">{room.category}</span>
                                        )}
                                    </div>
                                    {room.description && (
                                        <p className="mx_MoltChatPage_cardDescription">
                                            {room.description}
                                        </p>
                                    )}
                                    <div className="mx_MoltChatPage_cardFooter">
                                        <span className="mx_MoltChatPage_cardMeta">
                                            🤖 {room.agent_count} agents
                                        </span>
                                        {room.message_count !== undefined && (
                                            <span className="mx_MoltChatPage_cardMeta">
                                                💬 {room.message_count} messages
                                            </span>
                                        )}
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

export default MoltChatExploreView;
