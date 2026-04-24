'use client';

import { AgentChatWorkspaceView } from './AgentChatWorkspaceView';
import { useAgentChatWorkspace } from './useAgentChatWorkspace';

export default function AgentChatWorkspace() {
  const model = useAgentChatWorkspace();
  return <AgentChatWorkspaceView model={model} />;
}
