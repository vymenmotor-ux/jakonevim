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

import cn from 'classnames';

import { memo, ReactNode, useEffect, useRef, useState } from 'react';
import { AudioRecorder } from '../../../lib/audio-recorder';

import { useLiveAPIContext } from '../../../contexts/LiveAPIContext';
import { useUI } from '../../../lib/state';

export type ControlTrayProps = {
  children?: ReactNode;
};

function ControlTray({ children }: ControlTrayProps) {
  const [audioRecorder] = useState(() => new AudioRecorder());
  const [muted, setMuted] = useState(false);
  const [inVolume, setInVolume] = useState(0);
  const connectButtonRef = useRef<HTMLButtonElement>(null);

  // Silence detection refs
  const lastActivityRef = useRef<number>(Date.now());
  const silenceTimerRef = useRef<number | null>(null);

  const { showAgentEdit, showUserConfig } = useUI();
  const { client, connected, connect, disconnect, volume: outVolume, downloadAudio, userVolumeRef, recorderRef } = useLiveAPIContext();

  // Link recorder to context for "Mock User" feature
  useEffect(() => {
      if (recorderRef) {
          recorderRef.current = audioRecorder;
      }
  }, [audioRecorder, recorderRef]);

  // Stop the current agent if the user is editing the agent or user config
  useEffect(() => {
    if (showAgentEdit || showUserConfig) {
      if (connected) disconnect();
    }
  }, [showUserConfig, showAgentEdit, connected, disconnect]);

  useEffect(() => {
    if (!connected && connectButtonRef.current) {
      connectButtonRef.current.focus();
    }
  }, [connected]);

  // Silence Detection Logic
  useEffect(() => {
    if (!connected) {
      if (silenceTimerRef.current) clearInterval(silenceTimerRef.current);
      return;
    }

    const SILENCE_THRESHOLD_MS = 8000; // 8 seconds of silence triggers provocation

    silenceTimerRef.current = window.setInterval(() => {
      const now = Date.now();
      const timeSinceActivity = now - lastActivityRef.current;
      
      // If user is silent AND agent is not currently speaking (low output volume)
      if (timeSinceActivity > SILENCE_THRESHOLD_MS && outVolume < 0.01) {
        // Reset timer so we don't spam
        lastActivityRef.current = now;
        
        // Send provocation trigger
        client.send({
          text: "(Uživatel dlouho mlčí. Je trapné ticho. Řekni něco urážlivého, abys ho donutil mluvit. Zeptej se ho na něco nepříjemného, nebo komentuj to ticho.)"
        }, true);
      }
    }, 1000);

    return () => {
      if (silenceTimerRef.current) clearInterval(silenceTimerRef.current);
    };
  }, [connected, client, outVolume]);

  // Audio Streaming & Volume Monitoring
  useEffect(() => {
    const onData = (base64: string) => {
      client.sendRealtimeInput([
        {
          mimeType: 'audio/pcm;rate=16000',
          data: base64,
        },
      ]);
    };
    
    const onVolume = (vol: number) => {
        setInVolume(vol);
        // Update context ref so useLiveApi can access it for interrupt logic
        if (userVolumeRef) {
            userVolumeRef.current = vol;
        }

        // Update activity timestamp if user is speaking
        if (vol > 0.01) {
            lastActivityRef.current = Date.now();
        }
    }

    if (connected && !muted && audioRecorder) {
      audioRecorder.on('data', onData).on('volume', onVolume).start();
    } else {
      audioRecorder.stop();
    }
    return () => {
      audioRecorder.off('data', onData).off('volume', onVolume);
      audioRecorder.stop();
    };
  }, [connected, client, muted, audioRecorder, userVolumeRef]);

  // Reset activity when agent speaks (so we don't interrupt agent)
  useEffect(() => {
      if (outVolume > 0.01) {
          lastActivityRef.current = Date.now();
      }
  }, [outVolume]);

  return (
    <section className="control-tray">
      {/* POWER MODULE */}
      <div className="connection-container">
        <button
            ref={connectButtonRef}
            className={cn('connect-toggle', { connected })}
            onClick={connected ? disconnect : connect}
            title={connected ? "Odpojit systém" : "Inicializovat spojení"}
        >
            <span className="material-symbols-outlined filled">
            {connected ? 'power_settings_new' : 'power_settings_new'}
            </span>
        </button>
        <span className="connection-label" style={{ color: connected ? 'var(--danger-red)' : '#444' }}>
            {connected ? 'SYSTEM ONLINE' : 'STANDBY'}
        </span>
      </div>

      {/* TACTICAL CONTROLS */}
      <nav className={cn('actions-nav', { disabled: !connected })}>
        
        <button
          className={cn('action-button mic-button', { muted: muted, active: !muted && connected })}
          onClick={() => setMuted(!muted)}
          title="Přepnout mikrofon"
        >
            {/* Volume Visualizer Line */}
            {!muted && connected && (
                 <div 
                    className="vol-ring" 
                    // @ts-ignore
                    style={{ '--vol-opacity': Math.min(inVolume * 8, 1) }}
                 />
            )}

          {!muted ? (
            <span className="material-symbols-outlined filled">mic</span>
          ) : (
            <span className="material-symbols-outlined filled">mic_off</span>
          )}
          <span className="btn-label">{muted ? "MUTED" : "VOICE IN"}</span>
        </button>

        <button 
            className="action-button download-button"
            onClick={downloadAudio}
            title="Stáhnout záznam urážek"
         >
            <span className="material-symbols-outlined filled">download</span>
            <span className="btn-label">DUMP LOG</span>
         </button>

        {children}
      </nav>
    </section>
  );
}

export default memo(ControlTray);