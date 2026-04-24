'use client';

import { AnimatePresence, LayoutGroup } from 'framer-motion';
import AgentArtifactModal from '@/components/AgentArtifactModal';
import AgentChatAssistantMessage from '@/components/agent-chat/AgentChatAssistantMessage';
import AgentChatErrorAlert from '@/components/agent-chat/AgentChatErrorAlert';
import AgentChatMobileBar from '@/components/agent-chat/AgentChatMobileBar';
import AgentChatPanelHeader from '@/components/agent-chat/AgentChatPanelHeader';
import AgentChatSidebarDrawer from '@/components/agent-chat/AgentChatSidebarDrawer';
import AgentChatThinkingPanel from '@/components/agent-chat/AgentChatThinkingPanel';
import AgentChatUserBubble from '@/components/agent-chat/AgentChatUserBubble';
import AgentChatWelcomeGrid from '@/components/agent-chat/AgentChatWelcomeGrid';
import ChatSidebar from '@/components/agent-chat/ChatSidebar';
import { truncateTitle } from '@/components/agent-chat/utils';
import { STEPPER_STEPS } from '@/components/agent-chat/welcome-and-stepper';
import AgentComposer from '@/components/AgentComposer';
import AgentDebugPanel from '@/components/AgentDebugPanel';
import { AGENT_DEBUG_ENABLED } from '@/lib/constants';
import type { AgentChatWorkspaceViewModel } from './useAgentChatWorkspace';

type Props = {
  model: AgentChatWorkspaceViewModel;
};

export function AgentChatWorkspaceView({ model }: Props) {
  const {
    layoutId,
    query,
    setQuery,
    skipAutoRowLimit,
    setSkipAutoRowLimit,
    phase,
    runnerError,
    setRunnerError,
    activeStep,
    stepStatuses,
    stepDetail,
    isRetrying,
    isRunning,
    isOsagoAgentMode,
    debugEntries,
    savedChatsLoading,
    loadingChatId,
    activeChat,
    saveState,
    savedAt,
    pendingTurn,
    followUpContext,
    setFollowUpContext,
    drawerOpen,
    setDrawerOpen,
    exportingTurnId,
    openArtifactTurn,
    setOpenArtifactTurn,
    textareaRef,
    threadEndRef,
    welcomeCards,
    sidebarChats,
    showEmptyState,
    activeChatId,
    chatHeading,
    chatSubheading,
    onLoadSavedChat,
    onNewChat,
    onChatModeChange,
    onSubmit,
    onStop,
    placeQueryInComposer,
    focusComposer,
    exportArtifact,
    onCloseArtifactModal,
    onExportOpenArtifact,
    chatMode,
  } = model;

  return (
    <LayoutGroup>
      <div className="space-y-4">
        <div className="grid gap-5 lg:h-[calc(100dvh-7rem)] lg:grid-cols-[18.75rem_minmax(0,1fr)] lg:overflow-hidden xl:grid-cols-[19.75rem_minmax(0,1fr)]">
          <aside className="hidden lg:flex lg:min-h-0 lg:flex-col lg:overflow-hidden">
            <ChatSidebar
              chats={sidebarChats}
              loading={savedChatsLoading}
              activeChatId={activeChatId}
              loadingChatId={loadingChatId}
              saveState={saveState}
              savedAt={savedAt}
              onSelect={chatId => { void onLoadSavedChat(chatId); }}
              onCreate={onNewChat}
            />
          </aside>

          <div className="min-w-0 space-y-3 lg:flex lg:min-h-0 lg:flex-col lg:overflow-hidden">
            <AgentChatMobileBar
              onOpenChats={() => { setDrawerOpen(true); }}
              onNewChat={onNewChat}
            />

            <section className="ui-panel overflow-hidden rounded-[32px] lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
              <AgentChatPanelHeader
                chatHeading={chatHeading}
                chatSubheading={chatSubheading}
                showEmptyState={showEmptyState}
                activeChat={activeChat}
                saveState={saveState}
                savedAt={savedAt}
                chatMode={chatMode}
                onChatModeChange={onChatModeChange}
                modeSwitchDisabled={isRunning}
              />

              <div className="flex min-h-0 flex-col px-4 py-3 sm:px-5 lg:min-h-0 lg:flex-1 lg:px-6">
                <div className="flex-1 space-y-5 overflow-y-auto pr-1 lg:min-h-0">
                  {showEmptyState ? (
                    <AgentChatWelcomeGrid cards={welcomeCards} onPickQuery={placeQueryInComposer} />
                  ) : null}

                  {activeChat?.turns.map(turn => (
                    <div key={turn.id} className="space-y-3">
                      <AgentChatUserBubble createdAt={turn.createdAt} text={turn.userQuery} />

                      <div className="flex justify-start">
                        <AgentChatAssistantMessage
                          turn={turn}
                          exporting={exportingTurnId === turn.id}
                          isRunning={isRunning}
                          onOpenArtifact={() => { setOpenArtifactTurn(turn); }}
                          onExport={() => {
                            const art = turn.assistant.kind === 'artifact' ? turn.assistant.artifact : null;
                            if (art) { void exportArtifact(art, turn.id); }
                          }}
                          onRefine={() => {
                            const art = turn.assistant.kind === 'artifact' ? turn.assistant.artifact : null;
                            if (!art) return;
                            setFollowUpContext({
                              label: truncateTitle(turn.userQuery, 60),
                              sql: art.sql,
                            });
                            focusComposer();
                          }}
                          onPickSuggestion={suggestion => {
                            const art = turn.assistant.kind === 'artifact' ? turn.assistant.artifact : null;
                            if (art) {
                              setFollowUpContext({
                                label: truncateTitle(turn.userQuery, 60),
                                sql: art.sql,
                              });
                            }
                            placeQueryInComposer(suggestion);
                          }}
                        />
                      </div>
                    </div>
                  ))}

                  {pendingTurn ? (
                    <div className="space-y-3">
                      <AgentChatUserBubble createdAt={pendingTurn.createdAt} text={pendingTurn.userQuery} />
                      <AgentChatThinkingPanel
                        steps={STEPPER_STEPS}
                        activeStep={activeStep}
                        statuses={stepStatuses}
                        detail={stepDetail}
                        isRetrying={isRetrying}
                      />
                    </div>
                  ) : null}

                  <AnimatePresence>
                    {phase === 'error' && runnerError ? (
                      <AgentChatErrorAlert
                        message={runnerError}
                        onDismiss={() => {
                          setRunnerError(null);
                          focusComposer();
                        }}
                      />
                    ) : null}
                  </AnimatePresence>

                  <div ref={threadEndRef} />
                </div>
              </div>
            </section>

            <AgentComposer
              query={query}
              onQueryChange={setQuery}
              onSubmit={() => { void onSubmit(); }}
              onStop={onStop}
              compact={!showEmptyState}
              disabled={loadingChatId !== null}
              isRunning={isRunning}
              runButtonLabel={isRunning ? 'Выполняю…' : 'Отправить'}
              skipAutoRowLimit={skipAutoRowLimit}
              onSkipAutoRowLimitChange={setSkipAutoRowLimit}
              showSkipAutoRowLimit={!isOsagoAgentMode}
              placeholder={isOsagoAgentMode
                ? 'Например: покажи убыточность ОСАГО по регионам и приложи график…'
                : undefined}
              textareaRef={textareaRef}
              followUpContext={!isOsagoAgentMode && followUpContext ? { label: followUpContext.label } : null}
              onClearFollowUp={() => { setFollowUpContext(null); }}
            />
          </div>
        </div>

        {AGENT_DEBUG_ENABLED ? (
          <AgentDebugPanel entries={debugEntries} isRunning={isRunning} />
        ) : null}
      </div>

      <AgentChatSidebarDrawer
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); }}
        chats={sidebarChats}
        loading={savedChatsLoading}
        activeChatId={activeChatId}
        loadingChatId={loadingChatId}
        saveState={saveState}
        savedAt={savedAt}
        onSelectChat={chatId => { void onLoadSavedChat(chatId); }}
        onNewChat={onNewChat}
      />

      <AgentArtifactModal
        open={Boolean(openArtifactTurn)}
        turn={openArtifactTurn}
        layoutId={layoutId}
        exporting={openArtifactTurn ? exportingTurnId === openArtifactTurn.id : false}
        onClose={onCloseArtifactModal}
        onExport={onExportOpenArtifact}
      />
    </LayoutGroup>
  );
}
