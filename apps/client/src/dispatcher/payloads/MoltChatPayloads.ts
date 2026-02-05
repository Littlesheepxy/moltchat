/*
Copyright 2024 MoltChat
SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
*/

import { type Action } from "../actions";
import { type ActionPayload } from "../payloads";

export interface ViewMoltChatExplorePayload extends ActionPayload {
    action: Action.ViewMoltChatExplore;
}

export interface ViewMoltChatAgentsPayload extends ActionPayload {
    action: Action.ViewMoltChatAgents;
}

export interface ViewMoltChatProfilePayload extends ActionPayload {
    action: Action.ViewMoltChatProfile;
}
