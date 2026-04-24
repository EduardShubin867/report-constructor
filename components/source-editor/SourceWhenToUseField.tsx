'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { SourceEditorFormData } from './types';
import { buildGenerateWhenToUseRequest } from './utils';

interface SourceWhenToUseFieldProps {
  form: Pick<SourceEditorFormData, 'name' | 'whenToUse' | 'tables'>;
  disabled?: boolean;
  onChange: (value: string) => void;
}

export default function SourceWhenToUseField({
  form,
  disabled = false,
  onChange,
}: SourceWhenToUseFieldProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const canGenerate = !!form.name.trim() || !!form.whenToUse.trim();

  async function handleGenerateWhenToUse() {
    setGenerateError(null);
    setIsGenerating(true);
    try {
      const request = buildGenerateWhenToUseRequest(form);
      const res = await fetch(request.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request.body),
      });
      const data: { whenToUse?: string; error?: string } = await res.json();
      if (!res.ok || !data.whenToUse) {
        throw new Error(data.error || 'Не удалось сгенерировать описание');
      }
      onChange(data.whenToUse);
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Ошибка генерации');
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="block">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs text-on-surface-variant">Когда использовать</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleGenerateWhenToUse}
          disabled={disabled || isGenerating || !canGenerate}
          className="h-6 rounded-md px-2 text-xs"
        >
          {isGenerating ? 'Генерирую...' : 'Сгенерировать'}
        </Button>
      </div>
      <textarea
        className="ui-field w-full resize-none rounded-lg px-3 py-2 text-sm focus:outline-none"
        rows={4}
        placeholder="Опиши кратко в свободной форме - кнопка «Сгенерировать» оформит по шаблону (императив, позитивные триггеры, 1-3 примера вопросов)."
        value={form.whenToUse}
        onChange={event => onChange(event.target.value)}
        disabled={disabled || isGenerating}
      />
      <p className="mt-1 text-[11px] leading-snug text-on-surface-variant/70">
        Это описание читает LLM-роутер, чтобы выбрать источник под запрос пользователя.
        Пиши императивом («Используй для...»), перечисляй позитивные триггеры и добавь 1-3 примера вопросов.
        Либо набросай черновик и нажми «Сгенерировать».
      </p>
      {generateError && (
        <p className="mt-1 text-[11px] text-error">{generateError}</p>
      )}
    </div>
  );
}
