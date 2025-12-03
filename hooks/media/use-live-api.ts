/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { useCallback, useEffect, useMemo, useRef, useState, MutableRefObject } from 'react';
import { GenAILiveClient } from '../../lib/genai-live-client';
import { LiveConnectConfig } from '@google/genai';
import { AudioStreamer } from '../../lib/audio-streamer';
import { AudioRecorder } from '../../lib/audio-recorder'; // Import needed for type
import { audioContext } from '../../lib/utils';
import VolMeterWorket from '../../lib/worklets/vol-meter';
import { DEFAULT_LIVE_API_MODEL } from '../../lib/constants';
import { AmbienceType, VoiceEffect } from '../../lib/presets/agents';
import { createWorketFromSrc } from '../../lib/audioworklet-registry';

export type UseLiveApiResults = {
  client: GenAILiveClient;
  setConfig: (config: LiveConnectConfig) => void;
  config: LiveConnectConfig;

  connect: () => Promise<void>;
  disconnect: () => void;
  connected: boolean;

  isGenerating: boolean;
  volume: number;
  setVoiceEffect: (effect: VoiceEffect) => void;
  setAmbience: (ambience: AmbienceType) => void;
  
  analyser?: AnalyserNode;
  downloadAudio: () => void;
  userVolumeRef: MutableRefObject<number>; 
  mockUserAudio: (speed?: number) => void; // New function exposed
  recorderRef: MutableRefObject<AudioRecorder | null>; // Exposed for advanced access if needed
};

export function useLiveApi({
  model = DEFAULT_LIVE_API_MODEL,
}: {
  model?: string;
}): UseLiveApiResults {
  const client = useMemo(() => new GenAILiveClient(model), [model]);

  const audioStreamerRef = useRef<AudioStreamer | null>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);

  const [volume, setVolume] = useState(0);
  const [connected, setConnected] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [config, setConfig] = useState<LiveConnectConfig>({});
  const [analyser, setAnalyser] = useState<AnalyserNode | undefined>(undefined);

  // Ref to track user input volume for interruption logic
  const userVolumeRef = useRef(0);

  // Effect 1: Initialize AudioStreamer and VolMeterWorklet once.
  useEffect(() => {
    const initAudioGraph = async () => {
      if (!audioStreamerRef.current) {
        const audioCtx = await audioContext({ id: 'audio-out' });
        audioStreamerRef.current = new AudioStreamer(audioCtx);
        setAnalyser(audioStreamerRef.current.analyser);
        
        // Add VolMeterWorklet directly to the audio context and connect to masterBus
        const vuWorkletName = 'vumeter-out';
        const src = createWorketFromSrc(vuWorkletName, VolMeterWorket);
        try {
          await audioCtx.audioWorklet.addModule(src);
        } catch (e: any) {
          if (!e.message.includes('already added') && !e.message.includes('registered')) {
            console.warn(`Error adding audio worklet module '${vuWorkletName}':`, e);
          }
        }
        const vuWorkletNode = new AudioWorkletNode(audioCtx, vuWorkletName);
        vuWorkletNode.port.onmessage = (ev: MessageEvent) => {
          setVolume(ev.data.volume);
        };
        // Connect the vumeter-out worklet to the master bus to measure overall output volume
        audioStreamerRef.current.masterBus.connect(vuWorkletNode);
      }
    };
    initAudioGraph();
  }, []); // Empty dependency array means this runs once on mount

  // Effect 2: Manage audio player lifecycle based on connection state.
  useEffect(() => {
    if (connected) {
      audioStreamerRef.current?.resume();
    } else {
      audioStreamerRef.current?.stop();
    }
  }, [connected]);

  // Effect 3: Bind client event listeners.
  useEffect(() => {
    const onOpen = () => {
      setConnected(true);
    };

    const onClose = () => {
      setConnected(false);
      setIsGenerating(false);
    };

    const onTurnComplete = () => {
      setIsGenerating(true);
    };

    const onInterrupted = () => {
      // LOGIKA PŘERUŠENÍ: ZMĚNA - UŽIVATEL NESMÍ PŘERUŠIT AGENTA
      // Aby agent "dořekl co chtěl", nesmíme vymazat audio buffer.
      // Proto zde NEVOLÁME audioStreamerRef.current.interrupt().
      // Pouze nastavíme flag generování, ale zvuk necháme dohrát.
      console.log("Server signaled interruption, but client is IGNORING it to finish the sentence.");
      setIsGenerating(false);
    };

    const onAudio = (data: ArrayBuffer) => {
      setIsGenerating(false);
      if (audioStreamerRef.current) {
        audioStreamerRef.current.addPCM16(new Uint8Array(data));
      }
    };

    // Bind event listeners
    client.on('open', onOpen);
    client.on('close', onClose);
    client.on('interrupted', onInterrupted);
    client.on('audio', onAudio);
    client.on('turncomplete', onTurnComplete);

    return () => {
      // Clean up event listeners
      client.off('open', onOpen);
      client.off('close', onClose);
      client.off('interrupted', onInterrupted);
      client.off('audio', onAudio);
      client.off('turncomplete', onTurnComplete);
    };
  }, [client]);

  const connect = useCallback(async () => {
    if (!config) {
      throw new Error('config has not been set');
    }
    await client.connect(config);
  }, [client, config]);

  const disconnect = useCallback(() => {
    client.disconnect();
  }, [client]);

  const setVoiceEffect = useCallback((effect: VoiceEffect) => {
    if (audioStreamerRef.current) {
        audioStreamerRef.current.setEffect(effect);
    }
  }, []);

  const setAmbience = useCallback((ambience: AmbienceType) => {
    if (audioStreamerRef.current) {
      audioStreamerRef.current.setAmbience(ambience);
    }
  }, []);

  const downloadAudio = useCallback(async () => {
    alert("Nahrávání zvuku je z důvodu maximálního výkonu a odstranění trhání vypnuto. Funkce 'Stáhnout záznam urážek' je dočasně nedostupná.");
  }, []);

  /**
   * Replays the last captured audio from the user with a playback rate effect.
   */
  const mockUserAudio = useCallback((speed: number = 1.5) => {
      if (!recorderRef.current || !audioStreamerRef.current) {
          console.warn("Cannot mock user: recorder or streamer not ready");
          return;
      }
      // Get last 3 seconds of audio
      const buffer = recorderRef.current.getLastAudio(3);
      
      // Add a slight delay before mocking to make sure we aren't overlapping too much
      // or just fire it immediately for chaos.
      audioStreamerRef.current.playBuffer(buffer, recorderRef.current.sampleRate, speed);
  }, []);

  return {
    client,
    config,
    setConfig,
    connect,
    connected,
    disconnect,
    isGenerating,
    volume,
    setVoiceEffect,
    setAmbience,
    analyser,
    downloadAudio,
    userVolumeRef,
    mockUserAudio,
    recorderRef
  };
}