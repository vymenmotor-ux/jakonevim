/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { useEffect, useRef, useState } from 'react';
import { Modality, Tool } from '@google/genai';
import cn from 'classnames';

import BasicFace from '../basic-face/BasicFace';
import { useLiveAPIContext } from '../../../contexts/LiveAPIContext';
import { createSystemInstructions, chaosTools } from '../../../lib/prompts';
import { useAgent, useUser } from '../../../lib/state'; // Removed useUI

const SYSTEM_INSULTS = [
    "ANALÝZA OBLIČEJE: KRITICKÁ CHYBA (PŘÍLIŠ OŠKLIVÝ)",
    "IQ UŽIVATELE: NEDETEKOVÁNO (HLEDÁM...)",
    "STAV SEBEVĚDOMÍ: 0%",
    "KVALITA MIKROFONU: KANÁL",
    "HODNOTA UŽIVATELE: ZÁPORNÁ",
    "PŘEPOČÍTÁVÁM DŮVOD TVÉ EXISTENCE... VÝSLEDEK: NENALEZEN",
    "VAROVÁNÍ: EXTRÉMNÍ MÍRA TRAPNOSTI",
    "LOG: UŽIVATEL SE POKOUŠÍ BÝT VTIPNÝ... SELHÁNÍ",
    "SKENOVÁNÍ MENTALITY: RETARDOVANÁ",
    "DETEKCE SOCIÁLNÍHO ŽIVOTA: 404 NOT FOUND",
    "UKLÁDÁNÍ DAT DO DATABÁZE 'SLABOCH'..."
];

function ToxicTerminal({ connected }: { connected: boolean }) {
    const [line, setLine] = useState("INITIALIZING HATE_MODULE...");
    
    useEffect(() => {
        const interval = setInterval(() => {
            if(Math.random() > 0.6) {
                const randomMsg = SYSTEM_INSULTS[Math.floor(Math.random() * SYSTEM_INSULTS.length)];
                setLine(`> SYSTEM_ALERT: ${randomMsg}`);
            }
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="toxic-terminal">
             <div className="status-line">
               <span className="blink">█</span>
               {connected && <span className="recording-badge">REC ●</span>}
             </div>
             {line}
        </div>
    );
}

export default function KeynoteCompanion() {
  const { client, connected, setConfig, isGenerating, setVoiceEffect, setAmbience, mockUserAudio } = useLiveAPIContext();
  const faceCanvasRef = useRef<HTMLCanvasElement>(null);
  const user = useUser();
  // const { setChaos } = useUI(); // Removed useUI and setChaos
  const { current } = useAgent();
  const [subtitle, setSubtitle] = useState<string>("");
  
  // Track visits (Stalker DB)
  useEffect(() => {
      user.registerVisit();
      // setChaos('reset'); // Removed setChaos call
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply Audio DSP Effect & Ambience when agent changes or connection status changes
  useEffect(() => {
      setVoiceEffect(current.voiceEffect || 'default');
  }, [current, setVoiceEffect]);

  useEffect(() => {
    if (connected) {
        setAmbience(current.ambience || 'none');
    } else {
        setAmbience('none');
        // setChaos('reset'); // Removed setChaos call
    }
  }, [connected, current, setAmbience]); // Removed setChaos from dependencies

  // Set the configuration for the Live API
  useEffect(() => {
    setConfig({
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { 
            voiceName: current.voice,
          },
        },
      },
      // Poltergeist UI Tools + Google Search + Audio Mocking
      tools: chaosTools,
      // Enable transcription for subtitles
      outputAudioTranscription: {},
      systemInstruction: createSystemInstructions(current, user),
    });
  }, [setConfig, user, current]);

  // Handle Subtitles & Tool Calls
  useEffect(() => {
    const onTranscription = (text: string) => {
      setSubtitle(prev => {
        const newVal = prev + text;
        if (newVal.length > 150) return newVal.slice(-150);
        return newVal;
      });
    };

    // Poltergeist UI Handler
    const onToolCall = (toolCall: any) => {
        console.log("TOOL CALL RECEIVED:", toolCall);
        const fc = toolCall.functionCalls[0];

        if (fc.name === 'toggle_invert_screen') {
            // setChaos('invert'); // Visual effect removed, but log interaction
            client.sendToolResponse({
                functionResponses: [{
                    id: fc.id,
                    name: fc.name,
                    response: { result: 'Screen invert requested, but visual effects are disabled for performance. User is still suffering psychologically.' }
                }]
            });
        } 
        else if (fc.name === 'strobe_screen') {
            const active = fc.args.active !== false; // default true
            // setChaos('strobe', active); // Visual effect removed, but log interaction
             client.sendToolResponse({
                functionResponses: [{
                    id: fc.id,
                    name: fc.name,
                    response: { result: active ? 'Strobe ACTIVATED (but disabled visually).' : 'Strobe DEACTIVATED (but disabled visually).' }
                }]
            });
        }
        else if (fc.name === 'save_user_fact') {
            const fact = fc.args.fact;
            user.addLeverage(fact);
            console.log("SAVED USER FACT:", fact);
            
            client.sendToolResponse({
                functionResponses: [{
                    id: fc.id,
                    name: fc.name,
                    response: { result: 'Fact saved to permanent database. Use this against the user later.' }
                }]
            });
        }
        else if (fc.name === 'mock_user_audio') {
            const style = fc.args.style || 'chipmunk';
            const speed = style === 'demon' ? 0.6 : 1.8; // 1.8 = chipmunk, 0.6 = demon
            
            console.log(`MOCKING USER: ${style} (${speed}x)`);
            mockUserAudio(speed);

            client.sendToolResponse({
                functionResponses: [{
                    id: fc.id,
                    name: fc.name,
                    response: { result: `Audio replayed with ${style} effect. Proceed to insult the user about their voice.` }
                }]
            });
        }
    };
    
    if(!connected) setSubtitle("");

    client.on('transcription', onTranscription);
    client.on('toolcall', onToolCall);
    return () => {
      client.off('transcription', onTranscription);
      client.off('toolcall', onToolCall);
    };
  }, [client, connected, user, mockUserAudio]); // Removed setChaos from dependencies


  // Initiate the session when the Live API connection is established
  useEffect(() => {
    const beginSession = async () => {
      if (!connected) return;
      
      // Construct greeting based on user profile and history
      let greetingPrompt = 'Pozdrav uživatele a okamžitě ho začni urážet. Mluv pouze česky.';
      
      if (user.visitCount > 1) {
          greetingPrompt = `Uživatel se vrátil (návštěva č. ${user.visitCount}). Vysměj se mu, že si zase přišel pro bolest.`;
      }

      if (user.name) {
          greetingPrompt += ` Oslov ho jménem: '${user.name}'. Uraz jeho jméno.`;
      }
      
      if (user.info) {
          greetingPrompt += ` Okamžitě použij proti němu to, co na sebe prásknul: '${user.info}'. Buď kousavý.`;
      }

      client.send(
        {
          text: greetingPrompt,
        },
        true
      );
    };
    beginSession();
  }, [client, connected, user.visitCount, user.lastSeen, user.name, user.info]);

  return (
    <div className="keynote-companion">
      <div className={cn('face-wrapper', { generating: isGenerating })}>
        <BasicFace canvasRef={faceCanvasRef!} color={current.bodyColor} />
      </div>
      
      <ToxicTerminal connected={connected} />

      {subtitle && (
        <div className="terminal-log">
          <div className="terminal-header">
             <span>>>> SYSTÉMOVÝ VÝSTUP_</span>
             <span>{new Date().toLocaleTimeString()}</span>
          </div>
          <p className="terminal-text">{subtitle}<span className="cursor">_</span></p>
        </div>
      )}

      <style>{`
        .cursor {
            animation: blink 1s step-end infinite;
        }
        @keyframes blink {
            50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}