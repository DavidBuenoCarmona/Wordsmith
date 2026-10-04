// =============================================================================
// Wordsmith — AI-native 3D world generator
// Copyright (c) 2026 David Bueno Carmona · https://github.com/davidbuenov
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  GenerationJob,
  GenerationProgressEvent,
  WorldPromptInput,
} from '@wordsmith/shared';

export function useGenerationJob() {
  const [currentJob, setCurrentJob] = useState<GenerationJob | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const cleanEventSource = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  const startGeneration = useCallback(
    async (input: WorldPromptInput) => {
      setError(null);
      setIsGenerating(true);
      setCurrentJob(null);
      cleanEventSource();

      try {
        const res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Error al iniciar la generación.');
        }

        const job: GenerationJob = await res.json();
        setCurrentJob(job);

        // Suscribirse a SSE
        const es = new EventSource(`/api/jobs/${job.id}/events`);
        eventSourceRef.current = es;

        es.onmessage = (e) => {
          try {
            const event: GenerationProgressEvent = JSON.parse(e.data);
            setCurrentJob((prev) => {
              const base = prev || {
                id: event.jobId,
                prompt: input.prompt,
                phase: event.phase,
                progress: event.progress,
                message: event.message,
                assets: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
              return {
                ...base,
                phase: event.phase,
                progress: event.progress,
                message: event.message,
                environment: event.environment || base.environment,
                assets: event.assets || base.assets,
                worldSpec: event.worldSpec || base.worldSpec,
                error: event.error || base.error,
              };
            });

            if (event.phase === 'COMPLETED' || event.phase === 'FAILED') {
              setIsGenerating(false);
              cleanEventSource();
            }
          } catch {
            // Error de parsing SSE ignorado
          }
        };

        es.onerror = () => {
          cleanEventSource();
          setIsGenerating(false);
        };
      } catch (err) {
        setIsGenerating(false);
        setError(err instanceof Error ? err.message : 'Error desconocido.');
      }
    },
    [cleanEventSource]
  );

  useEffect(() => {
    return () => {
      cleanEventSource();
    };
  }, [cleanEventSource]);

  return {
    currentJob,
    isGenerating,
    error,
    startGeneration,
  };
}
